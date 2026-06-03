'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Search, BookOpen, CheckCircle2, Clock, Loader2, ChevronRight } from 'lucide-react';
import AdminGradingFormulaEditor from '@/components/courses/AdminGradingFormulaEditor';

interface CourseRow {
  id: string;
  nombre: string;
  codigo: string | null;
  facultad: string | null;
  hasFormula?: boolean;
}

export default function AdminCalculatorsPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [formulaIds, setFormulaIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);

  // ── Fetch courses + existing formulas ─────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [coursesRes, formulasRes] = await Promise.all([
        supabase.from('courses').select('id,nombre,codigo,facultad').order('nombre'),
        supabase.from('course_grading_formulas').select('course_id'),
      ]);

      if (!coursesRes.error && coursesRes.data) {
        setCourses(coursesRes.data);
      }
      if (!formulasRes.error && formulasRes.data) {
        setFormulaIds(new Set(formulasRes.data.map((r: any) => r.course_id)));
      }

      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return courses;
    const q = search.toLowerCase();
    return courses.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.codigo?.toLowerCase() || '').includes(q) ||
        (c.facultad?.toLowerCase() || '').includes(q)
    );
  }, [courses, search]);

  const withFormula = filtered.filter((c) => formulaIds.has(c.id));
  const withoutFormula = filtered.filter((c) => !formulaIds.has(c.id));

  const handleSaved = () => {
    // Mark the course as having a formula now
    if (selectedCourse) {
      setFormulaIds((prev) => new Set([...prev, selectedCourse.id]));
    }
    setSelectedCourse(null);
  };

  return (
    <div className="min-h-screen bg-bb-dark p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
            <Calculator className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-bb-text tracking-tight">Calculadoras de Notas</h1>
            <p className="text-sm text-bb-text-secondary mt-1">
              Configura la fórmula de calificación para cada curso. Los estudiantes la verán al abrir la calculadora.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-bb-card border border-bb-border rounded-2xl p-4">
            <p className="text-xs text-bb-text-secondary font-medium">Total cursos</p>
            <p className="text-3xl font-black text-bb-text mt-1">{courses.length}</p>
          </div>
          <div className="bg-green-500/8 border border-green-500/20 rounded-2xl p-4">
            <p className="text-xs text-green-400/80 font-medium">Con fórmula</p>
            <p className="text-3xl font-black text-green-400 mt-1">{formulaIds.size}</p>
          </div>
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-amber-400/80 font-medium">Sin configurar</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{courses.length - formulaIds.size}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bb-text-secondary pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o facultad..."
            className="w-full bg-bb-card border border-bb-border rounded-2xl pl-11 pr-4 py-3.5 text-sm text-bb-text placeholder:text-bb-text-secondary/60 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 outline-none transition-all"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* With formula */}
            {withFormula.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-green-400/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Cursos con fórmula configurada ({withFormula.length})
                </h3>
                <div className="space-y-2">
                  {withFormula.map((course) => (
                    <CourseRow
                      key={course.id}
                      course={course}
                      hasFormula={true}
                      onClick={() => setSelectedCourse(course)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Without formula */}
            {withoutFormula.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-amber-400/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Sin configurar ({withoutFormula.length})
                </h3>
                <div className="space-y-2">
                  {withoutFormula.map((course) => (
                    <CourseRow
                      key={course.id}
                      course={course}
                      hasFormula={false}
                      onClick={() => setSelectedCourse(course)}
                    />
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-bb-text-secondary">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No se encontraron cursos</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formula Editor Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCourse(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="relative bg-bb-card border border-bb-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
              style={{ maxHeight: '92vh' }}
            >
              <AdminGradingFormulaEditor
                courseId={selectedCourse.id}
                courseName={selectedCourse.nombre}
                onClose={() => setSelectedCourse(null)}
                onSaved={handleSaved}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-component: single course row ────────────────────────────────────────
function CourseRow({
  course,
  hasFormula,
  onClick,
}: {
  course: CourseRow;
  hasFormula: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-bb-card border border-bb-border rounded-2xl hover:border-blue-500/40 hover:bg-bb-card/80 transition-all text-left group"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${hasFormula ? 'bg-green-500/15 border border-green-500/25' : 'bg-bb-darker border border-bb-border'}`}>
        {hasFormula ? (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        ) : (
          <Calculator className="w-4 h-4 text-bb-text-secondary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-bb-text truncate">{course.nombre}</p>
        <p className="text-xs text-bb-text-secondary truncate">
          {[course.codigo, course.facultad].filter(Boolean).join(' · ') || 'Sin código/facultad'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${hasFormula ? 'bg-green-500/10 text-green-400 border-green-500/25' : 'bg-amber-500/10 text-amber-400 border-amber-500/25'}`}>
          {hasFormula ? 'Editar' : 'Configurar'}
        </span>
        <ChevronRight className="w-4 h-4 text-bb-text-secondary group-hover:text-bb-text transition-colors" />
      </div>
    </motion.button>
  );
}
