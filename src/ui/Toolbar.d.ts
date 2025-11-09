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
declare const Toolbar: React.FC<ToolbarProps>;
export default Toolbar;
//# sourceMappingURL=Toolbar.d.ts.map