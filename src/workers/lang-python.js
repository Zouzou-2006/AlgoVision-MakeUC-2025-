import { IRBuilder } from '../core/ir';
const PY_MODULE_NAME = 'module';
const analyzePython = (ctx) => {
    const { tree, text, docId } = ctx;
    const builder = new IRBuilder();
    const diagnostics = [];
    const moduleRange = fullDocumentRange(text);
    const moduleNode = builder.addOutlineNode({
        kind: 'module',
        name: docId || PY_MODULE_NAME,
        range: moduleRange,
    });
    const nodeToOutlineId = new WeakMap();
    nodeToOutlineId.set(tree.rootNode, moduleNode.id);
    const classInfo = new Map();
    walk(tree.rootNode, moduleNode.id);
    // Imports
    collectImports(tree.rootNode, builder);
    // Calls
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
                case 'class_definition': {
                    const className = child.childForFieldName('name')?.text ?? 'Class';
                    const range = nodeRange(child);
                    const outlineNode = builder.addOutlineNode({
                        kind: 'class',
                        name: className,
                        parentId,
                        range,
                    });
                    nodeToOutlineId.set(child, outlineNode.id);
                    const classData = {
                        name: className,
                        methods: [],
                    };
                    const bases = extractClassBases(child);
                    if (bases) {
                        classData.bases = bases;
                    }
                    classInfo.set(outlineNode.id, classData);
                    walk(child, outlineNode.id);
                    break;
                }
                case 'function_definition': {
                    const functionName = child.childForFieldName('name')?.text ?? 'function';
                    const parameters = extractParameters(child.childForFieldName('parameters'));
                    const range = nodeRange(child);
                    const parentNode = child.parent;
                    const parentOutlineId = (parentNode && nodeToOutlineId.get(parentNode)) ?? parentId ?? moduleNode.id;
                    const parentOutlineNode = parentNode?.type === 'class_definition' ? parentOutlineId : parentId;
                    const kind = parentNode?.type === 'class_definition' ? 'method' : 'function';
                    const outlineNode = builder.addOutlineNode({
                        kind,
                        name: functionName,
                        parentId: parentOutlineNode,
                        params: parameters,
                        range,
                    });
                    nodeToOutlineId.set(child, outlineNode.id);
                    if (parentNode?.type === 'class_definition' && parentOutlineId) {
                        const classData = classInfo.get(parentOutlineId);
                        if (classData) {
                            classData.methods.push(outlineNode.id);
                        }
                    }
                    builder.addCFG({
                        funcId: outlineNode.id,
                        nodes: [
                            { id: `${outlineNode.id}:start`, type: 'start' },
                            {
                                id: `${outlineNode.id}:body`,
                                type: 'stmt',
                                label: `${functionName} body`,
                                range,
                            },
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
function collectImports(root, builder) {
    const importNodes = root.descendantsOfType(['import_statement', 'import_from_statement']).filter((node) => Boolean(node));
    importNodes.forEach((node) => {
        if (node.type === 'import_statement') {
            const namesText = node.text.replace(/^import\s+/, '');
            namesText
                .split(',')
                .map((part) => part.trim())
                .forEach((entry) => {
                if (!entry)
                    return;
                const [name, alias] = entry.split(/\s+as\s+/);
                const record = { name: name?.trim() ?? '' };
                if (alias?.trim()) {
                    record.alias = alias.trim();
                }
                builder.addImport(record);
            });
        }
        else if (node.type === 'import_from_statement') {
            const match = node.text.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
            if (!match)
                return;
            const [, moduleName, members] = match;
            if (!moduleName || !members)
                return;
            members
                .split(',')
                .map((m) => m.trim())
                .forEach((member) => {
                if (!member)
                    return;
                const [name, alias] = member.split(/\s+as\s+/);
                const record = {
                    name: `${moduleName}.${name?.trim() ?? ''}`,
                };
                if (alias?.trim()) {
                    record.alias = alias.trim();
                }
                builder.addImport(record);
            });
        }
    });
}
function collectCalls(root, nodeToOutlineId, builder) {
    const callNodes = root.descendantsOfType('call').filter((node) => Boolean(node));
    callNodes.forEach((callNode) => {
        const funcNode = callNode.childForFieldName('function');
        if (!funcNode)
            return;
        const calleeName = extractCalleeName(funcNode.text);
        if (!calleeName)
            return;
        const callerId = findEnclosingFunctionId(callNode, nodeToOutlineId);
        if (!callerId)
            return;
        builder.addCall({
            callerId,
            calleeName,
            kind: calleeName.includes('.') ? 'member' : 'direct',
        });
    });
}
function extractClassBases(classNode) {
    const argumentList = classNode.childForFieldName('superclasses');
    if (!argumentList)
        return undefined;
    const bases = [];
    for (const childNode of argumentList.namedChildren) {
        const child = childNode;
        if (child &&
            (child.type === 'identifier' || child.type === 'attribute' || child.type === 'dotted_name')) {
            bases.push(child.text);
        }
    }
    return bases.length > 0 ? bases : undefined;
}
function extractParameters(paramNode) {
    if (!paramNode)
        return [];
    const params = new Set();
    for (const childNode of paramNode.namedChildren) {
        const child = childNode;
        if (!child)
            continue;
        if (child.type === 'identifier') {
            params.add(child.text);
        }
        else {
            const nameField = child.childForFieldName('name');
            if (nameField && nameField.type === 'identifier') {
                params.add(nameField.text);
            }
        }
    }
    return Array.from(params);
}
function extractCalleeName(text) {
    if (!text)
        return null;
    const segments = text.split('.');
    return segments[segments.length - 1] ?? null;
}
function findEnclosingFunctionId(node, nodeToOutlineId) {
    let current = node;
    while (current) {
        if (current.type === 'function_definition') {
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
export default analyzePython;
//# sourceMappingURL=lang-python.js.map