'use client';

import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  MarkerType,
  Connection,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CourseNode from './CourseNode';
import { administracionNodes, administracionEdges } from '../../lib/data/flowcharts/administracion';
import { Moon, Sun, Edit3, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

function HeaderNode({ data }: { data: any }) {
  return (
    <div className={`w-48 text-center border-b-2 pb-2 ${data.isDark ? 'border-gray-700' : 'border-gray-300'}`}>
      <h3 className={`font-black uppercase tracking-widest text-xs mb-1 ${data.isDark ? 'text-gray-200' : 'text-gray-800'}`}>{data.label}</h3>
      <div className="flex items-center justify-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${data.isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>{data.coursesCount} cursos</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${data.isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>{data.credits} créd.</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  courseNode: CourseNode,
  headerNode: HeaderNode,
};

const CYCLE_HEADERS = [
  { label: 'Ciclo 0', coursesCount: 3, credits: 0 },
  { label: 'Ciclo I', coursesCount: 4, credits: 18 },
  { label: 'Ciclo II', coursesCount: 5, credits: 21 },
  { label: 'Ciclo III', coursesCount: 5, credits: 20 },
  { label: 'Ciclo IV', coursesCount: 5, credits: 18 },
  { label: 'Ciclo V', coursesCount: 5, credits: 21 },
  { label: 'Ciclo VI', coursesCount: 5, credits: 19 },
  { label: 'Ciclo VII', coursesCount: 5, credits: 19 },
  { label: 'Ciclo VIII', coursesCount: 5, credits: 19 },
  { label: 'Ciclo IX', coursesCount: 4, credits: 15 },
  { label: 'Ciclo X', coursesCount: 3, credits: 13 },
];

export default function InteractiveFlowchart() {
  const [completedCourses, setCompletedCourses] = useState<Set<string>>(new Set());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const getStatus = useCallback((nodeId: string, currentEdges: Edge[]): 'locked' | 'unlocked' | 'completed' => {
    if (completedCourses.has(nodeId)) return 'completed';
    const prerequisites = currentEdges.filter(e => e.target === nodeId).map(e => e.source);
    if (prerequisites.length === 0) return 'unlocked';
    const allPrerequisitesCompleted = prerequisites.every(reqId => completedCourses.has(reqId));
    return allPrerequisitesCompleted ? 'unlocked' : 'locked';
  }, [completedCourses]);

  const toggleCourse = useCallback((id: string) => {
    if (isEditMode) return; // Disable toggle in edit mode
    setCompletedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [isEditMode]);

  const initialNodes: Node[] = useMemo(() => {
    const cycleCounts: Record<number, number> = {};
    const nodes: Node[] = [];

    CYCLE_HEADERS.forEach((header, cycle) => {
      nodes.push({
        id: `header-${cycle}`,
        type: 'headerNode',
        position: { x: cycle * 280, y: -20 },
        draggable: false,
        selectable: false,
        data: { ...header, isDark: isDarkMode },
      });
    });

    administracionNodes.forEach((course) => {
      const cycle = course.cycle;
      if (cycleCounts[cycle] === undefined) cycleCounts[cycle] = 0;
      
      const x = cycle * 280;
      const y = cycleCounts[cycle] * 120 + 80;
      
      cycleCounts[cycle]++;

      nodes.push({
        id: course.id,
        type: 'courseNode',
        position: { x, y },
        data: {
          ...course,
          status: 'locked',
          id: course.id,
          isEditMode: isEditMode,
        },
      });
    });

    return nodes;
  }, [isDarkMode, isEditMode]);

  const initialEdges: Edge[] = useMemo(() => {
    return administracionEdges.map((edge, i) => ({
      id: `e-${edge.source}-${edge.target}-${i}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: false,
      style: { stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isDarkMode ? '#475569' : '#cbd5e1',
      },
    }));
  }, [isDarkMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isEditMode) return;
      if (node.type === 'courseNode') {
        toggleCourse(node.id);
      }
    },
    [isEditMode, toggleCourse]
  );

  // Allow edge connections in edit mode
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'smoothstep',
      style: { stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: isDarkMode ? '#475569' : '#cbd5e1' }
    }, eds)),
    [setEdges, isDarkMode]
  );

  useEffect(() => {
    setNodes((nds) => {
      let changed = false;
      const nextNodes = nds.map((node) => {
        if (node.type === 'headerNode') {
          if (node.data.isDark !== isDarkMode) {
            changed = true;
            return { ...node, data: { ...node.data, isDark: isDarkMode } };
          }
          return node;
        }
        if (node.type === 'courseNode') {
          const newStatus = getStatus(node.id, edges);
          if (node.data.status !== newStatus || node.data.isEditMode !== isEditMode) {
            changed = true;
            return {
              ...node,
              data: {
                ...node.data,
                status: newStatus,
                isEditMode: isEditMode,
              },
            };
          }
        }
        return node;
      });
      return changed ? nextNodes : nds;
    });

    setEdges((eds) => {
      let changed = false;
      const nextEdges = eds.map((edge) => {
        const isSourceCompleted = completedCourses.has(edge.source);
        const defaultColor = isDarkMode ? '#475569' : '#cbd5e1';
        const expectedAnimated = isSourceCompleted && !isEditMode;
        const expectedStroke = isSourceCompleted && !isEditMode ? '#22c55e' : defaultColor;
        const expectedWidth = isSourceCompleted && !isEditMode ? 3 : 2;

        if (
          edge.animated !== expectedAnimated ||
          edge.style?.stroke !== expectedStroke ||
          edge.style?.strokeWidth !== expectedWidth ||
          (edge.markerEnd as any)?.color !== expectedStroke
        ) {
          changed = true;
          return {
            ...edge,
            animated: expectedAnimated,
            style: { 
              stroke: expectedStroke,
              strokeWidth: expectedWidth 
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: expectedStroke,
            },
          };
        }
        return edge;
      });
      return changed ? nextEdges : eds;
    });
  }, [completedCourses, getStatus, setNodes, setEdges, edges, isDarkMode, isEditMode]);

  const handleExportData = () => {
    const exportedEdges = edges.map(e => ({ source: e.source, target: e.target }));
    console.log("Nuevos Enlaces Exportados:", JSON.stringify(exportedEdges, null, 2));
    alert("¡Enlaces exportados a la consola del navegador! Puedes copiarlos para actualizar administracion.ts");
  };

  return (
    <div className={`w-full h-[750px] border rounded-xl overflow-hidden shadow-inner transition-colors duration-300 relative ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-slate-50 border-gray-200'}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={isEditMode ? onConnect : undefined}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={isEditMode}
        elementsSelectable={isEditMode}
      >
        <Background gap={24} size={2} color={isDarkMode ? "#334155" : "#e2e8f0"} />
        <Controls className={isDarkMode ? "fill-white bg-gray-800 text-white border-gray-700" : ""} />
        
        <Panel position="top-right" className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`rounded-full h-10 w-10 p-0 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            className={`rounded-full h-10 px-4 font-bold ${isEditMode ? 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600' : (isDarkMode ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100')}`}
          >
            {isEditMode ? <><Eye className="w-4 h-4 mr-2" /> Modo Vista</> : <><Edit3 className="w-4 h-4 mr-2" /> Modo Edición</>}
          </Button>

          {isEditMode && (
            <Button 
              size="sm"
              onClick={handleExportData}
              className="rounded-full h-10 px-4 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            >
              <Save className="w-4 h-4 mr-2" /> Exportar
            </Button>
          )}
        </Panel>
      </ReactFlow>

      {/* Floating Edit Mode indicator */}
      {isEditMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full font-medium text-sm flex items-center gap-3 shadow-2xl pointer-events-none z-50 animate-bounce">
          <Edit3 className="w-5 h-5 text-emerald-400" />
          <span>Arrastra los nodos para moverlos. Conecta los puntos para crear enlaces. Selecciona una línea y presiona Backspace para borrarla.</span>
        </div>
      )}
    </div>
  );
}
