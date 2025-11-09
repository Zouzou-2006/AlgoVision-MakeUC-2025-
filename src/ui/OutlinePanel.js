import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
const OutlinePanel = ({ nodes, selectedId, onSelect, title = 'Nodes', }) => {
    if (!nodes.length) {
        return (_jsxs("div", { className: "outline-panel empty", children: [_jsx("h4", { children: title }), _jsx("p", { className: "muted", children: "Run an analysis to populate nodes." })] }));
    }
    return (_jsxs("div", { className: "outline-panel", children: [_jsx("h4", { children: title }), _jsx("ul", { children: nodes.map((node) => {
                    const isSelected = node.id === selectedId;
                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: isSelected ? 'outline-item selected' : 'outline-item', onClick: () => onSelect?.(node.id), children: [_jsx("span", { className: "outline-item__name", children: node.name }), _jsx("span", { className: "outline-item__type", children: node.type })] }) }, node.id));
                }) })] }));
};
export default OutlinePanel;
//# sourceMappingURL=OutlinePanel.js.map