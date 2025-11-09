import React from 'react';
import './Editor.css';
type EditorProps = {
    code: string;
    onChange: (newCode: string) => void;
    language?: string;
    theme?: string;
};
declare const CodeEditor: React.FC<EditorProps>;
export default CodeEditor;
//# sourceMappingURL=Editor.d.ts.map