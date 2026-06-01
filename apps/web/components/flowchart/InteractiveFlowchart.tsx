'use client';

import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CourseNode from './CourseNode';
import { administracionNodes, administracionEdges } from '../../lib/data/flowcharts/administracion';

function HeaderNode({ data }: { data: any }) {
  return (
    <div className="w-48 text-center border-b-2 border-gray-300 pb-2">
      <h3 className="font-black text-gray-800 uppercase tracking-widest text-xs mb-1">{data.label}</h3>
      <div className="flex items-center justify-center gap-2">
        <span className="text-[10px] text-gray-500 font-bold bg-white px-2 py-0.5 rounded-full shadow-sm">{data.coursesCount} cursos</span>
        <span className="text-[10px] text-gray-500 font-bold bg-white px-2 py-0.5 rounded-full shadow-sm">{data.credits} créd.</span>
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

  const getStatus = useCallback((nodeId: string): 'locked' | 'unlocked' | 'completed' => {
    if (completedCourses.has(nodeId)) return 'completed';
    const prerequisites = administracionEdges.filter(e => e.target === nodeId).map(e => e.source);
    if (prerequisites.length === 0) return 'unlocked';
    const allPrerequisitesCompleted = prerequisites.every(reqId => completedCourses.has(reqId));
    return allPrerequisitesCompleted ? 'unlocked' : 'locked';
  }, [completedCourses]);

  const toggleCourse = useCallback((id: string) => {
    setCompletedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const initialNodes: Node[] = useMemo(() => {
    const cycleCounts: Record<number, number> = {};
    const nodes: Node[] = [];

    // Add Headers
    CYCLE_HEADERS.forEach((header, cycle) => {
      nodes.push({
        id: `header-${cycle}`,
        type: 'headerNode',
        position: { x: cycle * 280, y: -20 },
        draggable: false,
        selectable: false,
        data: header,
      });
    });

    // Add Courses
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
          onToggle: toggleCourse,
          id: course.id,
        },
      });
    });

    return nodes;
  }, [toggleCourse]);

  const initialEdges: Edge[] = useMemo(() => {
    return administracionEdges.map((edge, i) => ({
      id: `e-${edge.source}-${edge.target}-${i}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep', // Líneas rectas con esquinas redondeadas
      animated: false,
      style: { stroke: '#cbd5e1', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#cbd5e1',
      },
    }));
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type !== 'courseNode') return node;
        const newStatus = getStatus(node.id);
        if (node.data.status === newStatus) return node;
        return {
          ...node,
          data: {
            ...node.data,
            status: newStatus,
          },
        };
      })
    );

    setEdges((eds) => 
      eds.map((edge) => {
        const isSourceCompleted = completedCourses.has(edge.source);
        return {
          ...edge,
          animated: isSourceCompleted,
          style: { 
            stroke: isSourceCompleted ? '#22c55e' : '#cbd5e1',
            strokeWidth: isSourceCompleted ? 3 : 2 
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSourceCompleted ? '#22c55e' : '#cbd5e1',
          },
        };
      })
    );
  }, [completedCourses, getStatus, setNodes, setEdges]);

  return (
    <div className="w-full h-[700px] bg-slate-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={24} size={2} color="#e2e8f0" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
