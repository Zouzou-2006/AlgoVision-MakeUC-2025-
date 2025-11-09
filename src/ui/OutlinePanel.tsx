import React from 'react';
import type { OutlineNode } from '../core/ir';

type OutlinePanelProps = {
  nodes: OutlineNode[];
  selectedId?: string | null;
  onSelect?: (nodeId: string) => void;
  title?: string;
};

const OutlinePanel: React.FC<OutlinePanelProps> = ({
  nodes,
  selectedId,
  onSelect,
  title = 'Nodes',
}) => {
  if (!nodes.length) {
    return (
      <div className="outline-panel empty">
        <h4>{title}</h4>
        <p className="muted">Run an analysis to populate nodes.</p>
      </div>
    );
  }

  return (
    <div className="outline-panel">
      <h4>{title}</h4>
      <ul>
        {nodes.map((node) => {
          const isSelected = node.id === selectedId;
          return (
            <li key={node.id}>
              <button
                type="button"
                className={isSelected ? 'outline-item selected' : 'outline-item'}
                onClick={() => onSelect?.(node.id)}
              >
                <span className="outline-item__name">{node.name}</span>
                <span className="outline-item__type">{node.type}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default OutlinePanel;
