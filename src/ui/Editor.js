import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
const Editor = ({ code, onChange }) => {
    return (_jsx("textarea", { className: "code-editor", value: code, onChange: (e) => onChange(e.target.value), rows: 20 }));
};
export default Editor;
//# sourceMappingURL=Editor.js.map