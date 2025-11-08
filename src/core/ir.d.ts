export type OutlineNodeType = 'function' | 'class' | 'variable' | 'module' | 'import' | 'loop' | 'conditional' | 'namespace' | 'interface' | 'struct' | 'property';
export interface Position {
    line: number;
    column: number;
}
export interface SourceLocation {
    start: Position;
    end: Position;
}
export interface OutlineNode {
    id: string;
    name: string;
    type: OutlineNodeType;
    location: SourceLocation;
    children?: OutlineNode[];
    metadata?: Record<string, any>;
}
export interface DataFlowEdge {
    id: string;
    from: string;
    to: string;
    type: 'data' | 'control' | 'call';
    label: string;
}
export interface VisualizationData {
    nodes: OutlineNode[];
    edges: DataFlowEdge[];
    rootNode: OutlineNode;
    language: string;
    timestamp: number;
}
export interface ParserResult {
    success: boolean;
    data?: VisualizationData;
    error?: string;
    outline: OutlineNode[];
}
export declare class VisualizationBuilder {
    private nodes;
    private edges;
    private nodeIdCounter;
    private generateId;
    addNode(name: string, type: OutlineNodeType, location: SourceLocation, metadata?: any): string;
    addEdge(from: string, to: string, type: DataFlowEdge['type'], label?: string): void;
    addChild(parentId: string, child: OutlineNode): void;
    build(language: string): VisualizationData;
    clear(): void;
}
export type IRDocument = {
    outline: IROutlineNode[];
    cfgs: IRCFG[];
    calls: IRCall[];
    classes: IRClass[];
    imports: IRImport[];
};
export type IROutlineNode = {
    id: string;
    kind: 'module' | 'namespace' | 'class' | 'struct' | 'function' | 'method';
    name: string;
    parentId?: string;
    range: IRRange;
    params?: string[];
    visibility?: 'public' | 'protected' | 'private' | 'internal';
    genericParams?: string[];
};
export type IRCFG = {
    funcId: string;
    nodes: IRNode[];
    edges: IREdge[];
};
export type IRNode = {
    id: string;
    type: 'start' | 'end';
} | {
    id: string;
    type: 'stmt';
    label: string;
    range?: IRRange;
} | {
    id: string;
    type: 'cond';
    label: string;
    range?: IRRange;
} | {
    id: string;
    type: 'switch';
    label: string;
    cases: string[];
    range?: IRRange;
};
export type IREdge = [fromId: string, toId: string, label?: string];
export type IRCall = {
    callerId: string;
    calleeName: string;
    kind: 'direct' | 'member';
};
export type IRClass = {
    id: string;
    name: string;
    methods: string[];
    bases?: string[];
};
export type IRImport = {
    name: string;
    alias?: string;
};
export type IRRange = {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
};
export type DiagnosticCode = 'TS_PARSE_ERROR' | 'NODE_CAP_REACHED' | 'UNSUPPORTED_CONSTRUCT' | 'MERMAID_ESCAPE' | 'RENDER_CAP_REACHED' | 'CANCELLED' | 'INTERNAL';
export type Diagnostic = {
    severity: 'info' | 'warn' | 'error';
    code: DiagnosticCode;
    message: string;
    range?: IRRange;
    details?: Record<string, unknown>;
};
export declare class IRBuilder {
    private outline;
    private cfgs;
    private calls;
    private classes;
    private imports;
    private counters;
    addOutlineNode(node: Omit<IROutlineNode, 'id'>): IROutlineNode;
    addCFG(cfg: IRCFG): void;
    addCall(call: IRCall): void;
    addClass(irClass: IRClass): void;
    addImport(irImport: IRImport): void;
    build(): IRDocument;
    static rangeFromLines(startLine: number, startCol: number, endLine: number, endCol: number): IRRange;
}
//# sourceMappingURL=ir.d.ts.map