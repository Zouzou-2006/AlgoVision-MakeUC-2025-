import React from 'react';

type SupportedLanguage = 'python' | 'csharp';

type ToolbarProps = {
  onRun: () => void;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onThemeChange?: (theme: string) => void;
  currentTheme?: string;
  currentLanguage?: SupportedLanguage;
  isVisualizing: boolean;
};

const Toolbar: React.FC<ToolbarProps> = ({ onRun, onLanguageChange, isVisualizing, onThemeChange, currentTheme, currentLanguage }) => {
  return (
    <div className="toolbar">
      <button className="btn btn-primary run-button" onClick={onRun} disabled={isVisualizing}>{isVisualizing ? 'Rendering...' : 'Run Visualization'}</button>
      <div className="toolbar-group">
        <select className="toolbar-select" value={currentLanguage || 'python'} onChange={(e) => onLanguageChange((e.target as HTMLSelectElement).value as SupportedLanguage)}>
        <option value="python">Python</option>
        <option value="csharp">C#</option>
        </select>

        <select className="toolbar-select" value={currentTheme} onChange={(e) => onThemeChange?.((e.target as HTMLSelectElement).value)}>
          <option value="neon">Neon</option>
          <option value="sunset">Sunset</option>
          <option value="glass">Glass</option>
        </select>
      </div>
    </div>
  );
};

export default Toolbar;
