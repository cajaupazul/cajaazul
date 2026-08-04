'use client';

import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  CheckCircle2,
  RefreshCw,
  Clock,
  X,
  Star,
  BookOpen,
  ArrowRight,
  User,
  Sparkles,
  Layers,
  Award,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ==========================================
// 1. DATA DEFINITIONS
// ==========================================

export interface CourseData {
  id: string;
  code: string;
  nombre: string;
  creditos: number;
  ciclo: number;
  categoria: string;
}

export const COURSES: CourseData[] = [
  // CICLO 0
  { id: "nivelacion-matematica", code: "134654", nombre: "Nivelación en Matemática", creditos: 0, ciclo: 0, categoria: "nivelacion" },
  { id: "nivelacion-informatica", code: "170131", nombre: "Nivelación en Informática", creditos: 0, ciclo: 0, categoria: "nivelacion" },
  { id: "nivelacion-lenguaje", code: "120000", nombre: "Nivelación en Lenguaje", creditos: 0, ciclo: 0, categoria: "nivelacion" },
  // CICLO 1
  { id: "fund-ciencias-empresariales", code: "141038", nombre: "Fundamentos de las Ciencias Empresariales", creditos: 4, ciclo: 1, categoria: "administracion" },
  { id: "lenguaje-i", code: "120001", nombre: "Lenguaje I", creditos: 4, ciclo: 1, categoria: "sello" },
  { id: "matematicas-i", code: "138649", nombre: "Matemáticas I", creditos: 5, ciclo: 1, categoria: "economia" },
  { id: "economia-general-i", code: "132641", nombre: "Economía General I", creditos: 5, ciclo: 1, categoria: "economia" },
  // CICLO 2
  { id: "lenguaje-ii", code: "120006", nombre: "Lenguaje II", creditos: 4, ciclo: 2, categoria: "sello" },
  { id: "fund-contabilidad", code: "160092", nombre: "Fundamentos de Contabilidad", creditos: 4, ciclo: 2, categoria: "contabilidad" },
  { id: "bloque-ciencias-sociales", code: "SELLO1", nombre: "Bloque de Ciencias Sociales", creditos: 4, ciclo: 2, categoria: "sello" },
  { id: "economia-general-ii", code: "130642", nombre: "Economía General II", creditos: 5, ciclo: 2, categoria: "economia" },
  { id: "matematicas-negocios", code: "130230", nombre: "Matemáticas para los Negocios", creditos: 4, ciclo: 2, categoria: "economia" },
  // CICLO 3
  { id: "contabilidad-financiera-intermedia", code: "160171", nombre: "Contabilidad Financiera Intermedia", creditos: 5, ciclo: 3, categoria: "contabilidad" },
  { id: "derecho-civil-comercial", code: "180266", nombre: "Derecho Civil y Comercial", creditos: 3, ciclo: 3, categoria: "derecho" },
  { id: "estadistica-i", code: "130224", nombre: "Estadística I", creditos: 4, ciclo: 3, categoria: "economia" },
  { id: "bloque-pensamiento-critico", code: "SELLO2", nombre: "Bloque Pensamiento Crítico", creditos: 4, ciclo: 3, categoria: "sello" },
  { id: "bloque-desarrollo-personal", code: "SELLO3", nombre: "Bloque Desarrollo Personal", creditos: 4, ciclo: 3, categoria: "sello" },
  // CICLO 4
  { id: "diseno-organizacional", code: "142081", nombre: "Diseño Organizacional y Estrategia", creditos: 4, ciclo: 4, categoria: "administracion" },
  { id: "analitica-datos-negocios", code: "142277", nombre: "Analítica de Datos para los Negocios", creditos: 3, ciclo: 4, categoria: "administracion" },
  { id: "marketing-estrategico", code: "1MN035", nombre: "Marketing Estratégico", creditos: 4, ciclo: 4, categoria: "marketing" },
  { id: "fund-finanzas", code: "1F0112", nombre: "Fundamentos de Finanzas", creditos: 4, ciclo: 4, categoria: "finanzas" },
  { id: "derecho-laboral-tributario", code: "180268", nombre: "Derecho Laboral y Tributario", creditos: 3, ciclo: 4, categoria: "derecho" },
  // CICLO 5
  { id: "metodos-cuantitativos", code: "142096", nombre: "Métodos Cuantitativos para la Gestión en las Organizaciones", creditos: 4, ciclo: 5, categoria: "administracion" },
  { id: "investigacion-mercados", code: "1MN020", nombre: "Investigación de Mercados", creditos: 4, ciclo: 5, categoria: "marketing" },
  { id: "contabilidad-toma-decisiones", code: "160025", nombre: "Contabilidad para la Toma de Decisiones", creditos: 5, ciclo: 5, categoria: "contabilidad" },
  { id: "gestion-cambio-cultural", code: "142094", nombre: "Gestión del Cambio y Transformación Cultural", creditos: 4, ciclo: 5, categoria: "administracion" },
  { id: "analisis-multivariado", code: "141036", nombre: "Análisis Multivariado para los Negocios", creditos: 4, ciclo: 5, categoria: "administracion" },
  // CICLO 6
  { id: "innovacion-negocios-digitales", code: "142091", nombre: "Innovación y Gestión en Negocios Digitales", creditos: 3, ciclo: 6, categoria: "administracion" },
  { id: "finanzas-corporativas-i", code: "1F0120", nombre: "Finanzas Corporativas I", creditos: 5, ciclo: 6, categoria: "finanzas" },
  { id: "gestion-personas", code: "144741", nombre: "Gestión de Personas", creditos: 4, ciclo: 6, categoria: "administracion" },
  { id: "investigacion-academica", code: "150140", nombre: "Investigación Académica", creditos: 3, ciclo: 6, categoria: "sello" },
  { id: "gestion-operaciones", code: "142084", nombre: "Gestión de Operaciones en las Organizaciones", creditos: 4, ciclo: 6, categoria: "administracion" },
  // CICLO 7
  { id: "sistemas-informacion-datos", code: "142273", nombre: "Sistemas de Información y Análisis de Datos", creditos: 3, ciclo: 7, categoria: "administracion" },
  { id: "evaluacion-financiera", code: "160172", nombre: "Evaluación Financiera de las Organizaciones", creditos: 5, ciclo: 7, categoria: "contabilidad" },
  { id: "creacion-valor", code: "142077", nombre: "Creación de Valor y Toma de Decisiones", creditos: 3, ciclo: 7, categoria: "administracion" },
  { id: "gestion-comercio-internacional", code: "1MN015", nombre: "Gestión del Comercio Internacional", creditos: 4, ciclo: 7, categoria: "marketing" },
  { id: "gestion-cadena-suministros", code: "141041", nombre: "Gestión de la Cadena de Suministros", creditos: 4, ciclo: 7, categoria: "administracion" },
  // CICLO 8
  { id: "business-agility", code: "142280", nombre: "Business Agility", creditos: 3, ciclo: 8, categoria: "administracion" },
  { id: "gestion-sostenibilidad", code: "142085", nombre: "Gestión de la Sostenibilidad Social y Ambiental en las Empresas", creditos: 4, ciclo: 8, categoria: "administracion" },
  { id: "bloque-procesos-sociales", code: "SELLO4", nombre: "Bloque de Procesos Sociales", creditos: 4, ciclo: 8, categoria: "sello" },
  { id: "bloque-quehacer-cientifico", code: "SELLO5", nombre: "Bloque Introducción al Quehacer Científico", creditos: 4, ciclo: 8, categoria: "sello" },
  { id: "gestion-internacional-empresas", code: "1MN016", nombre: "Gestión Internacional de las Empresas", creditos: 4, ciclo: 8, categoria: "marketing" },
  // CICLO 9
  { id: "etica", code: "120133", nombre: "Ética", creditos: 4, ciclo: 9, categoria: "sello" },
  { id: "direccion-estrategica", code: "149078", nombre: "Dirección Estratégica", creditos: 4, ciclo: 9, categoria: "administracion" },
  { id: "bloque-pensamiento-critico-ix", code: "SELLO6", nombre: "Bloque Pensamiento Crítico", creditos: 4, ciclo: 9, categoria: "sello" },
  { id: "investigacion-aplicada-negocios", code: "141042", nombre: "Investigación Aplicada a los Negocios", creditos: 3, ciclo: 9, categoria: "administracion" },
  // CICLO 10
  { id: "proyeccion-social", code: "150013", nombre: "Proyección Social", creditos: 4, ciclo: 10, categoria: "sello" },
  { id: "bloque-procesos-sociales-x", code: "SELLO7", nombre: "Bloque de Procesos Sociales", creditos: 4, ciclo: 10, categoria: "sello" },
  { id: "proyecto-empresarial", code: "142100", nombre: "Proyecto Empresarial", creditos: 5, ciclo: 10, categoria: "administracion" },
];

