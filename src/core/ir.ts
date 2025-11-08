// Core data structures for code analysis and 3D visualization

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

// Builder pattern for constructing visualization data
export class VisualizationBuilder {
  private nodes: OutlineNode[] = [];
  private edges: DataFlowEdge[] = [];
  private nodeIdCounter = 0;

  private generateId(type: string): string {
    return `${type}_${++this.nodeIdCounter}`;
  }

  addNode(name: string, type: OutlineNodeType, location: SourceLocation, metadata?: any): string {
    const id = this.generateId(type);
    const node: OutlineNode = {
      id,
      name,
      type,
      location,
      metadata,
    };
    this.nodes.push(node);
    return id;
  }

  addEdge(from: string, to: string, type: DataFlowEdge['type'], label: string = ''): void {
    this.edges.push({
      id: `edge_${this.edges.length}`,
      from,
      to,
      type,
      label,
    });
  }

  addChild(parentId: string, child: OutlineNode): void {
    const parent = this.nodes.find(n => n.id === parentId);
    if (parent) {
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(child);
    }
  }

  build(language: string): VisualizationData {
    const rootNode = this.nodes.find(n => n.type === 'module') || this.nodes[0];
    return {
      nodes: this.nodes,
      edges: this.edges,
      rootNode: rootNode!,
      language,
      timestamp: Date.now(),
    };
  }

  clear(): void {
    this.nodes = [];
    this.edges = [];
    this.nodeIdCounter = 0;
  }
}

// ---------------------------------------------------------------------------
// Intermediate Representation (IR) types used by the worker + renderers.

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

export type IRNode =
  | { id: string; type: 'start' | 'end' }
  | { id: string; type: 'stmt'; label: string; range?: IRRange }
  | { id: string; type: 'cond'; label: string; range?: IRRange }
  | { id: string; type: 'switch'; label: string; cases: string[]; range?: IRRange };

export type IREdge = [fromId: string, toId: string, label?: string];

export type IRCall = { callerId: string; calleeName: string; kind: 'direct' | 'member' };

export type IRClass = {
  id: string;
  name: string;
  methods: string[];
  bases?: string[];
};

export type IRImport = { name: string; alias?: string };

export type IRRange = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

export type DiagnosticCode =
  | 'TS_PARSE_ERROR'
  | 'NODE_CAP_REACHED'
  | 'UNSUPPORTED_CONSTRUCT'
  | 'MERMAID_ESCAPE'
  | 'RENDER_CAP_REACHED'
  | 'CANCELLED'
  | 'INTERNAL';

export type Diagnostic = {
  severity: 'info' | 'warn' | 'error';
  code: DiagnosticCode;
  message: string;
  range?: IRRange;
  details?: Record<string, unknown>;
};

type IdCounters = Record<string, number>;

export class IRBuilder {
  private outline: IROutlineNode[] = [];
  private cfgs: IRCFG[] = [];
  private calls: IRCall[] = [];
  private classes: IRClass[] = [];
  private imports: IRImport[] = [];
  private counters: IdCounters = {};

  addOutlineNode(node: Omit<IROutlineNode, 'id'>): IROutlineNode {
    const key = `${node.kind}:${node.range.startLine}`;
    const seq = (this.counters[key] ?? 0) + 1;
    this.counters[key] = seq;
    const safeName = node.name || node.kind;
    const idPrefix = node.kind === 'function' || node.kind === 'method' ? 'f' : node.kind[0] ?? 'n';
    const id = `${idPrefix}:${safeName}@${node.range.startLine}#${seq}`;
    const fullNode: IROutlineNode = { ...node, id };
    this.outline.push(fullNode);
    return fullNode;
  }

  addCFG(cfg: IRCFG): void {
    this.cfgs.push(cfg);
  }

  addCall(call: IRCall): void {
    this.calls.push(call);
  }

  addClass(irClass: IRClass): void {
    this.classes.push(irClass);
  }

  addImport(irImport: IRImport): void {
    this.imports.push(irImport);
  }

  build(): IRDocument {
    return {
      outline: this.outline.slice(),
      cfgs: this.cfgs.slice(),
      calls: this.calls.slice(),
      classes: this.classes.slice(),
      imports: this.imports.slice(),
    };
  }

  static rangeFromLines(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number
  ): IRRange {
    return { startLine, startCol, endLine, endCol };
  }
}
