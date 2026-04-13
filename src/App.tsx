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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [content, setContent] = useState<string>('');
  const [format, setFormat] = useState<'auto' | 'markdown' | 'json' | 'xml'>('auto');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarMode, setSidebarMode] = useState<'outline' | 'history' | 'none'>('outline');
  const [viewMode, setViewMode] = useState<'text' | 'tree'>('text');
  const [history, setHistory] = useState<PromptVersion[]>([]);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => {
        if (data.requiresAuth && !data.authenticated) {
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      })
      .catch(() => setIsAuthenticated(true)); // Fallback if server is not running auth
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
      } else {
        setAuthError('Invalid password');
      }
    } catch (err) {
      setAuthError('Authentication failed');
    }
  };

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

    if (ext === 'doc' || ext === 'pdf') {
      const htmlContent = await marked.parse(content);
      
      // Process headers to ensure first letter is capitalized, but preserve ALL CAPS
      const processedHtml = htmlContent.replace(/<(h[1-6])>(.*?)<\/\1>/g, (match, tag, text) => {
        // If it's already all caps (and has at least one letter), leave it
        if (text === text.toUpperCase() && /[A-Z]/.test(text)) {
          return `<${tag}>${text}</${tag}>`;
        }
        // Otherwise, ensure first letter is capitalized
        const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
        return `<${tag}>${capitalized}</${tag}>`;
      });

      const exportHtml = `
        <html>
        <head>
          <meta charset='utf-8'>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&family=Libre+Baskerville:ital@0;1&display=swap');
            
            body { 
              font-family: 'Inter', -apple-system, sans-serif;
              line-height: 1.7;
              color: #1a202c;
              padding: 0;
              margin: 0;
              background: white;
            }
            
            .content-wrapper {
              padding: 50px 60px;
            }

            h1, h2, h3, h4 { 
              font-family: 'Inter', sans-serif; 
              color: #111827;
              margin-top: 2em;
              margin-bottom: 0.8em;
              page-break-after: avoid;
              letter-spacing: -0.02em;
            }

            h1 { 
              font-size: 28pt; 
              font-weight: 700;
              border-bottom: 3px solid #3b82f6; 
              padding-bottom: 12px;
              margin-top: 0;
            }

            h2 { 
              font-size: 20pt; 
              font-weight: 600;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 8px;
            }

            h3 { 
              font-size: 16pt; 
              font-weight: 600;
              color: #374151;
            }

            p, li { 
              font-size: 11.5pt;
              margin-bottom: 1.2em;
              page-break-inside: avoid;
            }

            ul, ol { 
              margin-bottom: 1.5em; 
              padding-left: 1.5em; 
            }

            li { 
              margin-bottom: 0.6em; 
            }

            code { 
              font-family: 'JetBrains Mono', monospace; 
              background: #f3f4f6; 
              padding: 2px 5px; 
              border-radius: 4px; 
              font-size: 0.95em;
              color: #2563eb;
              font-weight: 500;
            }

            pre { 
              background: #0f172a; 
              color: #f8fafc; 
              padding: 20px; 
              border-radius: 12px; 
              font-family: 'JetBrains Mono', monospace;
              margin: 2em 0;
              white-space: pre-wrap;
              font-size: 10pt;
              line-height: 1.5;
              page-break-inside: avoid;
              border: 1px solid #1e293b;
            }

            blockquote {
              margin: 2em 0;
              padding: 10px 20px;
              border-left: 4px solid #3b82f6;
              background: #eff6ff;
              color: #1e40af;
              font-style: italic;
              page-break-inside: avoid;
            }

            .variable {
              color: #b45309;
              font-weight: 600;
              background: #fffbeb;
              padding: 1px 3px;
              border-radius: 3px;
            }
          </style>
        </head>
        <body>
          <div class="content-wrapper">
            ${processedHtml.replace(/\{\{(.*?)\}\}/g, '<span class="variable">{{$1}}</span>')}
          </div>
        </body>
        </html>`;

      if (ext === 'pdf') {
        const html2pdf = (window as any).html2pdf;
        if (!html2pdf) {
          alert('PDF library is still loading. Please try again in a second.');
          return;
        }
        const element = document.createElement('div');
        element.innerHTML = exportHtml;
        document.body.appendChild(element);
        
        const opt = {
          margin: [15, 15],
          filename: 'prompt.pdf',
          image: { type: 'jpeg', quality: 1 },
          html2canvas: { 
            scale: 2, 
            useCORS: true,
            letterRendering: true,
            logging: false
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        
        try {
          await html2pdf().set(opt).from(element).save();
        } catch (err) {
          console.error('PDF Export Error:', err);
        } finally {
          document.body.removeChild(element);
        }
        return;
      }

      finalContent = exportHtml;
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
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        setIsSaveModalOpen(true);
      }
      // Cleanup: Alt+C
      if (e.altKey && e.code === 'KeyC') {
        e.preventDefault();
        handleCleanup();
      }
      // Review: Alt+R
      if (e.altKey && e.code === 'KeyR') {
        e.preventDefault();
        setIsReviewModalOpen(true);
      }
      // Toggle View Mode: Alt+T
      if (e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        handleToggleView();
      }
      // Toggle Outline: Alt+O
      if (e.altKey && e.code === 'KeyO') {
        e.preventDefault();
        handleToggleOutline();
      }
      // Toggle History: Alt+H
      if (e.altKey && e.code === 'KeyH') {
        e.preventDefault();
        handleToggleHistory();
      }
      // Toggle Theme: Ctrl+Shift+L
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyL') {
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

  if (isAuthenticated === null) {
    return <div className="flex h-screen items-center justify-center bg-[#0f111a]"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (isAuthenticated === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-[#0f111a] font-sans">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-800">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Prompt Workstation</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Please enter the password to access the app.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                autoFocus
              />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
            >
              Unlock App
            </button>
          </form>
        </div>
      </div>
    );
  }

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
