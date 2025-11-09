import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useMemo } from 'react';
const NodeDetails = ({ node, edges, allNodes, code }) => {
    const nodeLookup = useMemo(() => {
        const map = new Map();
        allNodes.forEach((item) => {
            map.set(item.id, item);
        });
        return map;
    }, [allNodes]);
    const outgoing = useMemo(() => (node ? edges.filter((edge) => edge.from === node.id) : []), [edges, node]);
    const incoming = useMemo(() => (node ? edges.filter((edge) => edge.to === node.id) : []), [edges, node]);
    const snippet = useMemo(() => {
        if (!node || !node.location)
            return null;
        const lines = code.split('\n');
        const start = node.location.start.line;
        const end = node.location.end.line;
        const slice = lines.slice(start, Math.min(lines.length, end + 1));
        if (!slice.length)
            return null;
        return slice.join('\n');
    }, [node, code]);
    return (_jsxs("div", { className: "node-details", children: [_jsx("h4", { children: "Node Details" }), !node && _jsx("p", { className: "muted", children: "Click a shape in the 3D view to inspect it." }), node && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "node-details__section", children: [_jsx("div", { className: "node-details__name", children: node.name }), _jsxs("div", { className: "node-details__meta", children: [_jsx("span", { className: "chip", children: node.type }), node.external && _jsx("span", { className: "chip", children: "external" }), node.metadata?.params && node.metadata.params.length > 0 && (_jsxs("span", { className: "chip", children: ["params: ", node.metadata.params.join(', ')] }))] }), node.location && (_jsxs("div", { className: "node-details__range", children: ["L", node.location.start.line + 1, ":", node.location.start.column + 1, " \u2013 L", node.location.end.line + 1, ":", node.location.end.column + 1] }))] }), snippet && (_jsxs("div", { className: "node-details__section", children: [_jsx("div", { className: "node-details__label", children: "Code" }), _jsx("pre", { className: "node-details__snippet", children: snippet })] })), _jsxs("div", { className: "node-details__section grid", children: [_jsxs("div", { children: [_jsx("div", { className: "node-details__label", children: "Outgoing" }), outgoing.length === 0 ? (_jsx("p", { className: "muted", children: "No outgoing references." })) : (_jsx("ul", { children: outgoing.map((edge) => {
                                            const target = nodeLookup.get(edge.to);
                                            return (_jsxs("li", { children: [_jsx("span", { className: "chip chip--edge", children: edge.type }), _jsx("strong", { children: target?.name ?? edge.to }), _jsxs("span", { className: "muted", children: [" (", edge.label, ")"] })] }, edge.id));
                                        }) }))] }), _jsxs("div", { children: [_jsx("div", { className: "node-details__label", children: "Incoming" }), incoming.length === 0 ? (_jsx("p", { className: "muted", children: "No incoming references." })) : (_jsx("ul", { children: incoming.map((edge) => {
                                            const source = nodeLookup.get(edge.from);
                                            return (_jsxs("li", { children: [_jsx("span", { className: "chip chip--edge", children: edge.type }), _jsx("strong", { children: source?.name ?? edge.from }), _jsxs("span", { className: "muted", children: [" (", edge.label, ")"] })] }, edge.id));
                                        }) }))] })] })] }))] }));
};
export default NodeDetails;
//# sourceMappingURL=NodeDetails.js.map