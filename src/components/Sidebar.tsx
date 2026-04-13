import React, { useState, useEffect, useMemo } from 'react';
import { format as formatDate } from 'date-fns';
import { Clock, List, X, ChevronRight, ChevronDown } from 'lucide-react';
import { PromptVersion } from '../lib/db';
import { cn } from '../lib/utils';

interface SidebarProps {
  mode: 'outline' | 'history' | 'none';
  format: 'markdown' | 'json' | 'xml';
  onClose: () => void;
  content: string;
  history: PromptVersion[];
  onRestore: (version: PromptVersion) => void;
  onNavigate?: (line: number) => void;
  onUpdateVersionName?: (id: number, name: string) => void;
}

interface OutlineNode {
  id: string;
  text: string;
  level: number;
  line: number;
  children: OutlineNode[];
}

export function Sidebar({ mode, format, onClose, content, history, onRestore, onNavigate, onUpdateVersionName }: SidebarProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const outlineTree = useMemo(() => {
    if (format === 'markdown') {
      const lines = content.split('\n');
      const root: OutlineNode = { id: 'root', text: 'root', level: 0, line: 0, children: [] };
      const stack: OutlineNode[] = [root];

      lines.forEach((line, index) => {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          const level = match[1].length;
          const node: OutlineNode = {
            id: `md-${index}`,
            text: match[2],
            level,
            line: index + 1,
            children: []
          };

          while (stack.length > 1 && stack[stack.length - 1].level >= level) {
            stack.pop();
          }
          stack[stack.length - 1].children.push(node);
          stack.push(node);
        }
      });
      return root.children;
    } else if (format === 'xml') {
      const lines = content.split('\n');
      const root: OutlineNode = { id: 'root', text: 'root', level: 0, line: 0, children: [] };
      const stack: OutlineNode[] = [root];
      
      lines.forEach((line, index) => {
        const openTagMatch = line.match(/<([a-zA-Z0-9_-]+)[^>]*>(?!.*<\/\1>)/);
        const closeTagMatch = line.match(/<\/([a-zA-Z0-9_-]+)>/);
        
        if (openTagMatch && !line.includes('/>') && !line.includes(`</${openTagMatch[1]}>`)) {
          const node: OutlineNode = {
            id: `xml-${index}`,
            text: openTagMatch[1],
            level: stack.length,
            line: index + 1,
            children: []
          };
          stack[stack.length - 1].children.push(node);
          stack.push(node);
        } else if (closeTagMatch) {
          if (stack.length > 1 && stack[stack.length - 1].text === closeTagMatch[1]) {
            stack.pop();
          }
        } else if (line.match(/<([a-zA-Z0-9_-]+)[^>]*\/>/)) {
          const match = line.match(/<([a-zA-Z0-9_-]+)[^>]*\/>/);
          if (match) {
            const node: OutlineNode = {
              id: `xml-sc-${index}`,
              text: match[1],
              level: stack.length,
              line: index + 1,
              children: []
            };
            stack[stack.length - 1].children.push(node);
          }
        }
      });
      return root.children;
    }
    return [];
  }, [content, format]);

  useEffect(() => {
    const allIds = new Set<string>();
    const traverse = (nodes: OutlineNode[]) => {
      nodes.forEach(n => {
        allIds.add(n.id);
        traverse(n.children);
      });
    };
    traverse(outlineTree);
    setExpandedNodes(allIds);
  }, [outlineTree]);

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderOutlineNode = (node: OutlineNode) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id} className="flex flex-col">
        <div
          className={cn(
            "flex items-center text-sm py-1 px-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded cursor-pointer text-gray-700 dark:text-gray-300",
          )}
          style={{ paddingLeft: `${(node.level - 1) * 12 + 8}px` }}
          onClick={() => {
            if (onNavigate) onNavigate(node.line);
          }}
        >
          <span 
            className="w-4 h-4 mr-1 flex items-center justify-center cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 rounded shrink-0"
            onClick={(e) => hasChildren && toggleNode(node.id, e)}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : (
              <span className="w-3 h-3" />
            )}
          </span>
          <span className="truncate">{node.text}</span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(renderOutlineNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mode !== 'none' && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}
      
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f111a] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:shadow-none md:bg-gray-50 dark:md:bg-gray-900/50 md:z-auto",
        mode === 'none' ? "-translate-x-full" : "translate-x-0"
      )}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
            {mode === 'outline' ? <List className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {mode === 'outline' ? 'Outline' : 'History'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {mode === 'outline' && (
            <div className="space-y-1">
              {format === 'json' ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <List className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">Outline not available for JSON.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Use Tree View for structural navigation.</p>
                </div>
              ) : outlineTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <p className="text-xs text-gray-500 font-medium">No outline items found.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Add headings to see them here.</p>
                </div>
              ) : (
                outlineTree.map(renderOutlineNode)
              )}
            </div>
          )}

          {mode === 'history' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">No history yet.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Saved versions will appear here.</p>
                </div>
              ) : (
                history.slice().reverse().map((version, i) => (
                  <div
                    key={version.id || i}
                    className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer bg-white dark:bg-gray-800/50 transition-all group shadow-sm hover:shadow-md"
                    onClick={() => onRestore(version)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-medium text-gray-400">
                        {formatDate(version.timestamp, 'MMM d, HH:mm')}
                      </div>
                      <div className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-[9px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider">
                        {version.format}
                      </div>
                    </div>
                    
                    {editingId === version.id ? (
                      <input
                        autoFocus
                        className="w-full text-sm bg-gray-100 dark:bg-gray-900 border-none rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => {
                          if (onUpdateVersionName && version.id) {
                            onUpdateVersionName(version.id, editName);
                          }
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (onUpdateVersionName && version.id) {
                              onUpdateVersionName(version.id, editName);
                            }
                            setEditingId(null);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div 
                        className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center justify-between gap-2"
                        onClick={(e) => {
                          if (e.detail === 2) { // Double click to edit
                            e.stopPropagation();
                            setEditingId(version.id || null);
                            setEditName(version.name);
                          }
                        }}
                      >
                        <span className="truncate">{version.name || 'Untitled Version'}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-[10px] text-gray-500 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(version.id || null);
                            setEditName(version.name);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                    
                    <div className="text-[11px] text-gray-500 truncate mt-1.5 opacity-80">
                      {version.content.slice(0, 60).replace(/\n/g, ' ') || 'Empty'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
