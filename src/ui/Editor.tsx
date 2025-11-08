import React from 'react';

type EditorProps = {
  code: string;
  onChange: (newCode: string) => void;
  language?: string;
};

const Editor: React.FC<EditorProps> = ({ code, onChange }) => {
  return (
    <textarea
      className="code-editor"
      value={code}
      onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      rows={20}
    />
  );
};

export default Editor;