export const PREREQUISITES: Record<string, string[]> = {
  "matematicas-i": ["nivelacion-matematica"],
  "economia-general-i": ["nivelacion-matematica"],
  "lenguaje-i": ["nivelacion-lenguaje"],
  "lenguaje-ii": ["lenguaje-i"],
  "economia-general-ii": ["economia-general-i"],
  "matematicas-negocios": ["matematicas-i"],
  "estadistica-i": ["matematicas-i", "nivelacion-informatica"],
  "contabilidad-financiera-intermedia": ["fund-contabilidad"],
  "derecho-civil-comercial": ["fund-ciencias-empresariales"],
  "diseno-organizacional": ["fund-ciencias-empresariales"],
  "analitica-datos-negocios": ["estadistica-i"],
  "fund-finanzas": ["nivelacion-informatica", "fund-contabilidad"],
  "derecho-laboral-tributario": ["derecho-civil-comercial"],
  "metodos-cuantitativos": ["estadistica-i"],
  "investigacion-mercados": ["marketing-estrategico"],
  "contabilidad-toma-decisiones": ["contabilidad-financiera-intermedia"],
  "gestion-cambio-cultural": ["diseno-organizacional"],
  "analisis-multivariado": ["analitica-datos-negocios"],
  "innovacion-negocios-digitales": ["diseno-organizacional"],
  "finanzas-corporativas-i": ["estadistica-i", "fund-finanzas"],
  "gestion-personas": ["gestion-cambio-cultural"],
  "gestion-operaciones": ["metodos-cuantitativos"],
  "sistemas-informacion-datos": ["analisis-multivariado"],
  "evaluacion-financiera": ["finanzas-corporativas-i"],
  "creacion-valor": ["fund-finanzas", "gestion-cambio-cultural", "marketing-estrategico"],
  "gestion-comercio-internacional": ["economia-general-ii", "marketing-estrategico"],
  "gestion-cadena-suministros": ["gestion-operaciones"],
  "business-agility": ["gestion-operaciones"],
  "gestion-sostenibilidad": ["diseno-organizacional", "gestion-operaciones"],
  "gestion-internacional-empresas": ["gestion-comercio-internacional", "diseno-organizacional"],
  "direccion-estrategica": ["diseno-organizacional", "finanzas-corporativas-i", "gestion-operaciones"],
  "investigacion-aplicada-negocios": ["investigacion-academica", "investigacion-mercados", "analisis-multivariado", "gestion-personas", "gestion-operaciones", "creacion-valor"],
  "proyecto-empresarial": ["direccion-estrategica", "gestion-sostenibilidad", "investigacion-mercados", "gestion-internacional-empresas", "contabilidad-toma-decisiones", "gestion-personas", "gestion-cadena-suministros", "evaluacion-financiera"],
};

