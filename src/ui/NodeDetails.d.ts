import React from 'react';
import type { OutlineNode, DataFlowEdge } from '../core/ir';
type NodeDetailsProps = {
    node: OutlineNode | null;
    edges: DataFlowEdge[];
    allNodes: OutlineNode[];
    code: string;
};
declare const NodeDetails: React.FC<NodeDetailsProps>;
export default NodeDetails;
//# sourceMappingURL=NodeDetails.d.ts.map