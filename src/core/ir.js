// Core data structures for code analysis and 3D visualization
// Builder pattern for constructing visualization data
export class VisualizationBuilder {
    nodes = [];
    edges = [];
    nodeIdCounter = 0;
    generateId(type) {
        return `${type}_${++this.nodeIdCounter}`;
    }
    addNode(name, type, location, metadata) {
        const id = this.generateId(type);
        const node = {
            id,
            name,
            type,
            location,
            metadata,
        };
        this.nodes.push(node);
        return id;
    }
    addEdge(from, to, type, label = '') {
        this.edges.push({
            id: `edge_${this.edges.length}`,
            from,
            to,
            type,
            label,
        });
    }
    addChild(parentId, child) {
        const parent = this.nodes.find(n => n.id === parentId);
        if (parent) {
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(child);
        }
    }
    build(language) {
        const rootNode = this.nodes.find(n => n.type === 'module') || this.nodes[0];
        return {
            nodes: this.nodes,
            edges: this.edges,
            rootNode: rootNode,
            language,
            timestamp: Date.now(),
        };
    }
    clear() {
        this.nodes = [];
        this.edges = [];
        this.nodeIdCounter = 0;
    }
}
export class IRBuilder {
    outline = [];
    cfgs = [];
    calls = [];
    classes = [];
    imports = [];
    counters = {};
    addOutlineNode(node) {
        const key = `${node.kind}:${node.range.startLine}`;
        const seq = (this.counters[key] ?? 0) + 1;
        this.counters[key] = seq;
        const safeName = node.name || node.kind;
        const idPrefix = node.kind === 'function' || node.kind === 'method' ? 'f' : node.kind[0] ?? 'n';
        const id = `${idPrefix}:${safeName}@${node.range.startLine}#${seq}`;
        const fullNode = { ...node, id };
        this.outline.push(fullNode);
        return fullNode;
    }
    addCFG(cfg) {
        this.cfgs.push(cfg);
    }
    addCall(call) {
        this.calls.push(call);
    }
    addClass(irClass) {
        this.classes.push(irClass);
    }
    addImport(irImport) {
        this.imports.push(irImport);
    }
    build() {
        return {
            outline: this.outline.slice(),
            cfgs: this.cfgs.slice(),
            calls: this.calls.slice(),
            classes: this.classes.slice(),
            imports: this.imports.slice(),
        };
    }
    static rangeFromLines(startLine, startCol, endLine, endCol) {
        return { startLine, startCol, endLine, endCol };
    }
}
//# sourceMappingURL=ir.js.map