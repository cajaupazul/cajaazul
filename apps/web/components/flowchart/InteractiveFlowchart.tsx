'use client';

import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
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
  Panel,
  MiniMap,
  BaseEdge,
  EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CourseNode from './CourseNode';
import SmartEdge from './SmartEdge';
import { administracionNodes, administracionEdges as defaultEdges } from '../../lib/data/flowcharts/administracion';
import { Moon, Sun, Edit3, Save, Eye, Loader2, CheckCircle, AlertCircle, Trash2, Info, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Header node
// ---------------------------------------------------------------------------
function HeaderNode({ data }: { data: any }) {
  return (
    <div className={`w-48 text-center border-b-2 pb-2 ${data.isDark ? 'border-gray-700' : 'border-gray-300'}`}>
      <h3 className={`font-black uppercase tracking-widest text-xs mb-1 ${data.isDark ? 'text-gray-200' : 'text-gray-800'}`}>
        {data.label}
      </h3>
      <div className="flex items-center justify-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${data.isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
          {data.coursesCount} cursos
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${data.isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
          {data.credits} créd.
        </span>
      </div>
    </div>
  );
}

// Custom hash function to deterministically assign colors and offsets
function getEdgeHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const LIGHT_PALETTE = [
  '#d946ef', // Fuchsia
  '#a855f7', // Purple
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#0ea5e9', // Sky
  '#0d9488', // Teal
  '#16a34a', // Green
  '#ca8a04', // Yellow
  '#ea580c', // Orange
  '#e11d48', // Rose
  '#be185d', // Pink
  '#4f46e5', // Royal Blue
  '#059669', // Emerald
  '#b45309', // Amber
  '#dc2626', // Red
  '#0284c7', // Dark Sky
];

const DARK_PALETTE = [
  '#f472b6', // Pink
  '#f43f5e', // Rose
  '#fb923c', // Orange
  '#fbbf24', // Yellow
  '#a78bfa', // Purple
  '#818cf8', // Indigo
  '#60a5fa', // Blue
  '#38bdf8', // Sky
  '#2dd4bf', // Cyan/Teal
  '#34d399', // Emerald
  '#4ade80', // Green
  '#a3e635', // Lime
  '#ec4899', // Bright Fuchsia
];

function getEdgeColor(edgeId: string, isDarkMode: boolean): string {
  const hash = getEdgeHashCode(edgeId);
  const palette = isDarkMode ? DARK_PALETTE : LIGHT_PALETTE;
  return palette[hash % palette.length];
}

// Rounded corner path generator
function getRoundedPath(points: { x: number; y: number }[], radius: number = 8): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const d1x = prev.x - curr.x;
    const d1y = prev.y - curr.y;
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);

    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);

    const r = Math.min(radius, len1 / 2, len2 / 2);

    if (r > 0) {
      const p1x = curr.x + (d1x / len1) * r;
      const p1y = curr.y + (d1y / len1) * r;
      const p2x = curr.x + (d2x / len2) * r;
      const p2y = curr.y + (d2y / len2) * r;

      path += ` L ${p1x} ${p1y} Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
    } else {
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

const nodeTypes = { courseNode: CourseNode, headerNode: HeaderNode };
const edgeTypes = { smart: SmartEdge };

const CYCLE_HEADERS = [
  { label: 'Ciclo 0',    coursesCount: 3, credits: 0 },
  { label: 'Ciclo I',    coursesCount: 4, credits: 18 },
  { label: 'Ciclo II',   coursesCount: 5, credits: 21 },
  { label: 'Ciclo III',  coursesCount: 5, credits: 20 },
  { label: 'Ciclo IV',   coursesCount: 5, credits: 18 },
  { label: 'Ciclo V',    coursesCount: 5, credits: 21 },
  { label: 'Ciclo VI',   coursesCount: 5, credits: 19 },
  { label: 'Ciclo VII',  coursesCount: 5, credits: 19 },
  { label: 'Ciclo VIII', coursesCount: 5, credits: 19 },
  { label: 'Ciclo IX',   coursesCount: 4, credits: 15 },
  { label: 'Ciclo X',    coursesCount: 3, credits: 13 },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildEdgeObject(
  source: string,
  target: string,
  idx: number,
  color: string,
  isEditMode: boolean
): Edge {
  return {
    id: `e-${source}-${target}-${idx}`,
    source,
    target,
    type: 'smart',
    animated: false,
    deletable: isEditMode,
    style: { stroke: color, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function InteractiveFlowchart() {
  const [completedCourses, setCompletedCourses] = useState<Set<string>>(new Set());
  const [isDarkMode, setIsDarkMode]   = useState(false);
  const [isEditMode, setIsEditMode]   = useState(false);
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('idle');
  const [loadedEdges, setLoadedEdges] = useState<{ source: string; target: string }[] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ----- Fullscreen handlers ------------------------------------------------
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    const hasNativeFullscreen = typeof containerRef.current.requestFullscreen === 'function';

    if (hasNativeFullscreen) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        document.exitFullscreen();
      }
    } else {
      // iOS iPhone / Fallback toggle
      setIsFullscreen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  // ----- Load edges from Supabase on mount ----------------------------------
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('flowchart_edges')
        .select('edges')
        .eq('carrera', 'administracion')
        .single();

      if (!error && data && Array.isArray(data.edges) && data.edges.length > 0) {
        setLoadedEdges(data.edges);
      } else {
        // Use the default hardcoded edges as seed
        setLoadedEdges(defaultEdges);
      }
    }
    load();
  }, []);

  // ----- Status logic -------------------------------------------------------
  const getStatus = useCallback(
    (nodeId: string, currentEdges: Edge[]): 'locked' | 'unlocked' | 'completed' => {
      if (completedCourses.has(nodeId)) return 'completed';
      const prerequisites = currentEdges.filter(e => e.target === nodeId).map(e => e.source);
      if (prerequisites.length === 0) return 'unlocked';
      return prerequisites.every(id => completedCourses.has(id)) ? 'unlocked' : 'locked';
    },
    [completedCourses]
  );

  const toggleCourse = useCallback((id: string) => {
    setCompletedCourses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ----- Build initial nodes ------------------------------------------------
  const buildInitialNodes = useCallback(
    (editMode: boolean, darkMode: boolean): Node[] => {
      const cycleCounts: Record<number, number> = {};
      const nodes: Node[] = [];

      CYCLE_HEADERS.forEach((header, cycle) => {
        nodes.push({
          id: `header-${cycle}`,
          type: 'headerNode',
          position: { x: cycle * 320, y: -20 },
          draggable: false,
          selectable: false,
          data: { ...header, isDark: darkMode },
        });
      });

      administracionNodes.forEach(course => {
        const cycle = course.cycle;
        if (cycleCounts[cycle] === undefined) cycleCounts[cycle] = 0;
        const x = cycle * 320;
        const y = cycleCounts[cycle] * 150 + 80;
        cycleCounts[cycle]++;

        nodes.push({
          id: course.id,
          type: 'courseNode',
          position: { x, y },
          data: { ...course, status: 'locked', id: course.id, isEditMode: editMode },
        });
      });

      return nodes;
    },
    []
  );

  // ----- Build edges from a raw list ----------------------------------------
  const buildEdges = useCallback(
    (rawEdges: { source: string; target: string }[], editMode: boolean, darkMode: boolean): Edge[] => {
      if (editMode) {
        // In edit mode: bright, thick, selectable
        return rawEdges.map((e, i) => ({
          ...buildEdgeObject(e.source, e.target, i, '#6366f1', true),
          style: { stroke: '#6366f1', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          selected: false,
        }));
      }
      return rawEdges.map((e, i) => {
        const completed = completedCourses.has(e.source);
        const edgeId = `e-${e.source}-${e.target}-${i}`;
        const baseColor = getEdgeColor(edgeId, darkMode);
        const color = completed ? '#22c55e' : baseColor;
        const width = completed ? 3 : 2;
        return {
          ...buildEdgeObject(e.source, e.target, i, color, false),
          animated: completed,
          style: { stroke: color, strokeWidth: width },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      });
    },
    [completedCourses]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Initialize once loadedEdges is available — compute real statuses from loaded edges
  useEffect(() => {
    if (loadedEdges === null) return;
    const rawEdges = buildEdges(loadedEdges, false, false);
    const builtNodes = buildInitialNodes(false, false).map(node => {
      if (node.type !== 'courseNode') return node;
      const prerequisites = rawEdges.filter(e => e.target === node.id).map(e => e.source);
      const status = prerequisites.length === 0 ? 'unlocked' : 'locked';
      return { ...node, data: { ...node.data, status } };
    });
    setNodes(builtNodes);
    setEdges(rawEdges);
  }, [loadedEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hover highlighting: glow courses unlocked by the hovered node ──────
  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    if (isEditMode || node.type !== 'courseNode') return;
    // Find courses for which this node is a prerequisite
    const unlocks = edges.filter(e => e.source === node.id).map(e => e.target);
    if (unlocks.length === 0) return;
    setNodes(nds => nds.map(n =>
      unlocks.includes(n.id)
        ? { ...n, data: { ...n.data, isHighlighted: true } }
        : n
    ));
  }, [isEditMode, edges, setNodes]);

  const onNodeMouseLeave = useCallback((_: React.MouseEvent, node: Node) => {
    if (isEditMode || node.type !== 'courseNode') return;
    setNodes(nds => nds.map(n =>
      n.data?.isHighlighted ? { ...n, data: { ...n.data, isHighlighted: false } } : n
    ));
  }, [isEditMode, setNodes]);

  // Toggle edit mode ---------------------------------------------------
  const enterEditMode = useCallback(() => {
    setIsEditMode(true);
    // Show edges in "edit style" (purple), all nodes look neutral/edit
    setNodes(nds =>
      nds.map(n => {
        if (n.type === 'courseNode') {
          return { ...n, data: { ...n.data, status: 'unlocked', isEditMode: true, isHighlighted: false } };
        }
        return n;
      })
    );
    setEdges(eds =>
      eds.map(e => ({
        ...e,
        deletable: true,
        style: { stroke: '#6366f1', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
        animated: false,
      }))
    );
  }, [setNodes, setEdges]);

  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setNodes(nds =>
      nds.map(n => {
        if (n.type === 'courseNode') {
          return { ...n, data: { ...n.data, isEditMode: false } };
        }
        if (n.type === 'headerNode') {
          return { ...n, data: { ...n.data, isDark: isDarkMode } };
        }
        return n;
      })
    );
    setEdges(eds =>
      eds.map(e => {
        const completed = completedCourses.has(e.source);
        const baseColor = getEdgeColor(e.id, isDarkMode);
        const color = completed ? '#22c55e' : baseColor;
        const width = completed ? 3 : 2;
        return {
          ...e,
          deletable: false,
          animated: completed,
          style: { stroke: color, strokeWidth: width },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      })
    );
    // Recompute statuses from current edges
    setNodes(nds =>
      nds.map(n => {
        if (n.type !== 'courseNode') return n;
        return { ...n, data: { ...n.data, isEditMode: false } };
      })
    );
  }, [isDarkMode, completedCourses, setNodes, setEdges]);

  // ----- Save to Supabase ---------------------------------------------------
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    const rawEdges = edges
      .filter(e => !e.id.startsWith('header-'))
      .map(e => ({ source: e.source, target: e.target }));

    const { error } = await supabase
      .from('flowchart_edges')
      .upsert({ carrera: 'administracion', edges: rawEdges, updated_at: new Date().toISOString() }, { onConflict: 'carrera' });

    if (error) {
      setSaveStatus('error');
    } else {
      setSaveStatus('saved');
      setLoadedEdges(rawEdges);
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
  }, [edges]);

  // ----- Clear all edges in edit mode ---------------------------------------
  const handleClearEdges = useCallback(() => {
    if (!isEditMode) return;
    setEdges([]);
  }, [isEditMode, setEdges]);

  // ----- Connect handler (edit mode only) -----------------------------------
  const onConnect = useCallback(
    (params: Connection) => {
      if (!isEditMode) return;
      setEdges(eds => addEdge({
        ...params,
        type: 'smart',
        deletable: true,
        style: { stroke: '#6366f1', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      }, eds));
    },
    [isEditMode, setEdges]
  );

  // ----- Node click (view mode): toggle completed ---------------------------
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (isEditMode) return;
      if (node.type !== 'courseNode') return;
      toggleCourse(node.id);
    },
    [isEditMode, toggleCourse]
  );

  // ----- Update node statuses when completed courses changes (view mode) ----
  useEffect(() => {
    if (isEditMode) return;
    setNodes(nds => {
      let changed = false;
      const next = nds.map(node => {
        if (node.type !== 'courseNode') return node;
        const newStatus = getStatus(node.id, edges);
        // Also compute if this node has NO prerequisites (always unlocked from start)
        const prerequisites = edges.filter(e => e.target === node.id);
        const finalStatus = prerequisites.length === 0 ? (completedCourses.has(node.id) ? 'completed' : 'unlocked') : newStatus;
        if (node.data.status !== finalStatus) {
          changed = true;
          return { ...node, data: { ...node.data, status: finalStatus } };
        }
        return node;
      });
      return changed ? next : nds;
    });

    setEdges(eds => {
      let changed = false;
      const next = eds.map(edge => {
        const completed = completedCourses.has(edge.source);
        const baseColor = getEdgeColor(edge.id, isDarkMode);
        const expectedStroke = completed ? '#22c55e' : baseColor;
        const expectedWidth  = completed ? 3 : 2;
        const expectedAnim   = completed;
        if (
          edge.animated !== expectedAnim ||
          edge.style?.stroke !== expectedStroke ||
          edge.style?.strokeWidth !== expectedWidth
        ) {
          changed = true;
          return {
            ...edge,
            animated: expectedAnim,
            style: { stroke: expectedStroke, strokeWidth: expectedWidth },
            markerEnd: { type: MarkerType.ArrowClosed, color: expectedStroke },
          };
        }
        return edge;
      });
      return changed ? next : eds;
    });
  }, [completedCourses, isEditMode, isDarkMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Dark mode toggle (view mode only) ----------------------------------
  const toggleDarkMode = useCallback(() => {
    if (isEditMode) return;
    const next = !isDarkMode;
    setIsDarkMode(next);
    setNodes(nds =>
      nds.map(n => {
        if (n.type === 'headerNode') return { ...n, data: { ...n.data, isDark: next } };
        return n;
      })
    );
    setEdges(eds =>
      eds.map(e => {
        const completed = completedCourses.has(e.source);
        const baseColor = getEdgeColor(e.id, next);
        const color = completed ? '#22c55e' : baseColor;
        const width = completed ? 3 : 2;
        return {
          ...e,
          style: { stroke: color, strokeWidth: width },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      })
    );
  }, [isDarkMode, isEditMode, completedCourses, setNodes, setEdges]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!isEditMode) return;
      
      // Snap logic: Nodes should align to multiples of 320 on X axis.
      // We do not change Y axis.
      const snapTo = 320;
      const newX = Math.round(node.position.x / snapTo) * snapTo;

      setNodes(nds =>
        nds.map(n => {
          if (n.id === node.id) {
            return {
              ...n,
              position: { ...n.position, x: newX },
            };
          }
          return n;
        })
      );
    },
    [isEditMode, setNodes]
  );

  // ----- Loading state ------------------------------------------------------
  if (loadedEdges === null) {
    return (
      <div className="w-full h-[750px] flex items-center justify-center bg-slate-50 border border-gray-200 rounded-xl">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Cargando malla curricular…</p>
        </div>
      </div>
    );
  }

  const bgColor  = isDarkMode ? '#0f172a' : '#f8fafc';
  const gridColor = isDarkMode ? '#1e293b' : '#e2e8f0';



  return (
    <div
      ref={containerRef}
      className={`w-full transition-all duration-300 relative border overflow-hidden shadow-inner
        ${isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen border-none rounded-none'
          : 'h-[750px] rounded-xl border-gray-200'}
        ${isDarkMode ? 'bg-gray-950 border-gray-800' : 'bg-slate-50 border-gray-200'}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.08}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={isEditMode}
        elementsSelectable={isEditMode}
        deleteKeyCode={isEditMode ? 'Backspace' : null}
        onlyRenderVisibleElements={true}
      >
        <Background gap={28} size={1.5} color={gridColor} />
        <Controls
          className={isDarkMode ? '[&>button]:bg-gray-800 [&>button]:border-gray-700 [&>button]:text-white' : ''}
        />

        {/* ── Top-right panel: toolbar ── */}
        <Panel position="top-right" className="flex items-center gap-2 m-2">
          {/* Fullscreen toggle (Always available) */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className={`h-9 w-9 rounded-full flex items-center justify-center shadow-md border transition-all duration-200
              ${isDarkMode
                ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Dark mode toggle (view mode only) */}
          {!isEditMode && (
            <button
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
              className={`h-9 w-9 rounded-full flex items-center justify-center shadow-md border transition-all duration-200
                ${isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {/* Edit mode toggle */}
          {!isEditMode ? (
            <button
              onClick={enterEditMode}
              className="flex items-center gap-2 h-9 px-4 rounded-full text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 shadow-md transition-all duration-200"
            >
              <Edit3 className="w-4 h-4" /> Modo Edición
            </button>
          ) : (
            <>
              {/* Clear all */}
              <button
                onClick={handleClearEdges}
                title="Borrar todas las conexiones"
                className="h-9 w-9 rounded-full flex items-center justify-center shadow-md bg-red-100 border border-red-300 text-red-600 hover:bg-red-200 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className={`flex items-center gap-2 h-9 px-4 rounded-full text-sm font-bold shadow-lg transition-all duration-200
                  ${saveStatus === 'saved'
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : saveStatus === 'error'
                    ? 'bg-red-500 text-white border-red-600'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700'}`}
              >
                {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                {saveStatus === 'saved'  && <CheckCircle className="w-4 h-4" />}
                {saveStatus === 'error'  && <AlertCircle className="w-4 h-4" />}
                {saveStatus === 'idle'   && <Save className="w-4 h-4" />}
                {saveStatus === 'saving' ? 'Guardando…'
                  : saveStatus === 'saved'  ? '¡Guardado!'
                  : saveStatus === 'error'  ? 'Error'
                  : 'Guardar'}
              </button>

              {/* Exit edit mode */}
              <button
                onClick={exitEditMode}
                className="flex items-center gap-2 h-9 px-4 rounded-full text-sm font-bold bg-gray-700 border border-gray-600 text-white hover:bg-gray-600 shadow-md transition-all"
              >
                <Eye className="w-4 h-4" /> Vista normal
              </button>
            </>
          )}
        </Panel>

        {/* MiniMap (view mode only) */}
        {!isEditMode && (
          <MiniMap
            nodeColor={n => {
              if (n.type === 'headerNode') return 'transparent';
              const st = n.data?.status as string;
              if (st === 'completed') return '#eab308';
              if (st === 'unlocked')  return '#22c55e';
              return isDarkMode ? '#334155' : '#cbd5e1';
            }}
            maskColor={isDarkMode ? 'rgba(15,23,42,0.7)' : 'rgba(248,250,252,0.7)'}
            className="rounded-lg overflow-hidden"
          />
        )}
      </ReactFlow>

      {/* ── Edit mode overlay banner ── */}
      {isEditMode && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-3 bg-indigo-900/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-2xl text-xs font-medium border border-indigo-700/60">
            <Info className="w-4 h-4 text-indigo-300 shrink-0" />
            <span>
              <strong className="text-indigo-200">Modo Edición:</strong>{' '}
              Arrastra los puntos laterales para conectar cursos · Selecciona una flecha y presiona{' '}
              <kbd className="bg-indigo-700 px-1.5 py-0.5 rounded text-[10px]">Backspace</kbd> para borrarla
            </span>
          </div>
        </div>
      )}

      {/* ── Edit mode dim overlay ── */}
      {isEditMode && (
        <div className="absolute inset-0 pointer-events-none bg-indigo-950/10 rounded-xl ring-4 ring-indigo-500/40 ring-inset" />
      )}
    </div>
  );
}
