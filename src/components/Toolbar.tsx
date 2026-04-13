import React, { useState, useRef, useEffect } from 'react';
import { List, Clock, Wand2, Moon, Sun, Download, FileJson, FileCode2, FileText, Sparkles, ArrowRightLeft, Bot, Save, FolderOpen, Keyboard, X, MoreVertical, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface ToolbarProps {
  format: 'auto' | 'markdown' | 'json' | 'xml';
  setFormat: (format: 'auto' | 'markdown' | 'json' | 'xml') => void;
  actualFormat: 'markdown' | 'json' | 'xml';
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  sidebarMode: 'outline' | 'history' | 'none';
  setSidebarMode: (mode: 'outline' | 'history' | 'none') => void;
  onCleanup: () => void;
  onSave: () => void;
  onDownload: (ext: string) => void;
  onConvert: (to: 'markdown' | 'json' | 'xml') => void;
  onReview: () => void;
  stats: { lines: number; tokens: number };
  viewMode: 'text' | 'tree';
  setViewMode: (mode: 'text' | 'tree') => void;
}

export function Toolbar({
  format, setFormat, actualFormat, theme, setTheme, sidebarMode, setSidebarMode,
  onCleanup, onSave, onDownload, onConvert, onReview, stats, viewMode, setViewMode
}: ToolbarProps) {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const downloadRef = useRef<HTMLDivElement>(null);
  const convertRef = useRef<HTMLDivElement>(null);
  const hotkeysRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(event.target as Node)) setDownloadOpen(false);
      if (convertRef.current && !convertRef.current.contains(event.target as Node)) setConvertOpen(false);
      if (hotkeysRef.current && !hotkeysRef.current.contains(event.target as Node)) setHotkeysOpen(false);
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hotkeys = [
    { key: 'Ctrl + S', desc: 'Save Version' },
    { key: 'Ctrl + B', desc: 'Bold Text' },
    { key: 'Ctrl + I', desc: 'Italic Text' },
    { key: 'Ctrl + Shift + V', desc: 'Insert {{Variable}}' },
    { key: 'Alt + Enter', desc: 'Close XML Tag' },
    { key: 'Alt + C', desc: 'Cleanup Text' },
    { key: 'Alt + R', desc: 'AI Review' },
    { key: 'Alt + T', desc: 'Toggle Tree/Text View' },
    { key: 'Alt + O', desc: 'Toggle Outline' },
    { key: 'Alt + H', desc: 'Toggle History' },
    { key: 'Ctrl + Shift + L', desc: 'Toggle Theme' },
  ];

  const FormatButton = ({ type, icon: Icon, label }: { type: 'markdown' | 'json' | 'xml', icon: any, label: string }) => (
    <button
      onClick={() => setFormat(type)}
      className={cn(
        "px-2.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 relative",
        (format === type || (format === 'auto' && actualFormat === type)) 
          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600" 
          : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden md:inline">{label}</span>
      {format === 'auto' && actualFormat === type && (
        <span className="text-[8px] leading-none uppercase font-bold text-blue-500 absolute -top-1 -right-1 bg-white dark:bg-gray-800 px-1 py-0.5 rounded border border-blue-100 dark:border-blue-900 shadow-sm">auto</span>
      )}
    </button>
  );

  return (
    <div className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f111a] flex items-center justify-between px-3 md:px-4 shrink-0 z-40">
      {/* Left: Format Selection */}
      <div className="flex items-center gap-1 md:gap-2">
        <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setFormat(format === 'auto' ? actualFormat : 'auto')}
            className={cn(
              "p-1.5 rounded-md transition-all flex items-center justify-center",
              format === 'auto' 
                ? "bg-blue-500 text-white shadow-md" 
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
            title="Toggle Auto-detection"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
          <FormatButton type="markdown" icon={FileText} label="Markdown" />
          <FormatButton type="json" icon={FileJson} label="JSON" />
          <FormatButton type="xml" icon={FileCode2} label="XML" />
        </div>
      </div>

      {/* Center: Stats (Hidden on mobile) */}
      <div className="hidden lg:flex items-center gap-4 text-[11px] font-medium text-gray-500 bg-gray-50 dark:bg-gray-800/30 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {stats.lines} lines
        </div>
        <div className="w-px h-3 bg-gray-300 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {stats.tokens} tokens
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Primary Actions */}
        <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 p-1 rounded-lg border border-blue-100 dark:border-blue-900/30">
          <button
            onClick={onSave}
            className="px-2.5 md:px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Save Version (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            onClick={() => setSidebarMode(sidebarMode === 'history' ? 'none' : 'history')}
            className={cn(
              "px-2.5 md:px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
              sidebarMode === 'history' 
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-blue-600 dark:text-blue-400 hover:bg-white/50 dark:hover:bg-gray-800/50"
            )}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open</span>
          </button>
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-0.5 hidden sm:block" />

        {/* Tools & More (Desktop) */}
        <div className="hidden md:flex items-center gap-1.5">
          {/* Convert Dropdown */}
          <div className="relative" ref={convertRef}>
            <button
              onClick={() => setConvertOpen(!convertOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
              title="Convert Format"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
            {convertOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Convert to</div>
                {['markdown', 'json', 'xml'].map(ext => (
                  <button
                    key={ext}
                    onClick={() => { onConvert(ext as any); setConvertOpen(false); }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors capitalize"
                  >
                    {ext}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onCleanup}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
            title="Cleanup Text"
          >
            <Wand2 className="w-4 h-4" />
          </button>

          <button
            onClick={onReview}
            className="p-2 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
            title="AI Review"
          >
            <Bot className="w-4 h-4" />
          </button>

          <div className="relative" ref={downloadRef}>
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            {downloadOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Format</div>
                {['md', 'json', 'xml', 'txt', 'doc', 'pdf'].map(ext => (
                  <button
                    key={ext}
                    onClick={() => { onDownload(ext); setDownloadOpen(false); }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase"
                  >
                    .{ext}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu Trigger */}
        <div className="md:hidden relative" ref={mobileMenuRef}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {mobileMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <button onClick={() => { onCleanup(); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Wand2 className="w-4 h-4" /> Cleanup
              </button>
              <button onClick={() => { onReview(); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <Bot className="w-4 h-4" /> AI Review
              </button>
              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
              <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase">Stats</div>
              <div className="px-4 py-1 text-xs text-gray-500">
                {stats.lines} lines • {stats.tokens} tokens
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-0.5" />

        {/* Global Settings */}
        <div className="flex items-center gap-1">
          <div className="relative" ref={hotkeysRef}>
            <button
              onClick={() => setHotkeysOpen(!hotkeysOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
            {hotkeysOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase text-gray-400 tracking-widest">Hotkeys</h3>
                  <button onClick={() => setHotkeysOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                  {hotkeys.map(h => (
                    <div key={h.key} className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">{h.desc}</span>
                      <kbd className="px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[10px] text-gray-900 dark:text-gray-100 shadow-sm">{h.key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