export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  nivelacion:     { bg: "#1F2937", border: "#6B7280", text: "#E5E7EB" },
  economia:       { bg: "#451A03", border: "#F97316", text: "#FFEDD5" },
  finanzas:       { bg: "#172554", border: "#3B82F6", text: "#DBEAFE" },
  marketing:      { bg: "#422006", border: "#EAB308", text: "#FEF9C3" },
  sello:          { bg: "#3B0764", border: "#A855F7", text: "#F3E8FF" },
  administracion: { bg: "#064E3B", border: "#22C55E", text: "#DCFCE7" },
  contabilidad:   { bg: "#450A0A", border: "#EF4444", text: "#FEE2E2" },
  derecho:        { bg: "#083344", border: "#06B6D4", text: "#CFFAFE" },
};

// Map course ID to CourseData for quick lookups
const COURSE_MAP = new Map(COURSES.map(c => [c.id, c]));

// Calculate total possible credits
const TOTAL_CREDITS = COURSES.reduce((sum, c) => sum + c.creditos, 0);

// ==========================================
// 2. CUSTOM REACT FLOW NODE
// ==========================================

const CourseFlowNode = memo(({ data, selected }: { data: any; selected: boolean }) => {
  const { nombre, code, creditos, categoria, status, isAvailable, categoryStyle } = data;

  return (
    <div
      className={`relative rounded-xl p-2.5 transition-all cursor-pointer select-none text-left shadow-lg w-[160px] h-[82px] flex flex-col justify-between border ${
        selected ? 'ring-4 ring-white shadow-2xl scale-105 z-50 border-white' : ''
      } ${
        isAvailable && status === 'pendiente'
          ? 'border-dashed ring-2 ring-emerald-400/90 shadow-emerald-500/20 shadow-md animate-pulse'
          : ''
      }`}
      style={{
        backgroundColor: categoryStyle?.bg || '#111827',
        borderColor: selected ? '#FFFFFF' : categoryStyle?.border || '#374151',
        color: categoryStyle?.text || '#FFFFFF',
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-white/80 border-none" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-mono font-bold tracking-wider opacity-85 uppercase">
          {code}
        </span>
        {/* Status Indicator */}
        <div className="flex items-center">
          {status === 'aprobado' && (
            <span className="inline-flex items-center justify-center bg-emerald-500 text-white rounded-full p-0.5 shadow-sm" title="Aprobado">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          )}
          {status === 'en_curso' && (
            <span className="inline-flex items-center justify-center bg-amber-500 text-white rounded-full p-0.5 shadow-sm animate-spin" title="En curso">
              <RefreshCw className="w-3.5 h-3.5" />
            </span>
          )}
          {status === 'pendiente' && (
            <span className={`inline-flex items-center justify-center rounded-full p-0.5 ${isAvailable ? 'text-emerald-300 font-extrabold' : 'text-gray-400 opacity-60'}`} title={isAvailable ? "Disponible para llevar" : "Pendiente"}>
              <Clock className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <p className="text-[11px] font-extrabold line-clamp-2 leading-tight my-0.5">
        {nombre}
      </p>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[9px] opacity-80 pt-0.5 border-t border-white/10">
        <span className="capitalize font-semibold truncate max-w-[95px]">{categoria}</span>
        <span className="font-bold">{creditos} cr</span>
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-white/80 border-none" />
    </div>
  );
});
CourseFlowNode.displayName = 'CourseFlowNode';

const nodeTypes = { courseNode: CourseFlowNode };

// ==========================================
// 3. MAIN COMPONENT
// ==========================================

export default function FlujogramaAdminInteractivo() {
  const [progressMap, setProgressMap] = useState<Record<string, 'pendiente' | 'en_curso' | 'aprobado'>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Professor details for selected course
  const [topProfessors, setTopProfessors] = useState<any[]>([]);
  const [loadingProfs, setLoadingProfs] = useState(false);

  // ── Fullscreen logic ──
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Load User Progress from Supabase ──
  useEffect(() => {
    async function loadProgress() {
      try {
        setLoadingProgress(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('student_course_progress')
          .select('catalog_course_code, status')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error loading course progress:', error);
          return;
        }

        if (data) {
          const map: Record<string, 'pendiente' | 'en_curso' | 'aprobado'> = {};
          data.forEach((item: any) => {
            map[item.catalog_course_code] = item.status;
          });
          setProgressMap(map);
        }
      } catch (err) {
        console.error('Failed to load student course progress:', err);
      } finally {
        setLoadingProgress(false);
      }
    }

    loadProgress();
  }, []);

  // Selected Course details
  const selectedCourse = useMemo(() => {
    return selectedCourseId ? COURSE_MAP.get(selectedCourseId) || null : null;
  }, [selectedCourseId]);

  // Load Top 3 Professors when selectedCourse changes
  useEffect(() => {
    if (!selectedCourse) {
      setTopProfessors([]);
      return;
    }

    async function fetchTopProfessors() {
      if (!selectedCourse) return;
      setLoadingProfs(true);
      try {
        // 1. Get catalog_course_id by code
        const { data: catCourse } = await supabase
          .from('catalog_courses')
          .select('id')
          .eq('codigo', selectedCourse.code)
          .maybeSingle();

        if (!catCourse?.id) {
          setTopProfessors([]);
          return;
        }

        // 2. Query professors teaching this course
        const { data: cpData } = await supabase
          .from('course_professors')
          .select(`
            catalog_course_id,
            professors (
              id,
              nombre,
              avatar_url,
              professor_ratings (puntuacion, catalog_course_id)
            )
          `)
          .eq('catalog_course_id', catCourse.id);

        if (cpData) {
          const list = cpData
            .map((item: any) => {
              const p = item.professors;
              if (!p) return null;
              const ratings = (p.professor_ratings || []).filter(
                (r: any) => r.catalog_course_id === catCourse.id
              );
              const total = ratings.length;
              const avg =
                total > 0
                  ? ratings.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / total
                  : 0;
              return {
                id: p.id,
                nombre: p.nombre,
                avatar_url: p.avatar_url,
                avg_rating: avg,
                total_ratings: total,
                catalogCourseId: catCourse.id,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          list.sort((a, b) => b.avg_rating - a.avg_rating);
          setTopProfessors(list.slice(0, 3));
        } else {
          setTopProfessors([]);
        }
      } catch (err) {
        console.error('Error fetching top professors:', err);
      } finally {
        setLoadingProfs(false);
      }
    }

    fetchTopProfessors();
  }, [selectedCourse?.code]);

  // Handle Status Update (UPSERT to Supabase)
  const handleUpdateStatus = async (newStatus: 'pendiente' | 'en_curso' | 'aprobado') => {
    if (!selectedCourse) return;
    const courseCode = selectedCourse.code;

    // Optimistic state update
    setProgressMap((prev) => ({
      ...prev,
      [courseCode]: newStatus,
    }));

    setUpdatingStatus(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('student_course_progress')
        .upsert(
          {
            user_id: user.id,
            catalog_course_code: courseCode,
            status: newStatus,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,catalog_course_code' }
        );

      if (error) {
        console.error('Error saving course progress:', error);
      }
    } catch (err) {
      console.error('Upsert failed:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Calculate Stats ──
  const approvedCount = useMemo(() => {
    return COURSES.filter((c) => progressMap[c.code] === 'aprobado').length;
  }, [progressMap]);

  const approvedCredits = useMemo(() => {
    return COURSES.filter((c) => progressMap[c.code] === 'aprobado').reduce((sum, c) => sum + c.creditos, 0);
  }, [progressMap]);

  const progressPercentage = useMemo(() => {
    return Math.round((approvedCount / COURSES.length) * 100);
  }, [approvedCount]);

  // Helper: Check if course prerequisites are met
  const isCourseAvailable = useCallback((courseId: string) => {
    const prereqs = PREREQUISITES[courseId] || [];
    if (prereqs.length === 0) return true;
    return prereqs.every((prereqId) => {
      const prereqCourse = COURSE_MAP.get(prereqId);
      return prereqCourse && progressMap[prereqCourse.code] === 'aprobado';
    });
  }, [progressMap]);

  // ── Build Nodes ──
  const initialNodes = useMemo(() => {
    const NODE_W = 160;
    const NODE_H = 82;
    const COL_SPACING = 280;  // 160px node + 120px arrow channel
    const ROW_SPACING = 120;
    const LABEL_Y = -52;

    // Group courses by ciclo
    const byCiclo: Record<number, CourseData[]> = {};
    COURSES.forEach((c) => {
      if (!byCiclo[c.ciclo]) byCiclo[c.ciclo] = [];
      byCiclo[c.ciclo].push(c);
    });

    // Max rows to compute total canvas height for centering
    const maxRows = Math.max(...Object.values(byCiclo).map((g) => g.length));
    const totalHeight = maxRows * ROW_SPACING;

    const courseNodes: Node[] = [];
    const labelNodes: Node[] = [];

    const ROMAN = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X'];

    Object.entries(byCiclo).forEach(([cicloStr, courses]) => {
      const ciclo = Number(cicloStr);
      const x = ciclo * COL_SPACING + 40;
      const groupH = courses.length * ROW_SPACING - (ROW_SPACING - NODE_H);
      const startY = (totalHeight - groupH) / 2 + 20;

      // Cycle label node
      labelNodes.push({
        id: `label-ciclo-${ciclo}`,
        type: 'default',
        position: { x: x + (NODE_W / 2) - 35, y: LABEL_Y },
        data: { label: ciclo === 0 ? 'CICLO 0' : `CICLO ${ROMAN[ciclo]}` },
        draggable: false,
        selectable: false,
        style: {
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          color: '#9CA3AF',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          padding: 0,
          width: 70,
          textAlign: 'center',
        },
      });

      courses.forEach((course, idx) => {
        const y = startY + idx * ROW_SPACING;
        const status = progressMap[course.code] || 'pendiente';
        const available = isCourseAvailable(course.id);
        const style = CATEGORY_COLORS[course.categoria] || CATEGORY_COLORS.administracion;

        courseNodes.push({
          id: course.id,
          type: 'courseNode',
          position: { x, y },
          data: {
            ...course,
            status,
            isAvailable: available,
            categoryStyle: style,
          },
        });
      });
    });

    return [...labelNodes, ...courseNodes];
  }, [progressMap, isCourseAvailable]);

  // ── Build Edges ──
  const initialEdges = useMemo(() => {
    const edgeList: Edge[] = [];

    Object.entries(PREREQUISITES).forEach(([targetId, prereqIds]) => {
      const targetCourse = COURSE_MAP.get(targetId);
      if (!targetCourse) return;

      const isTargetSelected = selectedCourseId === targetId;

      prereqIds.forEach((sourceId) => {
        const sourceCourse = COURSE_MAP.get(sourceId);
        if (!sourceCourse) return;

        // Color by SOURCE category
        const sourceStyle = CATEGORY_COLORS[sourceCourse.categoria] || CATEGORY_COLORS.administracion;
        const isSourceSelected = selectedCourseId === sourceId;
        const isHighlighted = isTargetSelected || isSourceSelected;
        const edgeColor = isHighlighted ? '#FFFFFF' : sourceStyle.border;

        edgeList.push({
          id: `edge-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'smoothstep',
          animated: isHighlighted,
          style: {
            stroke: edgeColor,
            strokeWidth: isHighlighted ? 3 : 2,
            opacity: isHighlighted ? 1 : 0.65,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
            width: 16,
            height: 16,
          },
        });
      });
    });

    return edgeList;
  }, [selectedCourseId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state updates with flow nodes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedCourseId(node.id);
  }, []);

  // Unlocks list for selected course
  const unlockedCourses = useMemo(() => {
    if (!selectedCourseId) return [];
    return COURSES.filter((c) => {
      const prereqs = PREREQUISITES[c.id] || [];
      return prereqs.includes(selectedCourseId);
    });
  }, [selectedCourseId]);

  // Prerequisites list for selected course
  const selectedPrereqs = useMemo(() => {
    if (!selectedCourseId) return [];
    const reqIds = PREREQUISITES[selectedCourseId] || [];
    return reqIds.map((id) => COURSE_MAP.get(id)).filter(Boolean) as CourseData[];
  }, [selectedCourseId]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-bb-darker border border-bb-border overflow-hidden flex flex-col transition-all ${
        isFullscreen ? 'h-screen rounded-none' : 'h-[calc(100vh-100px)] min-h-[600px] rounded-3xl'
      }`}
    >
      {/* ── TOP BAR (Fija) ── */}
      <div className="bg-bb-card/90 backdrop-blur-md border-b border-bb-border p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 z-20 shrink-0 shadow-lg">
        {/* Title and Badge */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3 tracking-tight">
            Flujograma - Administración 2022
            <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Interactivo
            </span>
          </h2>
          <p className="text-xs text-bb-text-secondary mt-0.5">
            Selecciona cualquier curso para marcar tu progreso, ver prerrequisitos y mejores profesores.
          </p>
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 hover:border-white/30 shadow-lg"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{isFullscreen ? 'Salir' : 'Pantalla completa'}</span>
        </button>

        {/* Progress Bars & Counters */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full lg:w-auto">
          {/* Cursos Aprobados */}
          <div className="space-y-1 min-w-[130px]">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-bb-text-secondary">Cursos</span>
              <span className="text-emerald-400">{approvedCount} / {COURSES.length}</span>
            </div>
            <div className="w-full bg-bb-darker h-2 rounded-full overflow-hidden border border-bb-border">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Créditos Completados */}
          <div className="space-y-1 min-w-[130px]">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-bb-text-secondary">Créditos</span>
              <span className="text-blue-400">{approvedCredits} / {TOTAL_CREDITS}</span>
            </div>
            <div className="w-full bg-bb-darker h-2 rounded-full overflow-hidden border border-bb-border">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.round((approvedCredits / TOTAL_CREDITS) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Legend Pill Bar ── */}
      <div className="bg-bb-dark/80 backdrop-blur-sm border-b border-bb-border/50 px-4 py-2 flex items-center gap-2 overflow-x-auto text-[11px] font-bold z-10 no-scrollbar">
        <span className="text-bb-text-secondary text-[10px] uppercase tracking-wider font-extrabold mr-1 shrink-0">Categorías:</span>
        {Object.entries(CATEGORY_COLORS).map(([cat, style]) => (
          <span
            key={cat}
            className="px-2.5 py-1 rounded-lg border text-xs capitalize shrink-0 flex items-center gap-1.5 shadow-sm"
            style={{
              backgroundColor: style.bg,
              borderColor: style.border,
              color: style.text,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.border }} />
            {cat}
          </span>
        ))}
      </div>

      {/* ── CANVAS (React Flow) ── */}
      <div className="flex-1 relative w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          proOptions={{ hideAttribution: true }}
          panOnScroll
          panOnDrag
          zoomOnPinch
          zoomOnScroll
          selectionOnDrag={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="#ffffff14"
            gap={20}
            size={1}
          />
          <Controls
            className="!bg-bb-card/90 !border-bb-border !rounded-xl !shadow-2xl"
            style={{ bottom: 16, left: 16 }}
          />
          <MiniMap
            nodeColor={(node: any) =>
              node.type === 'default' ? 'transparent' : (node.data?.categoryStyle?.border || '#3B82F6')
            }
            maskColor="rgba(0,0,0,0.7)"
            style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
            className="!shadow-2xl"
            position="bottom-right"
          />
        </ReactFlow>
      </div>

      {/* ── DRAWER LATERAL (Panel de Detalles) ── */}
      {selectedCourse && (
        <div className="absolute inset-y-0 right-0 w-full sm:w-[420px] bg-bb-card/95 backdrop-blur-xl border-l border-bb-border shadow-2xl z-50 flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-6 border-b border-bb-border space-y-3 relative">
            <button
              onClick={() => setSelectedCourseId(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-bb-darker border border-bb-border text-bb-text-secondary hover:text-white hover:border-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border"
                style={{
                  backgroundColor: CATEGORY_COLORS[selectedCourse.categoria]?.bg,
                  borderColor: CATEGORY_COLORS[selectedCourse.categoria]?.border,
                  color: CATEGORY_COLORS[selectedCourse.categoria]?.text,
                }}
              >
                {selectedCourse.categoria}
              </span>
              <span className="text-xs font-mono font-bold text-bb-text-secondary">
                CÓDIGO: {selectedCourse.code}
              </span>
            </div>

            <h3 className="text-xl font-black text-white leading-tight">
              {selectedCourse.nombre}
            </h3>

            <div className="flex items-center gap-4 text-xs font-bold text-bb-text-secondary pt-1">
              <span>Ciclo {selectedCourse.ciclo}</span>
              <span>•</span>
              <span className="text-blue-400">{selectedCourse.creditos} Créditos</span>
            </div>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Estado Selector (3 Botones Grandes) */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-bb-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" /> Estado del Curso
              </label>

              <div className="grid grid-cols-3 gap-2">
                {/* Pendiente */}
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('pendiente')}
                  disabled={updatingStatus}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold text-xs transition-all ${
                    (progressMap[selectedCourse.code] || 'pendiente') === 'pendiente'
                      ? 'bg-gray-800 border-gray-400 text-white shadow-lg ring-2 ring-gray-400/50'
                      : 'bg-bb-darker border-bb-border text-bb-text-secondary hover:border-gray-500'
                  }`}
                >
                  <Clock className="w-4 h-4 text-gray-400" />
                  Pendiente
                </button>

                {/* En Curso */}
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('en_curso')}
                  disabled={updatingStatus}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold text-xs transition-all ${
                    progressMap[selectedCourse.code] === 'en_curso'
                      ? 'bg-amber-950/80 border-amber-400 text-amber-200 shadow-lg ring-2 ring-amber-400/50'
                      : 'bg-bb-darker border-bb-border text-bb-text-secondary hover:border-amber-500'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  En Curso
                </button>

                {/* Aprobado */}
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('aprobado')}
                  disabled={updatingStatus}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold text-xs transition-all ${
                    progressMap[selectedCourse.code] === 'aprobado'
                      ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-lg ring-2 ring-emerald-400/50'
                      : 'bg-bb-darker border-bb-border text-bb-text-secondary hover:border-emerald-500'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Aprobado
                </button>
              </div>
            </div>

            {/* 2. Prerrequisitos */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-bb-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-400" /> Prerrequisitos Necessarios
              </h4>

              {selectedPrereqs.length > 0 ? (
                <div className="space-y-2">
                  {selectedPrereqs.map((prereq) => {
                    const st = progressMap[prereq.code] || 'pendiente';
                    const isPassed = st === 'aprobado';
                    const isInProgress = st === 'en_curso';

                    return (
                      <div
                        key={prereq.id}
                        onClick={() => setSelectedCourseId(prereq.id)}
                        className="p-3 rounded-xl bg-bb-darker border border-bb-border hover:border-blue-500/50 transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isPassed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : isInProgress ? (
                            <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                          )}
                          <span className={`text-xs font-bold truncate group-hover:text-blue-400 transition-colors ${isPassed ? 'text-white' : 'text-bb-text-secondary'}`}>
                            {prereq.nombre}
                          </span>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isPassed ? 'bg-emerald-500/20 text-emerald-400' : isInProgress ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-400'}`}>
                          {isPassed ? 'Aprobado' : isInProgress ? 'En curso' : 'Pendiente'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-bb-text-secondary italic bg-bb-darker p-3 rounded-xl border border-bb-border/50">
                  Sin prerrequisitos (Curso de primer ingreso / Libre).
                </p>
              )}
            </div>

            {/* 3. Top 3 Profesores del Curso */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-bb-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-400" /> Top Profesores de este Curso
              </h4>

              {loadingProfs ? (
                <div className="flex items-center justify-center p-4 bg-bb-darker rounded-xl border border-bb-border">
                  <span className="text-xs text-bb-text-secondary animate-pulse">Cargando profesores...</span>
                </div>
              ) : topProfessors.length > 0 ? (
                <div className="space-y-2">
                  {topProfessors.map((prof) => (
                    <Link
                      key={prof.id}
                      href={`/dashboard/professors/${prof.id}/${prof.catalogCourseId}`}
                      className="p-3 rounded-xl bg-bb-darker border border-bb-border hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                          {prof.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-yellow-400 transition-colors">
                            {prof.nombre}
                          </p>
                          <p className="text-[10px] text-bb-text-secondary">
                            {prof.total_ratings} {prof.total_ratings === 1 ? 'opinión' : 'opiniones'}
                          </p>
                        </div>
                      </div>

                      {prof.avg_rating > 0 ? (
                        <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg text-xs font-black shrink-0">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {prof.avg_rating.toFixed(1)}
                        </div>
                      ) : (
                        <span className="text-[10px] text-bb-text-secondary font-bold">Sin notas</span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-bb-text-secondary italic bg-bb-darker p-3 rounded-xl border border-bb-border/50">
                  Aún no hay profesores registrados para este curso.
                </p>
              )}
            </div>

            {/* 4. Cursos que Desbloquea */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-bb-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Cursos que Desbloquea
              </h4>

              {unlockedCourses.length > 0 ? (
                <div className="space-y-2">
                  {unlockedCourses.map((nextCourse) => {
                    const st = progressMap[nextCourse.code] || 'pendiente';
                    return (
                      <div
                        key={nextCourse.id}
                        onClick={() => setSelectedCourseId(nextCourse.id)}
                        className="p-3 rounded-xl bg-bb-darker border border-bb-border hover:border-emerald-500/50 transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <span className="text-xs font-bold text-bb-text-secondary group-hover:text-emerald-400 transition-colors truncate">
                          {nextCourse.nombre}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-bb-text-secondary group-hover:translate-x-1 transition-transform shrink-0" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-bb-text-secondary italic bg-bb-darker p-3 rounded-xl border border-bb-border/50">
                  Este curso es terminal o de ciclo final.
                </p>
              )}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-bb-border bg-bb-darker/60 flex items-center justify-between text-xs text-bb-text-secondary font-bold">
            <span>Universidad del Pacífico</span>
            <span>Plan 2022</span>
          </div>
        </div>
      )}
    </div>
  );
}
