import React from 'react';
import type { OutlineNode } from '../core/ir';
type OutlinePanelProps = {
    nodes: OutlineNode[];
    selectedId?: string | null;
    onSelect?: (nodeId: string) => void;
    title?: string;
};
declare const OutlinePanel: React.FC<OutlinePanelProps>;
export default OutlinePanel;
//# sourceMappingURL=OutlinePanel.d.ts.map