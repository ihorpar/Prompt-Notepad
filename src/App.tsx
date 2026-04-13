import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { XMLParser } from 'fast-xml-parser';
import { encode } from 'gpt-tokenizer';
import { marked } from 'marked';
import { CodeEditor } from './components/CodeEditor';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { GraphView } from './components/GraphView';
import { ReviewModal } from './components/ReviewModal';
import { SaveModal } from './components/SaveModal';
import { saveVersion, getVersions, clearVersions, updateVersionName, PromptVersion } from './lib/db';
import { convertFormat } from './lib/converter';

export default function App() {
  const [content, setContent] = useState<string>('');
  const [format, setFormat] = useState<'auto' | 'markdown' | 'json' | 'xml'>('auto');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarMode, setSidebarMode] = useState<'outline' | 'history' | 'none'>('outline');
  const [viewMode, setViewMode] = useState<'text' | 'tree'>('text');
  const [history, setHistory] = useState<PromptVersion[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const editorRef = useRef<any>(null);

  const actualFormat = useMemo(() => {
    if (format !== 'auto') return format;
    const trimmed = content.trim();
    if (!trimmed) return 'markdown';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {}
    }
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return 'xml';
    }
    return 'markdown';
  }, [content, format]);

  const handleNavigate = useCallback((line: number) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
      editorRef.current.focus();
    }
  }, []);

  const handleSave = useCallback(async (name: string) => {
    if (!content.trim()) return;
    await saveVersion(content, actualFormat, name);
    const updatedHistory = await getVersions();
    setHistory(updatedHistory);
    setIsSaveModalOpen(false);
  }, [content, actualFormat]);

  const handleUpdateVersionName = async (id: number, name: string) => {
    await updateVersionName(id, name);
    const updatedHistory = await getVersions();
    setHistory(updatedHistory);
  };

  // Load history on mount and clear existing if needed (one-time for this update)
  useEffect(() => {
    const init = async () => {
      // Check if we've already cleared history for this update
      const hasCleared = localStorage.getItem('history_cleared_v1');
      if (!hasCleared) {
        await clearVersions();
        localStorage.setItem('history_cleared_v1', 'true');
      }
      const versions = await getVersions();
      setHistory(versions);
    };
    init();
  }, []);

  // Apply theme to body
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleCleanup = useCallback(() => {
    let newContent = content;
    
    // 1. Strip bold markers but keep text: **text** -> text
    // We use a more robust regex that handles multiple occurrences correctly
    newContent = newContent.replace(/\*\*(.*?)\*\*/g, '$1');
    
    // 2. Normalize horizontal whitespace: replace multiple spaces/tabs with a single space
    // But preserve leading indentation if it's at the start of a line
    newContent = newContent.split('\n').map(line => {
      const leadingSpace = line.match(/^\s*/)?.[0] || '';
      const rest = line.substring(leadingSpace.length).trim().replace(/\s+/g, ' ');
      return rest ? leadingSpace + rest : '';
    }).join('\n');
    
    // 3. Normalize vertical whitespace: limit to max 2 consecutive newlines
    newContent = newContent.replace(/\n{3,}/g, '\n\n');
    
    // 4. Trim overall start/end
    newContent = newContent.trim();
    
    setContent(newContent);
  }, [content]);

  const handleConvert = (to: 'markdown' | 'json' | 'xml') => {
    const newContent = convertFormat(content, actualFormat, to);
    setContent(newContent);
    setFormat(to);
  };

  const handleDownload = async (ext: string) => {
    let finalContent = content;
    let mimeType = 'text/plain';

    if (ext === 'doc') {
      const htmlContent = await marked.parse(content);
      finalContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>${htmlContent}</body></html>`;
      mimeType = 'application/msword';
    } else if (ext === 'json') {
      mimeType = 'application/json';
    } else if (ext === 'xml') {
      mimeType = 'application/xml';
    } else if (ext === 'md') {
      mimeType = 'text/markdown';
    }

    const blob = new Blob([finalContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleView = useCallback(() => {
    if (actualFormat === 'json' || actualFormat === 'xml') {
      setViewMode(prev => prev === 'text' ? 'tree' : 'text');
    }
  }, [actualFormat]);

  const handleToggleOutline = useCallback(() => {
    setSidebarMode(prev => prev === 'outline' ? 'none' : 'outline');
  }, []);

  const handleToggleHistory = useCallback(() => {
    setSidebarMode(prev => prev === 'history' ? 'none' : 'history');
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setIsSaveModalOpen(true);
      }
      // Cleanup: Alt+C
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCleanup();
      }
      // Review: Alt+R
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsReviewModalOpen(true);
      }
      // Toggle View Mode: Alt+T
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleToggleView();
      }
      // Toggle Outline: Alt+O
      if (e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleToggleOutline();
      }
      // Toggle History: Alt+H
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleToggleHistory();
      }
      // Toggle Theme: Ctrl+Shift+L
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleToggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCleanup, handleToggleView, handleToggleOutline, handleToggleHistory, handleToggleTheme]);

  const handleRestore = (version: PromptVersion) => {
    setContent(version.content);
    setFormat(version.format);
    setSidebarMode('none');
  };

  const stats = useMemo(() => {
    const lines = content ? content.split('\n').length : 0;
    let tokens = 0;
    try {
      tokens = content ? encode(content).length : 0;
    } catch (e) {
      // Fallback if tokenizer fails
      tokens = content.split(/\s+/).length;
    }
    return { lines, tokens };
  }, [content]);

  const parsedTreeData = useMemo(() => {
    if (viewMode !== 'tree') return null;
    try {
      if (actualFormat === 'json') {
        return JSON.parse(content);
      } else if (actualFormat === 'xml') {
        const parser = new XMLParser({ ignoreAttributes: false });
        return parser.parse(content);
      }
    } catch (e) {
      return { error: 'Invalid format for tree view' };
    }
    return null;
  }, [content, actualFormat, viewMode]);

  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-[#0f111a] text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
      <Toolbar
        format={format}
        setFormat={setFormat}
        actualFormat={actualFormat}
        theme={theme}
        setTheme={setTheme}
        sidebarMode={sidebarMode}
        setSidebarMode={setSidebarMode}
        onCleanup={handleCleanup}
        onSave={() => setIsSaveModalOpen(true)}
        onDownload={handleDownload}
        onConvert={handleConvert}
        onReview={() => setIsReviewModalOpen(true)}
        stats={stats}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          mode={sidebarMode}
          format={actualFormat}
          onClose={() => setSidebarMode('none')}
          content={content}
          history={history}
          onRestore={handleRestore}
          onNavigate={handleNavigate}
          onUpdateVersionName={handleUpdateVersionName}
        />
        
        <main className="flex-1 min-w-0 relative bg-white dark:bg-[#111827]">
          {viewMode === 'tree' && (actualFormat === 'json' || actualFormat === 'xml') ? (
            <div className="absolute inset-0 overflow-auto p-4 bg-white dark:bg-[#111827]">
              {parsedTreeData && parsedTreeData.error ? (
                <div className="text-red-500 p-4 font-mono text-sm">
                  {parsedTreeData.error}. Please fix the syntax in Text View.
                </div>
              ) : (
                <GraphView data={parsedTreeData} />
              )}
            </div>
          ) : (
          <CodeEditor
            value={content}
            onChange={setContent}
            language={actualFormat}
            theme={theme}
            editorRef={editorRef}
            onSave={() => setIsSaveModalOpen(true)}
            onCleanup={handleCleanup}
            onReview={() => setIsReviewModalOpen(true)}
            onToggleView={handleToggleView}
            onToggleOutline={handleToggleOutline}
            onToggleHistory={handleToggleHistory}
            onToggleTheme={handleToggleTheme}
          />
          )}
        </main>
      </div>

      <ReviewModal 
        isOpen={isReviewModalOpen} 
        onClose={() => setIsReviewModalOpen(false)} 
        content={content} 
      />

      <SaveModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
