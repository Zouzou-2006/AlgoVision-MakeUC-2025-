import React, { useMemo } from 'react';
import type { OutlineNode, DataFlowEdge } from '../core/ir';

type NodeDetailsProps = {
  node: OutlineNode | null;
  edges: DataFlowEdge[];
  allNodes: OutlineNode[];
  code: string;
};

const NodeDetails: React.FC<NodeDetailsProps> = ({ node, edges, allNodes, code }) => {
  const nodeLookup = useMemo(() => {
    const map = new Map<string, OutlineNode>();
    allNodes.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [allNodes]);

  const outgoing = useMemo(
    () => (node ? edges.filter((edge) => edge.from === node.id) : []),
    [edges, node]
  );

  const incoming = useMemo(
    () => (node ? edges.filter((edge) => edge.to === node.id) : []),
    [edges, node]
  );

  const snippet = useMemo(() => {
    if (!node || !node.location) return null;
    const lines = code.split('\n');
    const start = node.location.start.line;
    const end = node.location.end.line;
    const slice = lines.slice(start, Math.min(lines.length, end + 1));
    if (!slice.length) return null;
    return slice.join('\n');
  }, [node, code]);

  return (
    <div className="node-details">
      <h4>Node Details</h4>
      {!node && <p className="muted">Click a shape in the 3D view to inspect it.</p>}
      {node && (
        <>
          <div className="node-details__section">
            <div className="node-details__name">{node.name}</div>
            <div className="node-details__meta">
              <span className="chip">{node.type}</span>
              {node.external && <span className="chip">external</span>}
              {node.metadata?.params && node.metadata.params.length > 0 && (
                <span className="chip">
                  params: {node.metadata.params.join(', ')}
                </span>
              )}
            </div>
            {node.location && (
              <div className="node-details__range">
<<<<<<< HEAD
                L{node.location.start.line + 1}:{node.location.start.column + 1} - L
=======
                L{node.location.start.line + 1}:{node.location.start.column + 1} – L
>>>>>>> a673469819c5262bea9f9db0f9250f2b9be98e7c
                {node.location.end.line + 1}:{node.location.end.column + 1}
              </div>
            )}
          </div>

          {snippet && (
            <div className="node-details__section">
              <div className="node-details__label">Code</div>
              <pre className="node-details__snippet">{snippet}</pre>
            </div>
          )}

          <div className="node-details__section grid">
            <div>
              <div className="node-details__label">Outgoing</div>
              {outgoing.length === 0 ? (
                <p className="muted">No outgoing references.</p>
              ) : (
                <ul>
                  {outgoing.map((edge) => {
                    const target = nodeLookup.get(edge.to);
                    return (
                      <li key={edge.id}>
                        <span className="chip chip--edge">{edge.type}</span>
                        <strong>{target?.name ?? edge.to}</strong>
                        <span className="muted"> ({edge.label})</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div>
              <div className="node-details__label">Incoming</div>
              {incoming.length === 0 ? (
                <p className="muted">No incoming references.</p>
              ) : (
                <ul>
                  {incoming.map((edge) => {
                    const source = nodeLookup.get(edge.from);
                    return (
                      <li key={edge.id}>
                        <span className="chip chip--edge">{edge.type}</span>
                        <strong>{source?.name ?? edge.from}</strong>
                        <span className="muted"> ({edge.label})</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NodeDetails;
