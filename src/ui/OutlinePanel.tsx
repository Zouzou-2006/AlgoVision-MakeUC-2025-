import React from 'react';
import type { IROutlineNode } from '../core/ir';

type OutlinePanelProps = {
  nodes: IROutlineNode[];
};

const OutlinePanel: React.FC<OutlinePanelProps> = ({ nodes }) => {
  return (
    <div className="outline-panel">
      <ul>
        {nodes.map((n) => (
          <li key={n.id}>{n.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default OutlinePanel;
