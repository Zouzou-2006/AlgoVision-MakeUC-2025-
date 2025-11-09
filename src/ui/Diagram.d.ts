import React from 'react';
import type { VisualizationData } from '../core/ir';
import './Diagram.css';
type DiagramProps = {
    visualizationData: VisualizationData | null;
    isVisualizing: boolean;
    onSelectNode?: (nodeId: string | null) => void;
    selectedNodeId?: string | null;
    orbitScale?: number;
};
declare const Diagram: React.FC<DiagramProps>;
export default Diagram;
//# sourceMappingURL=Diagram.d.ts.map