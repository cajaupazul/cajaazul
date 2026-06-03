'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Plus, Trash2, Save, Calculator, X, AlertCircle,
  CheckCircle2, Loader2, ChevronDown, ChevronRight,
  BookOpen, GraduationCap, Layers, Lightbulb,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GradingFormula, GradingSection, GradeComponent, RoundingRule } from './StudentGradeCalculator';
import { migrateFormula } from './StudentGradeCalculator';

// ─── helpers ────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function sectionTotal(sections: GradingSection[]) {
  return sections.reduce((s, sec) => s + (sec.max_pts || 0), 0);
}

// ─── Preset templates ─────────────────────────────────────────────────────────
interface Template {
  label: string;
  description: string;
  icon: React.ReactNode;
  sections: Omit<GradingSection, 'id' | 'components'>[];
  componentsFn: () => GradeComponent[][];
}

const TEMPLATES: Template[] = [
  {
    label: 'PC + Exámenes',
    description: '4 PCs (8pts) + Parcial & Final (12pts)',
    icon: <GraduationCap className="w-4 h-4" />,
    sections: [
      { label: 'Prácticas Calificadas', type: 'average', max_pts: 8, roundingRule: 'round', description: '4 prácticas · el promedio se redondea al entero más cercano' },
      { label: 'Exámenes', type: 'standard', max_pts: 12, roundingRule: 'round' },
    ],
    componentsFn: () => [
      [
        { id: uid(), label: 'PC 1', max_pts: 2, roundingRule: 'none' },
        { id: uid(), label: 'PC 2', max_pts: 2, roundingRule: 'none' },
        { id: uid(), label: 'PC 3', max_pts: 2, roundingRule: 'none' },
        { id: uid(), label: 'PC 4', max_pts: 2, roundingRule: 'none' },
      ],
      [
        { id: uid(), label: 'Examen Parcial', max_pts: 6, roundingRule: 'round' },
        { id: uid(), label: 'Examen Final', max_pts: 6, roundingRule: 'round' },
      ],
    ],
  },
  {
    label: 'Solo Exámenes',
    description: 'Parcial (10pts) + Final (10pts)',
    icon: <BookOpen className="w-4 h-4" />,
    sections: [
      { label: 'Exámenes', type: 'standard', max_pts: 20, roundingRule: 'round' },
    ],
    componentsFn: () => [
      [
        { id: uid(), label: 'Examen Parcial', max_pts: 10, roundingRule: 'round' },
        { id: uid(), label: 'Examen Final', max_pts: 10, roundingRule: 'round' },
      ],
    ],
  },
  {
    label: 'PC + Parcial + Final',
    description: '3 PCs (5pts) + Parcial (7pts) + Final (8pts)',
    icon: <Layers className="w-4 h-4" />,
    sections: [
      { label: 'Prácticas Calificadas', type: 'average', max_pts: 5, roundingRule: 'round', description: '3 prácticas · promedio redondeado' },
      { label: 'Exámenes', type: 'standard', max_pts: 15, roundingRule: 'round' },
    ],
    componentsFn: () => [
      [
        { id: uid(), label: 'PC 1', max_pts: 2, roundingRule: 'none' },
        { id: uid(), label: 'PC 2', max_pts: 2, roundingRule: 'none' },
        { id: uid(), label: 'PC 3', max_pts: 1, roundingRule: 'none' },
      ],
      [
        { id: uid(), label: 'Examen Parcial', max_pts: 7, roundingRule: 'round' },
        { id: uid(), label: 'Examen Final', max_pts: 8, roundingRule: 'round' },
      ],
    ],
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  courseId: string;
  courseName: string;
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminGradingFormulaEditor({ courseId, courseName, onClose, onSaved }: Props) {
  const [formula, setFormula] = useState<GradingFormula>({ version: 1, sections: [], passing_score: 11 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<'template' | 'edit'>('template');
  const [hasExisting, setHasExisting] = useState(false);

  // ── Fetch existing formula ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('course_grading_formulas')
        .select('formula_json')
        .eq('course_id', courseId)
        .maybeSingle();

      if (data?.formula_json) {
        const f = migrateFormula(data.formula_json);
        setFormula(f);
        const exp: Record<string, boolean> = {};
        (f.sections || []).forEach((s) => (exp[s.id] = true));
        setExpandedSections(exp);
        setHasExisting(true);
        setStep('edit');
      }
      setLoading(false);
    })();
  }, [courseId]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Apply template ─────────────────────────────────────────────────────
  const applyTemplate = (tpl: Template) => {
    const sections: GradingSection[] = tpl.sections.map((sec, i) => ({
      ...sec,
      id: uid(),
      components: tpl.componentsFn()[i] ?? [],
    }));
    const exp: Record<string, boolean> = {};
    sections.forEach((s) => (exp[s.id] = true));
    setFormula((f) => ({ ...f, sections, version: 1 }));
    setExpandedSections(exp);
    setStep('edit');
  };

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const total = sectionTotal(formula.sections);
    if (formula.sections.length > 0 && Math.abs(total - 20) > 0.01) {
      showToast('error', `Las secciones deben sumar 20 pts (actualmente ${total.toFixed(1)} pts)`);
      return;
    }
    setSaving(true);
    const payload = { ...formula, version: (formula.version ?? 0) + 1 };
    const { error } = await supabase
      .from('course_grading_formulas')
      .upsert({ course_id: courseId, formula_json: payload }, { onConflict: 'course_id' });
    setSaving(false);
    if (error) {
      showToast('error', 'Error al guardar: ' + error.message);
    } else {
      setFormula(payload);
      showToast('success', '¡Fórmula guardada!');
      onSaved?.();
    }
  };

  // ── Section mutations ──────────────────────────────────────────────────
  const addSection = () => {
    const sec: GradingSection = {
      id: uid(), label: 'Nueva Sección', type: 'standard',
      max_pts: 0, components: [], roundingRule: 'round',
    };
    setFormula((f) => ({ ...f, sections: [...f.sections, sec] }));
    setExpandedSections((e) => ({ ...e, [sec.id]: true }));
  };

  const removeSection = (id: string) =>
    setFormula((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== id) }));

  const updateSection = (id: string, patch: Partial<GradingSection>) =>
    setFormula((f) => ({
      ...f,
      sections: f.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  // ── Component mutations ────────────────────────────────────────────────
  const addComponent = (secId: string) => {
    const comp: GradeComponent = { id: uid(), label: '', max_pts: 0, roundingRule: 'round' };
    const sec = formula.sections.find((s) => s.id === secId);
    if (!sec) return;
    updateSection(secId, { components: [...sec.components, comp] });
  };

  const removeComponent = (secId: string, compId: string) => {
    const sec = formula.sections.find((s) => s.id === secId);
    if (!sec) return;
    updateSection(secId, { components: sec.components.filter((c) => c.id !== compId) });
  };

  const updateComponent = (secId: string, compId: string, patch: Partial<GradeComponent>) => {
    const sec = formula.sections.find((s) => s.id === secId);
    if (!sec) return;
    updateSection(secId, {
      components: sec.components.map((c) => (c.id === compId ? { ...c, ...patch } : c)),
    });
  };

  // ── Weight helpers ─────────────────────────────────────────────────────
  const totalPts = sectionTotal(formula.sections);
  const isValid = formula.sections.length === 0 || Math.abs(totalPts - 20) < 0.01;

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  //  STEP 1 — Choose template
  // ─────────────────────────────────────────────────────────────────────
  if (step === 'template') {
    return (
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bb-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-bb-text">Nueva Calculadora</h2>
              <p className="text-xs text-bb-text-secondary truncate max-w-[260px]">{courseName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bb-darker text-bb-text-secondary hover:text-bb-text transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex gap-2 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
            <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300/90 leading-relaxed">
              Elige una plantilla basada en el sílabo del curso. Puedes modificarla después.
            </p>
          </div>

          <h3 className="text-xs font-bold text-bb-text-secondary uppercase tracking-wider">Plantillas rápidas</h3>

          <div className="space-y-2">
            {TEMPLATES.map((tpl) => (
              <motion.button
                key={tpl.label}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => applyTemplate(tpl)}
                className="w-full flex items-center gap-4 p-4 bg-bb-darker/50 border border-bb-border rounded-2xl hover:border-blue-500/40 hover:bg-bb-card transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 flex-shrink-0">
                  {tpl.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-bb-text">{tpl.label}</p>
                  <p className="text-xs text-bb-text-secondary">{tpl.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-bb-text-secondary/50 group-hover:text-blue-400 transition-colors flex-shrink-0" />
              </motion.button>
            ))}
          </div>

          <button
            onClick={() => setStep('edit')}
            className="w-full py-3 text-sm font-semibold text-bb-text-secondary hover:text-bb-text border border-dashed border-bb-border hover:border-blue-500/40 rounded-2xl transition-all hover:bg-bb-darker/50"
          >
            + Crear desde cero
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  //  STEP 2 — Edit formula
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ maxHeight: '92vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-bb-border flex-shrink-0">
        <div className="flex items-center gap-3">
          {!hasExisting && (
            <button
              onClick={() => setStep('template')}
              className="p-1.5 rounded-lg text-bb-text-secondary hover:text-bb-text hover:bg-bb-darker transition-all"
              title="Volver a plantillas"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          )}
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Calculator className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-bb-text">Editor de Fórmula</h2>
            <p className="text-xs text-bb-text-secondary truncate max-w-[220px]">{courseName}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-bb-darker text-bb-text-secondary hover:text-bb-text transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Points bar */}
      <div className="px-5 py-3 border-b border-bb-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-bb-text-secondary font-medium">Puntos totales asignados</span>
          <span className={`text-xs font-black tabular-nums ${isValid ? 'text-green-400' : totalPts > 20 ? 'text-red-400' : 'text-amber-400'}`}>
            {totalPts.toFixed(1)} / 20 pts
          </span>
        </div>
        <div className="w-full h-2 bg-bb-darker rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isValid ? 'bg-green-500' : totalPts > 20 ? 'bg-red-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min((totalPts / 20) * 100, 100)}%` }}
          />
        </div>
        {!isValid && formula.sections.length > 0 && (
          <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {totalPts < 20 ? `Faltan ${(20 - totalPts).toFixed(1)} pts` : `Excede ${(totalPts - 20).toFixed(1)} pts`}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Config row */}
        <div className="flex items-center gap-3 text-xs text-bb-text-secondary">
          <span>Nota mínima aprobatoria:</span>
          <input
            type="number"
            min={1}
            max={20}
            step={0.5}
            value={formula.passing_score ?? 11}
            onChange={(e) => setFormula((f) => ({ ...f, passing_score: parseFloat(e.target.value) || 11 }))}
            className="w-14 bg-bb-card border border-bb-border rounded-lg px-2 py-1 text-xs font-bold text-bb-text text-center focus:border-blue-400 outline-none"
          />
          <span className="text-bb-text-secondary/60">/ 20</span>
        </div>

        {/* Sections */}
        {(formula.sections || []).map((section, sIdx) => {
          const compSum = (section.components || []).reduce((s, c) => s + (c.max_pts ?? 0), 0);
          const compSumOk = section.type === 'average' || Math.abs(compSum - (section.max_pts ?? 0)) < 0.01;

          return (
            <div key={section.id} className="border border-bb-border rounded-2xl overflow-hidden bg-bb-card">
              {/* Section header */}
              <div className="flex items-stretch gap-0">
                {/* Collapse toggle */}
                <button
                  onClick={() => setExpandedSections((e) => ({ ...e, [section.id]: !e[section.id] }))}
                  className="px-3 flex items-center text-bb-text-secondary hover:text-bb-text border-r border-bb-border hover:bg-bb-darker/40 transition-all"
                >
                  {expandedSections[section.id]
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {/* Section fields */}
                <div className="flex-1 p-3 space-y-2">
                  {/* Row 1: name + type */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={section.label}
                      onChange={(e) => updateSection(section.id, { label: e.target.value })}
                      className="flex-1 min-w-[120px] bg-transparent text-sm font-bold text-bb-text border-b border-dashed border-bb-border focus:border-blue-400 outline-none py-0.5"
                      placeholder="Nombre de sección..."
                    />
                    <select
                      value={section.type}
                      onChange={(e) => updateSection(section.id, { type: e.target.value as any })}
                      className="bg-bb-darker border border-bb-border rounded-lg px-2 py-1 text-xs text-bb-text focus:border-blue-400 outline-none"
                    >
                      <option value="standard">Suma directa</option>
                      <option value="average">Promedio (PC)</option>
                    </select>
                  </div>

                  {/* Row 2: max_pts + rounding */}
                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <label className="flex items-center gap-1.5 text-bb-text-secondary">
                      Máx:
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={section.max_pts}
                        onChange={(e) => updateSection(section.id, { max_pts: parseFloat(e.target.value) || 0 })}
                        className="w-14 bg-bb-card border border-bb-border rounded-lg px-2 py-1 font-bold text-bb-text text-center focus:border-blue-400 outline-none"
                      />
                      <span className="text-bb-text-secondary/60">pts del final</span>
                    </label>
                    {section.type === 'average' && (
                      <label className="flex items-center gap-1.5 text-bb-text-secondary">
                        Redondeo prom.:
                        <select
                          value={section.roundingRule}
                          onChange={(e) => updateSection(section.id, { roundingRule: e.target.value as RoundingRule })}
                          className="bg-bb-card border border-bb-border rounded-lg px-2 py-1 text-xs text-bb-text focus:border-blue-400 outline-none"
                        >
                          <option value="round">Normal (0.5→arriba)</option>
                          <option value="floor">Hacia abajo</option>
                          <option value="none">Sin redondeo</option>
                        </select>
                      </label>
                    )}
                  </div>

                  {/* Description */}
                  <input
                    value={section.description ?? ''}
                    onChange={(e) => updateSection(section.id, { description: e.target.value })}
                    className="w-full bg-transparent text-xs text-bb-text-secondary border-b border-dashed border-bb-border/50 focus:border-blue-400/50 outline-none py-0.5 placeholder:text-bb-text-secondary/30"
                    placeholder="Descripción opcional (ej: 4 prácticas · promedio redondeado)..."
                  />
                </div>

                {/* Delete */}
                <button
                  onClick={() => removeSection(section.id)}
                  className="px-3 text-red-400/40 hover:text-red-400 hover:bg-red-400/8 border-l border-bb-border transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Components */}
              <AnimatePresence initial={false}>
                {expandedSections[section.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden border-t border-bb-border bg-bb-darker/30"
                  >
                    <div className="p-3 space-y-2">
                      {/* Component validation for standard */}
                      {section.type === 'standard' && section.components.length > 0 && !compSumOk && (
                        <p className="text-xs text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3" />
                          Los componentes suman {compSum.toFixed(1)} pts (deben sumar {section.max_pts} pts)
                        </p>
                      )}

                      {/* PC-type note */}
                      {section.type === 'average' && (
                        <p className="text-xs text-blue-400/70 flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3" />
                          Modo promedio: los max_pts de cada componente no se usan — el promedio aplica el total de la sección.
                        </p>
                      )}

                      {/* Component rows */}
                      {(section.components || []).map((comp) => (
                        <div key={comp.id} className="flex items-center gap-2 bg-bb-card border border-bb-border rounded-xl p-2.5">
                          <input
                            value={comp.label}
                            onChange={(e) => updateComponent(section.id, comp.id, { label: e.target.value })}
                            className="flex-1 bg-transparent text-sm font-semibold text-bb-text border-b border-dashed border-bb-border/50 focus:border-blue-400 outline-none py-0.5 min-w-[80px]"
                            placeholder="Ej: PC 1, Parcial..."
                          />

                          {section.type === 'standard' && (
                            <label className="flex items-center gap-1.5 text-xs text-bb-text-secondary flex-shrink-0">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                step={0.5}
                                value={comp.max_pts}
                                onChange={(e) => updateComponent(section.id, comp.id, { max_pts: parseFloat(e.target.value) || 0 })}
                                className="w-12 bg-bb-darker border border-bb-border rounded-lg px-1.5 py-1 text-xs font-bold text-bb-text text-center focus:border-blue-400 outline-none"
                              />
                              pts
                            </label>
                          )}

                          <select
                            value={comp.roundingRule}
                            onChange={(e) => updateComponent(section.id, comp.id, { roundingRule: e.target.value as RoundingRule })}
                            className="bg-bb-darker border border-bb-border rounded-lg px-1.5 py-1 text-xs text-bb-text focus:border-blue-400 outline-none"
                          >
                            <option value="none">Sin rdnd.</option>
                            <option value="round">Rdnd. normal</option>
                            <option value="floor">Rdnd. abajo</option>
                          </select>

                          <button
                            onClick={() => removeComponent(section.id, comp.id)}
                            className="p-1 text-red-400/50 hover:text-red-400 hover:bg-red-400/8 rounded transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Add component */}
                      <button
                        onClick={() => addComponent(section.id)}
                        className="w-full py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 border border-dashed border-blue-500/25 hover:border-blue-400/40 rounded-xl hover:bg-blue-400/4 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        Agregar componente
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Add section */}
        <button
          onClick={addSection}
          className="w-full py-3 text-sm font-semibold text-bb-text-secondary hover:text-bb-text border border-dashed border-bb-border hover:border-blue-500/40 rounded-2xl transition-all hover:bg-bb-darker/50 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar sección
        </button>

        {/* Notes */}
        <div className="border border-bb-border rounded-2xl p-4 space-y-2 bg-bb-darker/20">
          <label className="text-xs font-bold text-bb-text-secondary uppercase tracking-wider">Notas para estudiantes</label>
          <textarea
            value={formula.notes ?? ''}
            onChange={(e) => setFormula((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full bg-bb-card border border-bb-border rounded-xl px-3 py-2 text-xs text-bb-text focus:border-blue-400 outline-none resize-none placeholder:text-bb-text-secondary/40"
            placeholder="Ej: Fórmula basada en sílabo 2026-1. Los parciales se redondean al entero más cercano..."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-bb-border flex-shrink-0">
        <button onClick={onClose} className="text-sm text-bb-text-secondary hover:text-bb-text transition-colors font-medium">
          Cancelar
        </button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2 text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
