import React, { useEffect, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'markdown' | 'json' | 'xml';
  theme: 'dark' | 'light';
  editorRef?: React.MutableRefObject<any>;
  onSave?: () => void;
  onCleanup?: () => void;
  onReview?: () => void;
  onToggleView?: () => void;
  onToggleOutline?: () => void;
  onToggleHistory?: () => void;
  onToggleTheme?: () => void;
}

export function CodeEditor({ 
  value, onChange, language, theme, editorRef,
  onSave, onCleanup, onReview, onToggleView, onToggleOutline, onToggleHistory, onToggleTheme
}: CodeEditorProps) {
  const monaco = useMonaco();
  const decorationsCollection = useRef<any>(null);
  const internalEditorRef = useRef<any>(null);

  // Keep track of the latest callbacks to prevent stale closures in Monaco commands
  const callbacksRef = useRef({ onSave, onCleanup, onReview, onToggleView, onToggleOutline, onToggleHistory, onToggleTheme });
  useEffect(() => {
    callbacksRef.current = { onSave, onCleanup, onReview, onToggleView, onToggleOutline, onToggleHistory, onToggleTheme };
  }, [onSave, onCleanup, onReview, onToggleView, onToggleOutline, onToggleHistory, onToggleTheme]);

  const handleBeforeMount = (monacoInstance: any) => {
    monacoInstance.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#111827', // Tailwind gray-900
        'editor.lineHighlightBackground': '#1f2937', // Tailwind gray-800
      }
    });
    monacoInstance.editor.defineTheme('custom-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f3f4f6',
      }
    });
  };

  const updateDecorations = () => {
    if (!internalEditorRef.current || !monaco) return;
    const model = internalEditorRef.current.getModel();
    if (!model) return;

    const text = model.getValue();
    const regex = /\{\{.*?\}\}/g;
    let match;
    const decorations = [];

    while ((match = regex.exec(text)) !== null) {
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + match[0].length);
      decorations.push({
        range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        options: { 
          inlineClassName: 'variable-highlight'
        }
      });
    }

    if (!decorationsCollection.current) {
      decorationsCollection.current = internalEditorRef.current.createDecorationsCollection(decorations);
    } else {
      decorationsCollection.current.set(decorations);
    }
  };

  useEffect(() => {
    updateDecorations();
  }, [value, monaco]);

  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(val) => onChange(val || '')}
        theme={theme === 'dark' ? 'custom-dark' : 'custom-light'}
        beforeMount={handleBeforeMount}
        onMount={(editor, monacoInstance) => {
          internalEditorRef.current = editor;
          if (editorRef) {
            editorRef.current = editor;
          }
          updateDecorations();

          // Add Commands
          if (monacoInstance) {
            // Bold: Ctrl+B
            editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyB, () => {
              const selection = editor.getSelection();
              const text = editor.getModel().getValueInRange(selection);
              editor.executeEdits('my-source', [{
                range: selection,
                text: `**${text}**`,
                forceMoveMarkers: true
              }]);
              if (text === '') {
                const position = editor.getPosition();
                editor.setPosition({ lineNumber: position.lineNumber, column: position.column - 2 });
              }
            });

            // Italic: Ctrl+I
            editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyI, () => {
              const selection = editor.getSelection();
              const text = editor.getModel().getValueInRange(selection);
              editor.executeEdits('my-source', [{
                range: selection,
                text: `*${text}*`,
                forceMoveMarkers: true
              }]);
              if (text === '') {
                const position = editor.getPosition();
                editor.setPosition({ lineNumber: position.lineNumber, column: position.column - 1 });
              }
            });

            // Insert Variable: Ctrl+Shift+V
            editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyV, () => {
              const selection = editor.getSelection();
              editor.executeEdits('my-source', [{
                range: selection,
                text: '{{}}',
                forceMoveMarkers: true
              }]);
              const position = editor.getPosition();
              editor.setPosition({ lineNumber: position.lineNumber, column: position.column - 2 });
            });

            // Close XML Tag: Alt+Enter
            editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.Enter, () => {
              const position = editor.getPosition();
              const model = editor.getModel();
              const textBefore = model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              });
              
              const tagRegex = /<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?(?<!\/)>|<\/([a-zA-Z0-9-]+)>/g;
              const stack: string[] = [];
              let match;
              
              while ((match = tagRegex.exec(textBefore)) !== null) {
                const [fullMatch, openTag, closeTag] = match;
                if (openTag) {
                  // Skip self-closing tags (already handled by negative lookbehind in regex, but being safe)
                  if (!fullMatch.endsWith('/>')) {
                    stack.push(openTag);
                  }
                } else if (closeTag) {
                  if (stack.length > 0 && stack[stack.length - 1] === closeTag) {
                    stack.pop();
                  }
                }
              }

              if (stack.length > 0) {
                const lastTag = stack.pop();
                editor.executeEdits('my-source', [{
                  range: new monacoInstance.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                  text: `</${lastTag}>`,
                  forceMoveMarkers: true
                }]);
              }
            });

            // Global Hotkeys as Editor Commands
            editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => callbacksRef.current.onSave?.());
            editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyC, () => callbacksRef.current.onCleanup?.());
            editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyR, () => callbacksRef.current.onReview?.());
            editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyT, () => callbacksRef.current.onToggleView?.());
            editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyO, () => callbacksRef.current.onToggleOutline?.());
            editor.addCommand(monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyH, () => callbacksRef.current.onToggleHistory?.());
            editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyL, () => callbacksRef.current.onToggleTheme?.());
          }
        }}
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          wrappingIndent: 'same',
          wrappingStrategy: 'advanced',
          lineNumbers: 'on',
          lineHeight: 24,
          renderLineHighlight: 'all',
          scrollBeyondLastLine: false,
          folding: true,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          padding: { top: 16, bottom: 16 },
          automaticLayout: true,
        }}
      />
    </div>
  );
}
