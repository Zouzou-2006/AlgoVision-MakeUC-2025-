import React from 'react';
import type { VisualizationData } from '../core/ir';
import './Diagram.css';
type DiagramProps = {
    visualizationData: VisualizationData | null;
    isVisualizing: boolean;
    onSelectNode?: (nodeId: string | null) => void;
    selectedNodeId?: string | null;
    code?: string;
};
declare const Diagram: React.FC<DiagramProps>;
export default Diagram;
//# sourceMappingURL=Diagram.old.d.ts.map