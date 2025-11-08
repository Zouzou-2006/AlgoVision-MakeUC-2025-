import React, { useState, useCallback, useRef, useEffect } from 'react';
import Toolbar from './Toolbar';
import Editor from './Editor';
import OutlinePanel from './OutlinePanel';
import Diagram from './Diagram';
import type {
  VisualizationData,
  OutlineNode,
  OutlineNodeType,
  DataFlowEdge,
  SourceLocation,
  IRDocument,
  IROutlineNode,
  IRRange,
  Diagnostic,
} from '../core/ir';

type SupportedLanguage = 'python' | 'csharp';

type WorkerInitDone = { kind: 'init:done'; coldStartMs: number };
type WorkerResult = {
  kind: 'result';
  requestId: string;
  docId: string;
  language: SupportedLanguage;
  ir: IRDocument;
  diagnostics: Diagnostic[];
  perf: { parseMs: number; irMs: number; totalMs: number; renderCapHit?: boolean };
};
type WorkerCancelled = { kind: 'cancelled'; requestId: string };
type WorkerMessage = WorkerInitDone | WorkerResult | WorkerCancelled;

const DOC_ID = 'doc-1';

const defaultPythonCode = `def calculate_factorial(n):
    """Calculate factorial of a number"""
    if n <= 1:
        return 1
    else:
        return n * calculate_factorial(n - 1)

def main():
    number = 5
    result = calculate_factorial(number)
    print(f"Factorial of {number} is {result}")

if __name__ == "__main__":
    main()`;

const App: React.FC = () => {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('theme') || 'neon';
    } catch {
      return 'neon';
    }
  });
  const [code, setCode] = useState<string>(defaultPythonCode);
  const [outlineNodes, setOutlineNodes] = useState<IROutlineNode[]>([]);
  const [visualizationData, setVisualizationData] = useState<VisualizationData | null>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [isVisualizing, setIsVisualizing] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('python');

  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const docVersionRef = useRef(1);
  const docIdRef = useRef(DOC_ID);
  const requestCounterRef = useRef(0);
  const pendingAnalyzeRef = useRef<string | null>(null);
  const lastSyncedTextRef = useRef<string>(defaultPythonCode);
  const latestCodeRef = useRef<string>(defaultPythonCode);
  const latestLanguageRef = useRef<SupportedLanguage>('python');

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    latestCodeRef.current = code;
  }, [code]);

  useEffect(() => {
    latestLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (!message || typeof message !== 'object' || !('kind' in message)) {
        return;
      }

      switch (message.kind) {
        case 'init:done':
          workerReadyRef.current = true;
          openDocument(latestLanguageRef.current, latestCodeRef.current);
          setExplanation(
            `Tree-sitter ready in ${Math.round(message.coldStartMs)}ms. Click "Run Visualization" to analyze.`
          );
          break;
        case 'result':
          if (pendingAnalyzeRef.current && message.requestId !== pendingAnalyzeRef.current) {
            // Ignore stale response.
            break;
          }
          pendingAnalyzeRef.current = null;
          setIsVisualizing(false);
          setOutlineNodes(message.ir.outline);
          setVisualizationData(convertIRToVisualization(message.ir, message.language));
          setExplanation(generateExplanation(message.ir, message.diagnostics));
          break;
        case 'cancelled':
          if (pendingAnalyzeRef.current === message.requestId) {
            pendingAnalyzeRef.current = null;
            setIsVisualizing(false);
            setExplanation('Analysis cancelled.');
          }
          break;
        default:
          break;
      }
    };

    worker.onerror = (error) => {
      console.error('Worker error', error);
      setExplanation('Parser worker error. Please refresh the page.');
      setIsVisualizing(false);
    };

    worker.postMessage({ kind: 'init' });

    return () => {
      worker.terminate();
      workerRef.current = null;
      workerReadyRef.current = false;
    };
  }, []);

  const openDocument = useCallback((language: SupportedLanguage, text: string) => {
    if (!workerRef.current) return;
    docVersionRef.current = 1;
    workerRef.current.postMessage({
      kind: 'openDoc',
      docId: docIdRef.current,
      language,
      text,
      version: docVersionRef.current,
    });
    lastSyncedTextRef.current = text;
  }, []);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      if (!workerReadyRef.current || !workerRef.current) {
        lastSyncedTextRef.current = newCode;
        return;
      }

      const previousText = lastSyncedTextRef.current;
      docVersionRef.current += 1;
      workerRef.current.postMessage({
        kind: 'applyEdits',
        docId: docIdRef.current,
        version: docVersionRef.current,
        edits: [
          {
            range: fullDocumentRange(previousText),
            text: newCode,
          },
        ],
      });
      lastSyncedTextRef.current = newCode;
    },
    []
  );

  const handleRunVisualization = useCallback(() => {
    if (!code.trim()) {
      setExplanation('Please enter some code to visualize.');
      return;
    }

    if (!workerReadyRef.current || !workerRef.current) {
      setExplanation('Parser worker not ready. Please wait a moment.');
      return;
    }

    const requestId = `req-${Date.now()}-${++requestCounterRef.current}`;
    pendingAnalyzeRef.current = requestId;
    setIsVisualizing(true);
    setExplanation('Analyzing code with Tree-sitter...');
    setVisualizationData(null);
    setOutlineNodes([]);

    workerRef.current.postMessage({
      kind: 'analyze',
      docId: docIdRef.current,
      requestId,
      options: { includeClassDiagram: true, includeCallGraph: true },
    });
  }, [code]);

  const handleThemeChange = useCallback((nextTheme: string) => setTheme(nextTheme), []);

  const handleLanguageChange = useCallback(
    (lang: SupportedLanguage) => {
      setSelectedLanguage(lang);
      if (workerReadyRef.current) {
        openDocument(lang, latestCodeRef.current);
        setVisualizationData(null);
        setOutlineNodes([]);
        setExplanation(`Language switched to ${lang}. Run analysis to refresh results.`);
      }
    },
    [openDocument]
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <img src="/favicon.svg" alt="AlgoVision" style={{ width: 40, height: 40, borderRadius: 8 }} />
          <div>
            <h1 className="title">AlgoVision</h1>
            <p className="subtitle">3D Code Visualization for Beginners</p>
          </div>
        </div>
      </header>

      <main className="main-grid">
        <div className="editor-pane">
          <Toolbar
            onRun={handleRunVisualization}
            onLanguageChange={handleLanguageChange}
            isVisualizing={isVisualizing}
            onThemeChange={handleThemeChange}
            currentTheme={theme}
            currentLanguage={selectedLanguage}
          />
          <Editor code={code} onChange={handleCodeChange} language={selectedLanguage} />
          <OutlinePanel nodes={outlineNodes} />
        </div>

        <div className="visualization-pane">
          <Diagram visualizationData={visualizationData} isVisualizing={isVisualizing} />
        </div>
      </main>

      <aside className="explanation-panel">
        <div className="explanation-header">
          <h3>AI Explanation</h3>
          <span className="ai-icon">dY-</span>
        </div>
        <div className="explanation-content">
          {explanation || (
            <div className="explanation-placeholder">
              <p>Click "Run Visualization" to see Tree-sitter powered insights.</p>
            </div>
          )}
        </div>
      </aside>

      <footer className="status-bar">
        <div className="status-item">
          <span className="status-label">Status:</span>
          <span className="status-value">{isVisualizing ? 'Analyzing...' : 'Ready'}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Language:</span>
          <span className="status-value">{selectedLanguage}</span>
        </div>
        <div className="status-item">
          <span className="status-label">3D Engine:</span>
          <span className="status-value">Three.js</span>
        </div>
      </footer>
    </div>
  );
};

