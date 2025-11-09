import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
const Toolbar = ({ onRun, onLanguageChange, isVisualizing, onThemeChange, currentTheme, currentLanguage }) => {
    return (_jsxs("div", { className: "toolbar", children: [_jsx("button", { className: "btn btn-primary run-button", onClick: onRun, disabled: isVisualizing, children: isVisualizing ? 'Rendering...' : 'Run Visualization' }), _jsxs("div", { className: "toolbar-group", children: [_jsxs("select", { className: "toolbar-select", value: currentLanguage || 'python', onChange: (e) => onLanguageChange(e.target.value), children: [_jsx("option", { value: "python", children: "Python" }), _jsx("option", { value: "csharp", children: "C#" })] }), _jsxs("select", { className: "toolbar-select", value: currentTheme, onChange: (e) => onThemeChange?.(e.target.value), children: [_jsx("option", { value: "neon", children: "Neon" }), _jsx("option", { value: "sunset", children: "Sunset" }), _jsx("option", { value: "glass", children: "Glass" })] })] })] }));
};
export default Toolbar;
//# sourceMappingURL=Toolbar.js.map