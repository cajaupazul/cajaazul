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
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CourseNode from './CourseNode';
import { administracionNodes, administracionEdges } from '../../lib/data/flowcharts/administracion';

const nodeTypes = {
  courseNode: CourseNode,
};

export default function InteractiveFlowchart() {
  const [completedCourses, setCompletedCourses] = useState<Set<string>>(new Set());

  // Calcular status dinámico para cada nodo
  const getStatus = useCallback((nodeId: string): 'locked' | 'unlocked' | 'completed' => {
    if (completedCourses.has(nodeId)) return 'completed';

    // Para que esté "unlocked", todos sus pre-requisitos deben estar "completed"
    // Buscamos si tiene pre-requisitos
    const prerequisites = administracionEdges.filter(e => e.target === nodeId).map(e => e.source);
    
    // Si no tiene pre-requisitos, está unlocked por defecto
    if (prerequisites.length === 0) return 'unlocked';

    // Si tiene pre-requisitos, todos deben estar completados
    const allPrerequisitesCompleted = prerequisites.every(reqId => completedCourses.has(reqId));
    
    return allPrerequisitesCompleted ? 'unlocked' : 'locked';
  }, [completedCourses]);

  const toggleCourse = useCallback((id: string) => {
    setCompletedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Opcional: si desmarcamos uno, deberíamos desmarcar los que dependían de él?
        // Por ahora lo hacemos simple.
      } else {
        // Solo podemos marcarlo si está desbloqueado
        // (Aunque para pruebas podríamos permitir forzarlo, pero mejor seguimos la regla)
        // Para simplificar, permitiremos marcar/desmarcar libremente.
        next.add(id);
      }
      return next;
    });
  }, []);

  // Preparar nodos iniciales calculando su posición automáticamente por ciclo
  const initialNodes: Node[] = useMemo(() => {
    const cycleCounts: Record<number, number> = {};

    return administracionNodes.map((course) => {
      const cycle = course.cycle;
      if (cycleCounts[cycle] === undefined) cycleCounts[cycle] = 0;
      
      const x = cycle * 280; // Separación horizontal entre ciclos
      const y = cycleCounts[cycle] * 120 + 50; // Separación vertical
      
      cycleCounts[cycle]++;

      return {
        id: course.id,
        type: 'courseNode',
        position: { x, y },
        data: {
          ...course,
          status: 'locked', // Se actualiza luego en el effect
          onToggle: toggleCourse,
          id: course.id,
        },
      };
    });
  }, [toggleCourse]);

  const initialEdges: Edge[] = useMemo(() => {
    return administracionEdges.map((edge, i) => ({
      id: `e-${edge.source}-${edge.target}-${i}`,
      source: edge.source,
      target: edge.target,
      animated: true, // Animado para que parezca flujo
      style: { stroke: '#9ca3af', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#9ca3af',
      },
    }));
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Actualizar nodos cuando cambian los cursos completados
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const newStatus = getStatus(node.id);
        // Si el estado no cambió, retornar el mismo objeto para no re-renderizar
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

    // Actualizar colores de las flechas
    setEdges((eds) => 
      eds.map((edge) => {
        const isSourceCompleted = completedCourses.has(edge.source);
        return {
          ...edge,
          animated: isSourceCompleted,
          style: { 
            stroke: isSourceCompleted ? '#22c55e' : '#9ca3af', // Verde si el origen está completado
            strokeWidth: isSourceCompleted ? 3 : 2 
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSourceCompleted ? '#22c55e' : '#9ca3af',
          },
        };
      })
    );
  }, [completedCourses, getStatus, setNodes, setEdges]);

  return (
    <div className="w-full h-[600px] bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shadow-inner">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={24} size={2} color="#e5e7eb" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
