import React, { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import './Editor.css';

type EditorProps = {
  code: string;
  onChange: (newCode: string) => void;
  language?: string;
  theme?: string;
};

const CodeEditor: React.FC<EditorProps> = ({ code, onChange, language = 'python', theme = 'futuristic' }) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState('500px');

  useEffect(() => {
    const updateHeight = () => {
      // Get the parent editor-pane height and subtract toolbar height
      const parent = containerRef.current?.parentElement;
      if (parent) {
        const parentHeight = parent.clientHeight;
        const toolbarHeight = 100; // Approximate toolbar + gap height
        const calculatedHeight = Math.max(650, parentHeight - toolbarHeight);
        setEditorHeight(`${calculatedHeight}px`);
      } else {
        // Fallback to viewport calculation - make it larger
        const vh = window.innerHeight;
        const calculatedHeight = Math.max(700, vh * 0.75);
        setEditorHeight(`${calculatedHeight}px`);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }
    window.addEventListener('resize', updateHeight);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  useEffect(() => {
    // Neon Circuit Theme - LeetCode-like with Neon Circuit palette
    monaco.editor.defineTheme('neon-circuit', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: 'A8B2D1', fontStyle: 'italic' },     // Comments → muted gray
        { token: 'keyword', foreground: '00FFF5', fontStyle: 'bold' },       // Keywords → Cyan
        { token: 'string', foreground: '00FFF5' },                            // Strings/constants → soft cyan
        { token: 'string.escape', foreground: '00FFF5' },
        { token: 'number', foreground: '00FFF5' },                            // Numbers → soft cyan
        { token: 'type', foreground: '00FFF5', fontStyle: 'bold' },          // Types → Cyan
        { token: 'class', foreground: '00FFF5', fontStyle: 'bold' },         // Classes → Cyan
        { token: 'function', foreground: '845EC2' },                         // Functions → Purple
        { token: 'method', foreground: '845EC2' },                           // Methods → Purple
        { token: 'variable', foreground: 'EDEDED' },                         // Variables → Text Primary
        { token: 'operator', foreground: '00FFF5' },
        { token: 'delimiter', foreground: 'A8B2D1' },
        { token: 'identifier', foreground: 'EDEDED' },
        // Python-specific tokens
        { token: 'keyword.control', foreground: 'FF9F1C' },                  // Loops → Orange
        { token: 'keyword.control.flow', foreground: 'FF2E63' },             // Conditionals → Magenta
        { token: 'keyword.control.conditional', foreground: 'FF2E63' },      // if/else → Magenta
        { token: 'keyword.control.loop', foreground: 'FF9F1C' },             // for/while → Orange
        { token: 'keyword.control.repeat', foreground: 'FF9F1C' },           // Loops → Orange
        // C# specific tokens
        { token: 'keyword.control.cs', foreground: 'FF2E63' },               // Conditionals → Magenta
        { token: 'keyword.control.loop.cs', foreground: 'FF9F1C' },          // Loops → Orange
      ],
      colors: {
        'editor.background': '#0A0F1C',
        'editor.foreground': '#EDEDED', // Light gray text - highly visible
        'editorLineNumber.foreground': '#A8B2D1', // Lighter for visibility
        'editorLineNumber.activeForeground': '#00FFF5',
        'editor.selectionBackground': '#00FFF540', // More visible selection
        'editor.lineHighlightBackground': '#1F283360',  // Subtle glow for current line
        'editorCursor.foreground': '#00FFF5',
        'editorCursor.background': '#EDEDED', // Cursor background for visibility
        'editorWhitespace.foreground': '#1F2833',
        'editorIndentGuide.activeBackground': '#00FFF5',
        'editorIndentGuide.background': '#1F2833',
        'editor.selectionHighlightBackground': '#FF2E6330',
        'editor.wordHighlightBackground': '#845EC220',
        'editor.wordHighlightStrongBackground': '#00FFF520',
        'editorBracketMatch.background': '#00FFF530',
        'editorBracketMatch.border': '#00FFF5',
        'editorGutter.background': '#0A0F1C',
        'editorGutter.modifiedBackground': '#00FFF5',
        'editorGutter.addedBackground': '#00FFF5',
        'editorGutter.deletedBackground': '#FF2E63',
        'editorWidget.background': '#1F2833',
        'editorWidget.border': '#00FFF540',
        'input.background': '#1F2833',
        'input.foreground': '#EDEDED',
        'input.border': '#00FFF540',
        'scrollbarSlider.background': '#00FFF540',
        'scrollbarSlider.hoverBackground': '#00FFF560',
        'scrollbarSlider.activeBackground': '#00FFF580',
        'editorError.foreground': '#FF2E63',
        'editorError.border': '#FF2E63',
        'editorError.background': '#FF2E6320',
        'editorWarning.foreground': '#FF9F1C',
        'editorWarning.border': '#FF9F1C',
        'editorInfo.foreground': '#00FFF5',
        'editorHint.foreground': '#845EC2',
        'editorSuggestWidget.background': '#1F2833',
        'editorSuggestWidget.foreground': '#EDEDED',
        'editorSuggestWidget.selectedBackground': '#00FFF520',
      },
    });

    // Legacy themes for backward compatibility
    monaco.editor.defineTheme('leetcode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'class', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'delimiter', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editor.selectionBackground': '#264f78',
        'editor.lineHighlightBackground': '#2a2d2e',
        'editorCursor.foreground': '#aeafad',
        'editorWhitespace.foreground': '#3e3e3e',
        'editorIndentGuide.activeBackground': '#707070',
        'editorIndentGuide.background': '#404040',
        'editor.selectionHighlightBackground': '#add6ff26',
        'editor.wordHighlightBackground': '#575757b8',
        'editor.wordHighlightStrongBackground': '#004972b8',
        'editorBracketMatch.background': '#0064001a',
        'editorBracketMatch.border': '#888888',
        'editorGutter.background': '#1e1e1e',
        'editorWidget.background': '#252526',
        'editorWidget.border': '#454545',
        'input.background': '#3c3c3c',
        'input.foreground': '#cccccc',
        'input.border': '#454545',
        'scrollbarSlider.background': '#79797966',
        'scrollbarSlider.hoverBackground': '#646464b3',
        'scrollbarSlider.activeBackground': '#bfbfbf66',
      },
    });

    monaco.editor.defineTheme('futuristic', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '00d9ff', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7c3aed', fontStyle: 'bold' },
        { token: 'string', foreground: '06b6d4' },
        { token: 'number', foreground: 'a855f7' },
        { token: 'type', foreground: '00d9ff' },
        { token: 'class', foreground: '00d9ff', fontStyle: 'bold' },
        { token: 'function', foreground: 'ec4899' },
        { token: 'variable', foreground: '3b82f6' },
        { token: 'operator', foreground: 'e0e7ff' },
        { token: 'delimiter', foreground: 'a5b4fc' },
      ],
      colors: {
        'editor.background': '#0a0a0f',
        'editor.foreground': '#e0e7ff',
        'editorLineNumber.foreground': '#6b7280',
        'editorLineNumber.activeForeground': '#00d9ff',
        'editor.selectionBackground': '#7c3aed40',
        'editor.lineHighlightBackground': '#111118',
        'editorCursor.foreground': '#00d9ff',
        'editorWhitespace.foreground': '#1a1a24',
        'editorIndentGuide.activeBackground': '#00d9ff',
        'editorIndentGuide.background': '#1a1a24',
        'editor.selectionHighlightBackground': '#7c3aed20',
        'editor.wordHighlightBackground': '#7c3aed15',
        'editor.wordHighlightStrongBackground': '#00d9ff15',
        'editorBracketMatch.background': '#7c3aed20',
        'editorBracketMatch.border': '#00d9ff',
        'editorGutter.background': '#0a0a0f',
        'editorWidget.background': '#1a1a24',
        'editorWidget.border': '#00d9ff40',
        'input.background': '#111118',
        'input.foreground': '#e0e7ff',
        'input.border': '#00d9ff40',
        'scrollbarSlider.background': '#00d9ff40',
        'scrollbarSlider.hoverBackground': '#00d9ff60',
        'scrollbarSlider.activeBackground': '#00d9ff80',
      },
    });
  }, []);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    
    // LeetCode-like editor configuration
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
      fontLigatures: true,
      smoothScrolling: true,
      cursorSmoothCaretAnimation: 'on',
      cursorBlinking: 'smooth',
      cursorStyle: 'line',
      cursorWidth: 2, // This is set in updateOptions, not in theme colors
      multiCursorModifier: 'ctrlCmd',
      multiCursorMergeOverlapping: false,
      renderWhitespace: 'selection',
      renderLineHighlight: 'all',
      showFoldingControls: 'always',
      folding: true,
      foldingStrategy: 'indentation',
      matchBrackets: 'always',
      autoIndent: 'full',
      formatOnPaste: true,
      formatOnType: true,
      detectIndentation: false, // Use tabSize setting
      trimAutoWhitespace: true,
      minimap: { enabled: true, side: 'right', size: 'proportional' },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 4,
      insertSpaces: true,
      wordWrap: 'off',
      lineNumbers: 'on',
      glyphMargin: true,
      occurrencesHighlight: 'singleFile',
      selectionHighlight: true,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        bracketPairsHorizontal: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showModules: true,
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true,
      },
      acceptSuggestionOnCommitCharacter: true,
      acceptSuggestionOnEnter: 'on',
      snippetSuggestions: 'top',
      wordBasedSuggestions: 'allDocuments',
    });

    // Add keyboard shortcuts for LeetCode-like experience
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      editor.getAction('editor.action.startFindReplaceAction')?.run();
    });

    // Multi-cursor support (Ctrl+Click / Alt+Click)
    editor.onMouseDown((e) => {
      if (e.event.ctrlKey || e.event.metaKey || e.event.altKey) {
        if (e.target.position) {
          editor.setPosition(e.target.position);
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
            editor.getAction('editor.action.addSelectionToNextFindMatch')?.run();
          });
        }
      }
    });

    // Enable multi-cursor editing
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.getAction('editor.action.addSelectionToNextFindMatch')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL, () => {
      editor.getAction('editor.action.selectHighlights')?.run();
    });

    // Copy, Paste, Undo, Redo are built-in but ensure they work
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
      editor.getAction('editor.action.clipboardCopyAction')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
      editor.getAction('editor.action.clipboardPasteAction')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      editor.getAction('undo')?.run();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
      editor.getAction('redo')?.run();
    });

    // Ensure error markers are visible
    const model = editor.getModel();
    if (model) {
      // Enable error markers
      monaco.editor.setModelMarkers(model, 'syntax', []);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  // Map language prop to Monaco language IDs
  const monacoLanguage = language === 'csharp' ? 'csharp' : 'python';

  // Determine which theme to use - default to neon-circuit
  const editorTheme = theme === 'neon-circuit' || theme === 'futuristic' || theme === 'neon' 
    ? 'neon-circuit' 
    : theme === 'leetcode-dark' 
    ? 'leetcode-dark' 
    : 'neon-circuit';

  return (
    <div ref={containerRef} className="monaco-editor-container">
      <Editor
        height={editorHeight}
        language={monacoLanguage}
      value={code}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={editorTheme}
        options={{
          // Options are set in handleEditorDidMount for better control
          // This ensures all LeetCode-like features are enabled
        }}
      />
    </div>
  );
};

export default CodeEditor;
