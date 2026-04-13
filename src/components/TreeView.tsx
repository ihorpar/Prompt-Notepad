import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface TreeViewProps {
  data: any;
  name?: string;
  isLast?: boolean;
  key?: string | number;
}

export function TreeView({ data, name, isLast = true }: TreeViewProps) {
  const [expanded, setExpanded] = useState(true);

  const isObject = data !== null && typeof data === 'object';
  const isArray = Array.isArray(data);

  if (!isObject) {
    return (
      <div className="pl-4 font-mono text-sm flex">
        {name && <span className="text-blue-400 mr-1">{name}:</span>}
        <span className={cn(
          typeof data === 'string' ? 'text-green-400' : 'text-orange-400'
        )}>
          {typeof data === 'string' ? `"${data}"` : String(data)}
        </span>
        {!isLast && <span className="text-gray-500">,</span>}
      </div>
    );
  }

  const keys = Object.keys(data);
  const isEmpty = keys.length === 0;

  return (
    <div className="font-mono text-sm">
      <div 
        className="flex items-center cursor-pointer hover:bg-gray-800/50 rounded px-1 -ml-1"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="w-4 h-4 inline-flex items-center justify-center mr-1">
          {!isEmpty && (
            expanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
        </span>
        {name && <span className="text-blue-400 mr-1">{name}:</span>}
        <span className="text-gray-500">{isArray ? '[' : '{'}</span>
        {!expanded && !isEmpty && <span className="text-gray-500 mx-1">...</span>}
        {!expanded && <span className="text-gray-500">{isArray ? ']' : '}'}{!isLast && ','}</span>}
      </div>
      
      {expanded && !isEmpty && (
        <div className="pl-4 border-l border-gray-700/50 ml-1.5">
          {keys.map((key, index) => (
            <TreeView 
              key={key} 
              data={data[key as keyof typeof data]} 
              name={isArray ? undefined : key} 
              isLast={index === keys.length - 1}
            />
          ))}
        </div>
      )}
      
      {expanded && (
        <div className="pl-1 text-gray-500">
          {isArray ? ']' : '}'}{!isLast && ','}
        </div>
      )}
    </div>
  );
}
