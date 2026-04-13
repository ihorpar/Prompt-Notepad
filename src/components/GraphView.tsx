import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 50; // approximate base height

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    // Estimate height based on number of keys
    const height = 40 + (node.data.items ? node.data.items.length * 24 : 0);
    dagreGraph.setNode(node.id, { width: nodeWidth, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
    return newNode;
  });

  return { nodes: newNodes, edges };
};

const CustomNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-sm text-sm font-mono min-w-[200px]">
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="bg-gray-100 dark:bg-gray-700 px-2 py-1 border-b border-gray-300 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-200 rounded-t">
        {data.label}
      </div>
      <div className="p-2 flex flex-col gap-1">
        {data.items && data.items.map((item: any, i: number) => (
          <div key={i} className="flex justify-between items-center text-xs">
            <span className="text-blue-600 dark:text-blue-400 mr-4">{item.key}:</span>
            <span className={item.isRef ? 'text-gray-500 italic' : 'text-green-600 dark:text-green-400 truncate max-w-[150px]'}>
              {item.value}
            </span>
          </div>
        ))}
        {(!data.items || data.items.length === 0) && (
          <div className="text-gray-400 text-xs italic">empty</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export function GraphView({ data }: { data: any }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!data) return;

    const newNodes: any[] = [];
    const newEdges: any[] = [];
    let idCounter = 0;

    const traverse = (obj: any, parentId: string | null = null, edgeLabel: string = '') => {
      const currentId = `node_${idCounter++}`;
      
      const isArray = Array.isArray(obj);
      const label = isArray ? `Array [${obj.length}]` : 'Object';
      
      const items: any[] = [];
      
      if (obj !== null && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          if (value !== null && typeof value === 'object') {
            const isArr = Array.isArray(value);
            const size = isArr ? value.length : Object.keys(value).length;
            items.push({ key, value: isArr ? `[${size} items]` : `{${size} keys}`, isRef: true });
            traverse(value, currentId, key);
          } else {
            items.push({ key, value: String(value), isRef: false });
          }
        });
      }

      newNodes.push({
        id: currentId,
        type: 'custom',
        data: { label: parentId ? edgeLabel : 'Root', items },
        position: { x: 0, y: 0 },
      });

      if (parentId) {
        newEdges.push({
          id: `e_${parentId}_${currentId}`,
          source: parentId,
          target: currentId,
          label: edgeLabel,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#9ca3af' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9ca3af',
          },
        });
      }
      
      return currentId;
    };

    traverse(data);

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [data, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-[#0f111a]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
      >
        <Background color="#ccc" gap={16} />
        <Controls />
        <MiniMap 
          nodeColor={(n) => {
            return '#9ca3af';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
