import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './styles.css';
const rootEl = document.getElementById('root');
if (rootEl) {
    const root = createRoot(rootEl);
    root.render(_jsx(App, {}));
}
//# sourceMappingURL=main.js.map