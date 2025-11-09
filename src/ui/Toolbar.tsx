import React from 'react';
<<<<<<< HEAD
import './Toolbar.css';
=======
>>>>>>> a673469819c5262bea9f9db0f9250f2b9be98e7c

type SupportedLanguage = 'python' | 'csharp';

type ToolbarProps = {
  onRun: () => void;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onThemeChange?: (theme: string) => void;
  currentTheme?: string;
  currentLanguage?: SupportedLanguage;
  isVisualizing: boolean;
};

<<<<<<< HEAD
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
=======
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
>>>>>>> a673469819c5262bea9f9db0f9250f2b9be98e7c
          <option value="neon">Neon</option>
          <option value="sunset">Sunset</option>
          <option value="glass">Glass</option>
        </select>
      </div>
    </div>
  );
};

export default Toolbar;
