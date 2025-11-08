import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
const OutlinePanel = ({ nodes }) => {
    return (_jsx("div", { className: "outline-panel", children: _jsx("ul", { children: nodes.map((n) => (_jsx("li", { children: n.name }, n.id))) }) }));
};
export default OutlinePanel;
//# sourceMappingURL=OutlinePanel.js.map