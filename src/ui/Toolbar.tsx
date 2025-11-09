import React from 'react';
import './Toolbar.css';

type SupportedLanguage = 'python' | 'csharp';

type ToolbarProps = {
  onRun: () => void;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onThemeChange?: (theme: string) => void;
  currentTheme?: string;
  currentLanguage?: SupportedLanguage;
  isVisualizing: boolean;
};

const Toolbar: React.FC<ToolbarProps> = ({ 
  onRun, 
  onLanguageChange, 
  isVisualizing, 
  onThemeChange, 
  currentTheme, 
  currentLanguage 
}) => {
  return (
    <div className="toolbar-container">
      <div className="toolbar-button-wrapper">
        <button 
          className="futur-btn run-button" 
          onClick={onRun} 
          disabled={isVisualizing}
          title="Run code visualization"
        >
          {isVisualizing ? (
            <>
              <span className="btn-loader"></span>
              Rendering...
            </>
          ) : (
            'Run Visualization'
          )}
        </button>
      </div>
      
      <div className="toolbar-controls-wrapper">
        <select 
          className="futur-select toolbar-select" 
          value={currentLanguage || 'python'} 
          onChange={(e) => onLanguageChange((e.target as HTMLSelectElement).value as SupportedLanguage)}
          title="Select programming language"
        >
          <option value="python">Python</option>
          <option value="csharp">C#</option>
        </select>

        <select 
          className="futur-select toolbar-select" 
          value={currentTheme || 'neon-circuit'} 
          onChange={(e) => onThemeChange?.((e.target as HTMLSelectElement).value)}
          title="Select theme"
        >
          <option value="neon-circuit">Neon Circuit</option>
          <option value="futuristic">Futuristic</option>
          <option value="neon">Neon</option>
          <option value="sunset">Sunset</option>
          <option value="glass">Glass</option>
        </select>
      </div>
    </div>
  );
};

export default Toolbar;