function fullDocumentRange(text: string): IRRange {
  if (!text) {
    return { startLine: 1, startCol: 1, endLine: 1, endCol: 1 };
  }
  const lines = text.split('\n');
  const endLine = lines.length;
  const endCol = (lines[endLine - 1]?.length ?? 0) + 1;
  return { startLine: 1, startCol: 1, endLine, endCol };
}

function convertIRToVisualization(ir: IRDocument, language: string): VisualizationData | null {
  if (!ir.outline.length) {
    return null;
  }

  const nodes: OutlineNode[] = ir.outline.map((node) => {
    const outline: OutlineNode = {
      id: node.id,
      name: node.name,
      type: mapKindToOutlineType(node.kind),
      location: toLocation(node.range),
    };
    if (node.params && node.params.length > 0) {
      outline.metadata = { params: node.params };
    }
    return outline;
  });

  const edges: DataFlowEdge[] = [];
  ir.outline.forEach((node) => {
    if (node.parentId) {
      edges.push({
        id: `edge_${edges.length}`,
        from: node.parentId,
        to: node.id,
        type: 'control',
        label: '',
      });
    }
  });

  ir.calls.forEach((call) => {
    edges.push({
      id: `edge_${edges.length}`,
      from: call.callerId,
      to: call.calleeName,
      type: 'call',
      label: call.kind,
    });
  });

  const rootNode = nodes.find((n) => n.type === 'module') ?? nodes[0]!;

  return {
    nodes,
    edges,
    rootNode,
    language,
    timestamp: Date.now(),
  };
}

function mapKindToOutlineType(kind: IROutlineNode['kind']): OutlineNodeType {
  switch (kind) {
    case 'module':
      return 'module';
    case 'namespace':
      return 'namespace';
    case 'class':
      return 'class';
    case 'struct':
      return 'struct';
    case 'method':
    case 'function':
    default:
      return 'function';
  }
}

function toLocation(range: IRRange): SourceLocation {
  return {
    start: { line: Math.max(0, range.startLine - 1), column: Math.max(0, range.startCol - 1) },
    end: { line: Math.max(0, range.endLine - 1), column: Math.max(0, range.endCol - 1) },
  };
}

function generateExplanation(ir: IRDocument, diagnostics: Diagnostic[]): string {
  const blocking = diagnostics.find((d) => d.severity === 'error');
  if (blocking) {
    return `${blocking.code}: ${blocking.message}`;
  }

  const parts: string[] = [];
  if (ir.outline.length) {
    const counts = ir.outline.reduce<Record<string, number>>((acc, node) => {
      acc[node.kind] = (acc[node.kind] || 0) + 1;
      return acc;
    }, {});
    parts.push(`Outline nodes: ${ir.outline.length}`);
    (['module', 'namespace', 'class', 'struct', 'function', 'method'] as Array<IROutlineNode['kind']>).forEach(
      (kind) => {
        if (counts[kind]) {
          parts.push(`${counts[kind]} ${kind}${counts[kind] > 1 ? 's' : ''}`);
        }
      }
    );
  } else {
    parts.push('No outline nodes detected.');
  }

  if (ir.calls.length) {
    parts.push(`${ir.calls.length} call relation${ir.calls.length > 1 ? 's' : ''}`);
  }
  if (ir.imports.length) {
    parts.push(`${ir.imports.length} import${ir.imports.length > 1 ? 's' : ''}`);
  }
  if (diagnostics.length) {
    const nonBlocking = diagnostics.filter((d) => d.severity !== 'error');
    if (nonBlocking.length) {
      parts.push(`${nonBlocking.length} diagnostic${nonBlocking.length > 1 ? 's' : ''}`);
    }
  }

  return parts.join(', ');
}

export default App;
