import { IRBuilder } from '../core/ir';
const analyzeCSharp = (ctx) => {
    const { tree, text, docId } = ctx;
    const builder = new IRBuilder();
    const diagnostics = [];
    const moduleNode = builder.addOutlineNode({
        kind: 'module',
        name: docId || 'module',
        range: fullDocumentRange(text),
    });
    const nodeToOutlineId = new WeakMap();
    nodeToOutlineId.set(tree.rootNode, moduleNode.id);
    const classInfo = new Map();
    walk(tree.rootNode, moduleNode.id);
    collectUsings(tree.rootNode, builder);
    collectCalls(tree.rootNode, nodeToOutlineId, builder);
    classInfo.forEach((info, id) => {
        const record = {
            id,
            name: info.name,
            methods: info.methods,
        };
        if (info.bases && info.bases.length > 0) {
            record.bases = info.bases;
        }
        builder.addClass(record);
    });
    return { ir: builder.build(), diagnostics };
    function walk(node, parentId) {
        for (const childNode of node.namedChildren) {
            const child = childNode;
            if (!child)
                continue;
            switch (child.type) {
                case 'namespace_declaration':
                case 'file_scoped_namespace_declaration': {
                    const nsName = child.childForFieldName('name')?.text ?? 'namespace';
                    const outlineInput = {
                        kind: 'namespace',
                        name: nsName,
                        parentId,
                        range: nodeRange(child),
                    };
                    const outlineNode = builder.addOutlineNode(outlineInput);
                    nodeToOutlineId.set(child, outlineNode.id);
                    walk(child, outlineNode.id);
                    break;
                }
                case 'class_declaration':
                case 'struct_declaration': {
                    const className = child.childForFieldName('name')?.text ?? (child.type === 'struct_declaration' ? 'Struct' : 'Class');
                    const visibility = extractVisibility(child);
                    const outlineInput = {
                        kind: child.type === 'struct_declaration' ? 'struct' : 'class',
                        name: className,
                        parentId,
                        range: nodeRange(child),
                    };
                    if (visibility) {
                        outlineInput.visibility = visibility;
                    }
                    const outlineNode = builder.addOutlineNode(outlineInput);
                    nodeToOutlineId.set(child, outlineNode.id);
                    const classData = {
                        name: className,
                        methods: [],
                    };
                    const bases = extractBaseTypes(child);
                    if (bases) {
                        classData.bases = bases;
                    }
                    classInfo.set(outlineNode.id, classData);
                    walk(child, outlineNode.id);
                    break;
                }
                case 'method_declaration':
                case 'local_function_statement': {
                    const funcName = child.childForFieldName('name')?.text ?? 'Method';
                    const params = extractParameters(child.childForFieldName('parameters'));
                    const parentNode = child.parent;
                    const enclosingId = (parentNode && nodeToOutlineId.get(parentNode)) ?? parentId ?? moduleNode.id;
                    const kind = child.type === 'method_declaration' ? 'method' : 'function';
                    const visibility = extractVisibility(child);
                    const outlineInput = {
                        kind,
                        name: funcName,
                        parentId: enclosingId,
                        params,
                        range: nodeRange(child),
                    };
                    if (visibility) {
                        outlineInput.visibility = visibility;
                    }
                    const outlineNode = builder.addOutlineNode(outlineInput);
                    nodeToOutlineId.set(child, outlineNode.id);
                    if (parentNode) {
                        const classId = nodeToOutlineId.get(parentNode);
                        if (classId) {
                            const info = classInfo.get(classId);
                            if (info)
                                info.methods.push(outlineNode.id);
                        }
                    }
                    builder.addCFG({
                        funcId: outlineNode.id,
                        nodes: [
                            { id: `${outlineNode.id}:start`, type: 'start' },
                            { id: `${outlineNode.id}:body`, type: 'stmt', label: `${funcName} body`, range: nodeRange(child) },
                            { id: `${outlineNode.id}:end`, type: 'end' },
                        ],
                        edges: [
                            [`${outlineNode.id}:start`, `${outlineNode.id}:body`],
                            [`${outlineNode.id}:body`, `${outlineNode.id}:end`],
                        ],
                    });
                    walk(child, outlineNode.id);
                    break;
                }
                default:
                    walk(child, parentId);
            }
        }
    }
};
function collectUsings(root, builder) {
    const usingNodes = root.descendantsOfType('using_directive').filter((node) => Boolean(node));
    usingNodes.forEach((node) => {
        const clause = node.text.replace(/^using\s+/, '').replace(/;$/, '').trim();
        if (!clause)
            return;
        const [left, right] = clause.split(/\s*=\s*/);
        if (!left)
            return;
        const record = {
            name: right ? right.trim() : left.trim(),
        };
        if (right) {
            record.alias = left.trim();
        }
        builder.addImport(record);
    });
}
function collectCalls(root, nodeToOutlineId, builder) {
    const invocationNodes = root.descendantsOfType('invocation_expression').filter((node) => Boolean(node));
    invocationNodes.forEach((node) => {
        const fnNode = node.childForFieldName('function');
        if (!fnNode)
            return;
        const calleeName = extractCalleeName(fnNode.text);
        if (!calleeName)
            return;
        const callerId = findEnclosingFunctionId(node, nodeToOutlineId);
        if (!callerId)
            return;
        builder.addCall({
            callerId,
            calleeName,
            kind: calleeName.includes('.') ? 'member' : 'direct',
        });
    });
}
function extractParameters(paramNode) {
    if (!paramNode)
        return [];
    const names = [];
    for (const childNode of paramNode.namedChildren) {
        const child = childNode;
        if (!child)
            continue;
        const nameNode = child.childForFieldName('name');
        if (nameNode && nameNode.type === 'identifier') {
            names.push(nameNode.text);
        }
    }
    return names;
}
function extractBaseTypes(node) {
    const baseNode = node.namedChildren.find((child) => child?.type === 'base_list');
    if (!baseNode)
        return undefined;
    const bases = [];
    for (const childNode of baseNode.namedChildren) {
        const child = childNode;
        if (child && child.type === 'type') {
            bases.push(child.text);
        }
    }
    return bases.length > 0 ? bases : undefined;
}
function extractVisibility(node) {
    const text = node.text;
    if (/public\b/.test(text))
        return 'public';
    if (/protected\s+internal\b/.test(text))
        return 'protected';
    if (/protected\b/.test(text))
        return 'protected';
    if (/internal\b/.test(text))
        return 'internal';
    if (/private\b/.test(text))
        return 'private';
    return undefined;
}
function extractCalleeName(text) {
    if (!text)
        return null;
    const parts = text.split('.');
    return parts[parts.length - 1] ?? null;
}
function findEnclosingFunctionId(node, nodeToOutlineId) {
    let current = node;
    while (current) {
        if (current.type === 'method_declaration' || current.type === 'local_function_statement') {
            const id = nodeToOutlineId.get(current);
            if (id)
                return id;
        }
        current = current.parent;
    }
    return undefined;
}
function nodeRange(node) {
    return {
        startLine: node.startPosition.row + 1,
        startCol: node.startPosition.column + 1,
        endLine: node.endPosition.row + 1,
        endCol: node.endPosition.column + 1,
    };
}
function fullDocumentRange(text) {
    const lines = text.split('\n');
    const lastLine = lines.length;
    const lastCol = (lines[lastLine - 1]?.length ?? 0) + 1;
    return { startLine: 1, startCol: 1, endLine: lastLine, endCol: lastCol };
}
export default analyzeCSharp;
//# sourceMappingURL=lang-csharp.js.map