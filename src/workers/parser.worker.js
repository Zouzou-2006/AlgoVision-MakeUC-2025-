import { initTreeSitter, getParser } from './ts-init';
import analyzePython from './lang-python';
import analyzeCSharp from './lang-csharp';
const documents = new Map();
const activeRequestsByDoc = new Map();
const cancelledRequests = new Set();
const utf8Encoder = new TextEncoder();
const analyzers = {
    python: analyzePython,
    csharp: analyzeCSharp,
};
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
self.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || typeof message !== 'object') {
        return;
    }
    switch (message.kind) {
        case 'init':
            void handleInit();
            break;
        case 'openDoc':
            handleOpenDoc(message);
            break;
        case 'applyEdits':
            handleApplyEdits(message);
            break;
        case 'analyze':
            void handleAnalyze(message);
            break;
        case 'cancel':
            handleCancel(message);
            break;
        case 'closeDoc':
            handleCloseDoc(message);
            break;
        default:
            console.warn('Unknown worker request', message);
    }
});
async function handleInit() {
    try {
        const result = await initTreeSitter(true);
        postMessage({ kind: 'init:done', coldStartMs: result.coldStartMs });
    }
    catch (error) {
        postMessage({
            kind: 'result',
            requestId: 'init',
            docId: '',
            language: 'python',
            ir: emptyIR(),
            diagnostics: [
                {
                    severity: 'error',
                    code: 'INTERNAL',
                    message: `Tree-sitter init failed: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            perf: { parseMs: 0, irMs: 0, totalMs: 0 },
        });
    }
}
function handleOpenDoc(message) {
    documents.set(message.docId, {
        docId: message.docId,
        language: message.language,
        version: message.version,
        text: message.text,
        tree: null,
    });
}
function handleCloseDoc(message) {
    const prevRequestId = activeRequestsByDoc.get(message.docId);
    if (prevRequestId) {
        cancelledRequests.add(prevRequestId);
        postMessage({ kind: 'cancelled', requestId: prevRequestId });
        activeRequestsByDoc.delete(message.docId);
    }
    documents.delete(message.docId);
}
function handleApplyEdits(message) {
    const doc = documents.get(message.docId);
    if (!doc) {
        return;
    }
    if (message.version <= doc.version) {
        return;
    }
    if (!Array.isArray(message.edits) || message.edits.length === 0) {
        doc.version = message.version;
        return;
    }
    const resolved = resolveEdits(doc.text, message.edits);
    let updatedText = doc.text;
    let tree = doc.tree;
    for (const edit of resolved.sortedEdits) {
        updatedText =
            updatedText.slice(0, edit.startIndex) + edit.text + updatedText.slice(edit.endIndex);
        if (tree) {
            tree.edit({
                startIndex: edit.startByte,
                oldEndIndex: edit.endByte,
                newEndIndex: edit.startByte + edit.newTextBytes,
                startPosition: edit.startPosition,
                oldEndPosition: edit.endPosition,
                newEndPosition: edit.newEndPosition,
            });
        }
    }
    doc.text = updatedText;
    doc.tree = tree;
    doc.version = message.version;
}
async function handleAnalyze(message) {
    const doc = documents.get(message.docId);
    if (!doc) {
        postMessage({
            kind: 'result',
            requestId: message.requestId,
            docId: message.docId,
            language: 'python',
            ir: emptyIR(),
            diagnostics: [
                {
                    severity: 'error',
                    code: 'INTERNAL',
                    message: `Document not found: ${message.docId}`,
                },
            ],
            perf: { parseMs: 0, irMs: 0, totalMs: 0 },
        });
        return;
    }
    const previousRequest = activeRequestsByDoc.get(doc.docId);
    if (previousRequest && previousRequest !== message.requestId) {
        cancelledRequests.add(previousRequest);
        postMessage({ kind: 'cancelled', requestId: previousRequest });
    }
    activeRequestsByDoc.set(doc.docId, message.requestId);
    cancelledRequests.delete(message.requestId);
    try {
        const response = await analyzeDocument(doc, message);
        if (!response) {
            return;
        }
        postMessage(response);
    }
    finally {
        if (activeRequestsByDoc.get(doc.docId) === message.requestId) {
            activeRequestsByDoc.delete(doc.docId);
        }
        cancelledRequests.delete(message.requestId);
    }
}
function handleCancel(message) {
    cancelledRequests.add(message.requestId);
    postMessage({ kind: 'cancelled', requestId: message.requestId });
}
async function analyzeDocument(doc, request) {
    if (cancelledRequests.has(request.requestId)) {
        return null;
    }
    const parseStart = now();
    try {
        const parser = await getParser(doc.language);
        const tree = parser.parse(doc.text, doc.tree ?? undefined);
        doc.tree = tree;
    }
    catch (error) {
        return {
            kind: 'result',
            requestId: request.requestId,
            docId: doc.docId,
            language: doc.language,
            ir: emptyIR(),
            diagnostics: [
                {
                    severity: 'error',
                    code: 'TS_PARSE_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown parse failure',
                },
            ],
            perf: { parseMs: now() - parseStart, irMs: 0, totalMs: now() - parseStart },
        };
    }
    const parseMs = now() - parseStart;
    if (cancelledRequests.has(request.requestId)) {
        return null;
    }
    const analyzer = analyzers[doc.language];
    if (!analyzer) {
        return {
            kind: 'result',
            requestId: request.requestId,
            docId: doc.docId,
            language: doc.language,
            ir: emptyIR(),
            diagnostics: [
                {
                    severity: 'error',
                    code: 'INTERNAL',
                    message: `No analyzer found for language: ${doc.language}`,
                },
            ],
            perf: { parseMs, irMs: 0, totalMs: parseMs },
        };
    }
    const irStart = now();
    const analysis = await analyzer({
        tree: doc.tree,
        text: doc.text,
        docId: doc.docId,
        language: doc.language,
        ...(request.options ? { options: request.options } : {}),
    });
    const ir = analysis.ir;
    const diagnostics = analysis.diagnostics ?? [];
    const irMs = now() - irStart;
    const totalMs = parseMs + irMs;
    return {
        kind: 'result',
        requestId: request.requestId,
        docId: doc.docId,
        language: doc.language,
        ir,
        diagnostics,
        perf: { parseMs, irMs, totalMs },
    };
}
function emptyIR() {
    return {
        outline: [],
        cfgs: [],
        calls: [],
        classes: [],
        imports: [],
    };
}
function resolveEdits(text, edits) {
    const lineOffsets = computeLineOffsets(text);
    const resolved = edits.map(edit => {
        const { range } = edit;
        const startIndex = positionToIndex(range.startLine, range.startColumn, lineOffsets);
        const endIndex = positionToIndex(range.endLine, range.endColumn, lineOffsets);
        const startByte = byteOffset(text, startIndex);
        const endByte = byteOffset(text, endIndex);
        const startPosition = toPoint(range.startLine, range.startColumn);
        const endPosition = toPoint(range.endLine, range.endColumn);
        const newEndPosition = applyTextToPoint(startPosition, edit.text);
        const newTextBytes = utf8Encoder.encode(edit.text).length;
        return {
            startIndex,
            endIndex,
            text: edit.text,
            startByte,
            endByte,
            newTextBytes,
            startPosition,
            endPosition,
            newEndPosition,
        };
    });
    resolved.sort((a, b) => b.startIndex - a.startIndex);
    return { sortedEdits: resolved };
}
function computeLineOffsets(text) {
    const offsets = [0];
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] === '\n') {
            offsets.push(i + 1);
        }
    }
    offsets.push(text.length);
    return offsets;
}
function positionToIndex(line, column, lineOffsets) {
    const safeLine = Math.max(1, line);
    const safeColumn = Math.max(1, column);
    const fallbackIndex = lineOffsets.length > 0 ? lineOffsets[lineOffsets.length - 1] : 0;
    const hasLineStart = safeLine - 1 >= 0 && safeLine - 1 < lineOffsets.length;
    const lineStart = hasLineStart ? lineOffsets[safeLine - 1] : fallbackIndex;
    const index = lineStart + (safeColumn - 1);
    return Math.max(0, Math.min(index, fallbackIndex));
}
function toPoint(line, column) {
    return {
        row: Math.max(0, line - 1),
        column: Math.max(0, column - 1),
    };
}
function applyTextToPoint(start, inserted) {
    if (!inserted) {
        return { ...start };
    }
    const parts = inserted.split('\n');
    if (parts.length === 1) {
        const firstPart = parts[0] ?? '';
        return { row: start.row, column: start.column + firstPart.length };
    }
    const lastPart = parts.length > 0 ? parts[parts.length - 1] : '';
    return {
        row: start.row + parts.length - 1,
        column: lastPart.length,
    };
}
function byteOffset(text, charIndex) {
    const clampedIndex = Math.max(0, Math.min(charIndex, text.length));
    return utf8Encoder.encode(text.slice(0, clampedIndex)).length;
}
//# sourceMappingURL=parser.worker.js.map