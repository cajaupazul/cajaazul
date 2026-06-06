'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Save, X, AlertCircle, CheckCircle2, Loader2, ChevronRight, GraduationCap, BookOpen, Layers, Lightbulb } from 'lucide-react';
import type { GradingFormula, GradingSection, GradeComponent, RoundingRule } from './StudentGradeCalculator';
import { migrateFormula } from './StudentGradeCalculator';

// ─── helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function sectionTotalPercent(sections: GradingSection[]) {
  // max_pts is out of 20. Percent is max_pts * 5
  return sections.reduce((s, sec) => s + ((sec.max_pts || 0) * 5), 0);
}

// ─── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: 'PC + Exámenes',
    description: '4 PCs (40%) + Parcial (30%) & Final (30%)',
    icon: <GraduationCap className="w-4 h-4" />,
    build: () => {
      return [
        {
          id: uid(), label: 'Prácticas Calificadas', type: 'average' as const, max_pts: 8, roundingRule: 'round' as RoundingRule,
          description: '4 prácticas · promedio redondeado',
          components: [
            { id: uid(), label: 'PC 1', max_pts: 2, roundingRule: 'none' as RoundingRule },
            { id: uid(), label: 'PC 2', max_pts: 2, roundingRule: 'none' as RoundingRule },
            { id: uid(), label: 'PC 3', max_pts: 2, roundingRule: 'none' as RoundingRule },
            { id: uid(), label: 'PC 4', max_pts: 2, roundingRule: 'none' as RoundingRule },
          ],
        },
        {
          id: uid(), label: 'Examen Parcial', type: 'standard' as const, max_pts: 6, roundingRule: 'none' as RoundingRule,
          description: '',
          components: [{ id: uid(), label: 'Examen Parcial', max_pts: 6, roundingRule: 'none' as RoundingRule }],
        },
        {
          id: uid(), label: 'Examen Final', type: 'standard' as const, max_pts: 6, roundingRule: 'none' as RoundingRule,
          description: '',
          components: [{ id: uid(), label: 'Examen Final', max_pts: 6, roundingRule: 'none' as RoundingRule }],
        },
      ];
    },
  },
  {
    label: 'Solo Exámenes',
    description: 'Parcial (50%) + Final (50%)',
    icon: <BookOpen className="w-4 h-4" />,
    build: () => [
      {
        id: uid(), label: 'Examen Parcial', type: 'standard' as const, max_pts: 10, roundingRule: 'none' as RoundingRule,
        components: [{ id: uid(), label: 'Examen Parcial', max_pts: 10, roundingRule: 'none' as RoundingRule }],
      },
      {
        id: uid(), label: 'Examen Final', type: 'standard' as const, max_pts: 10, roundingRule: 'none' as RoundingRule,
        components: [{ id: uid(), label: 'Examen Final', max_pts: 10, roundingRule: 'none' as RoundingRule }],
      },
    ],
  },
  {
    label: 'Syllabus UP (Complejo)',
    description: 'Parcial (30%) + Final (30%) + PCs (28%) + Controles (10%) + Partic. (2%)',
    icon: <Layers className="w-4 h-4" />,
    build: () => [
      { id: uid(), label: 'Examen Parcial', type: 'standard' as const, max_pts: 6, roundingRule: 'none' as RoundingRule, components: [{ id: uid(), label: 'Examen Parcial', max_pts: 6, roundingRule: 'none' as RoundingRule }] },
      { id: uid(), label: 'Examen Final', type: 'standard' as const, max_pts: 6, roundingRule: 'none' as RoundingRule, components: [{ id: uid(), label: 'Examen Final', max_pts: 6, roundingRule: 'none' as RoundingRule }] },
      {
        id: uid(), label: 'Prácticas Calificadas', type: 'average' as const, max_pts: 5.6, roundingRule: 'round' as RoundingRule,
        components: [{ id: uid(), label: 'PC 1', max_pts: 1.12, roundingRule: 'none' as RoundingRule }, { id: uid(), label: 'PC 2', max_pts: 1.12, roundingRule: 'none' as RoundingRule }, { id: uid(), label: 'PC 3', max_pts: 1.12, roundingRule: 'none' as RoundingRule }, { id: uid(), label: 'PC 4', max_pts: 1.12, roundingRule: 'none' as RoundingRule }, { id: uid(), label: 'PC 5', max_pts: 1.12, roundingRule: 'none' as RoundingRule }],
      },
      {
        id: uid(), label: 'Controles de Lectura', type: 'average' as const, max_pts: 2, roundingRule: 'round' as RoundingRule,
        components: [{ id: uid(), label: 'Control 1', max_pts: 0.5, roundingRule: 'none' as RoundingRule }, { id: uid(), label: 'Control 2', max_pts: 0.5, roundingRule: 'none' as RoundingRule }, { id: uid(), label: 'Control 3', max_pts: 0.5, roundingRule: 'none' as RoundingRule }, { id: uid(), label: 'Control 4', max_pts: 0.5, roundingRule: 'none' as RoundingRule }],
      },
      { id: uid(), label: 'Participación en clase', type: 'standard' as const, max_pts: 0.4, roundingRule: 'none' as RoundingRule, components: [{ id: uid(), label: 'Participación', max_pts: 0.4, roundingRule: 'none' as RoundingRule }] },
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
  const [step, setStep] = useState<'template' | 'edit'>('template');
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('course_grading_formulas')
        .select('formula_json')
        .eq('course_id', courseId)
        .maybeSingle();
      if (data?.formula_json) {
        setFormula(migrateFormula(data.formula_json));
        setHasExisting(true);
        setStep('edit');
      }
      setLoading(false);
    })();
  }, [courseId]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    const total = sectionTotalPercent(formula.sections);
    if (formula.sections.length > 0 && Math.abs(total - 100) > 0.01) {
      showToast('error', `Los pesos deben sumar 100% (actualmente ${total.toFixed(1)}%)`);
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

  const addSection = () => {
    const sec: GradingSection = { id: uid(), label: 'Nueva Evaluación', type: 'average', max_pts: 0, components: [], roundingRule: 'round' };
    setFormula(f => ({ ...f, sections: [...f.sections, sec] }));
  };
  const removeSection = (id: string) => setFormula(f => ({ ...f, sections: f.sections.filter(s => s.id !== id) }));
  
  const updateSectionPercent = (id: string, percent: number) => {
    setFormula(f => ({
      ...f, sections: f.sections.map(s => {
        if (s.id !== id) return s;
        const newMaxPts = percent / 5; // 100% = 20 pts
        // Also update standard components to match the new weight if it only has 1 component (common for single exams)
        const newComps = s.components.map(c => ({
          ...c,
          max_pts: s.components.length === 1 ? newMaxPts : c.max_pts
        }));
        return { ...s, max_pts: newMaxPts, components: newComps };
      })
    }));
  };

  const updateSection = (id: string, patch: Partial<GradingSection>) =>
    setFormula(f => ({ ...f, sections: f.sections.map(s => s.id === id ? { ...s, ...patch } : s) }));

  const addComponent = (secId: string) => {
    const sec = formula.sections.find(s => s.id === secId);
    if (!sec) return;
    const compMax = sec.type === 'standard' ? 0 : (sec.max_pts / (sec.components.length + 1));
    const comp: GradeComponent = { id: uid(), label: `Elemento ${sec.components.length + 1}`, max_pts: compMax, roundingRule: 'none' };
    updateSection(secId, { components: [...sec.components, comp] });
  };
  
  const removeComponent = (secId: string, compId: string) => {
    const sec = formula.sections.find(s => s.id === secId);
    if (!sec) return;
    updateSection(secId, { components: sec.components.filter(c => c.id !== compId) });
  };

  const updateComponentPercent = (secId: string, compId: string, percentOfSection: number) => {
    const sec = formula.sections.find(s => s.id === secId);
    if (!sec) return;
    // For standard mode, the component max_pts should be a portion of the section's max_pts
    const newCompMaxPts = (percentOfSection / 100) * sec.max_pts;
    updateSection(secId, { components: sec.components.map(c => c.id === compId ? { ...c, max_pts: newCompMaxPts } : c) });
  };

  const updateComponent = (secId: string, compId: string, patch: Partial<GradeComponent>) => {
    const sec = formula.sections.find(s => s.id === secId);
    if (!sec) return;
    updateSection(secId, { components: sec.components.map(c => c.id === compId ? { ...c, ...patch } : c) });
  };

  const totalPercent = sectionTotalPercent(formula.sections);
  const isValid = formula.sections.length === 0 || Math.abs(totalPercent - 100) < 0.01;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 bg-white dark:bg-zinc-900">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300 dark:text-zinc-600" />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  //  STEP 1 — Choose template
  // ──────────────────────────────────────────────────────────────────────
  if (step === 'template') {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Configurar Evaluación</h2>
            <p className="text-xs text-slate-400 dark:text-zinc-500 truncate max-w-[260px] uppercase tracking-wider">{courseName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 dark:text-zinc-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl">
            <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              Elige una plantilla base según el sílabo. Luego podrás editar los porcentajes (%) fácilmente.
            </p>
          </div>

          <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Plantillas rápidas</p>

          <div className="space-y-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => { setFormula(f => ({ ...f, sections: tpl.build() })); setStep('edit'); }}
                className="w-full flex items-center gap-3 p-4 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-xl hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 flex-shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {tpl.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{tpl.label}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">{tpl.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('edit')}
            className="w-full py-3 text-sm font-medium text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 border border-dashed border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/30 rounded-xl transition-colors"
          >
            + Crear desde cero
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  //  STEP 2 — Edit formula
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-slate-50 dark:bg-zinc-950" style={{ maxHeight: '92vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          {!hasExisting && (
            <button onClick={() => setStep('template')} className="p-1 rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          )}
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-none mb-1">Editor de Porcentajes</h2>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[240px] uppercase tracking-wider">{courseName}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 dark:text-zinc-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Total del curso</span>
          <span className={`text-xs font-bold tabular-nums ${isValid ? 'text-green-600 dark:text-green-500' : totalPercent > 100 ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>
            {totalPercent.toFixed(1)}% / 100%
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isValid ? 'bg-green-500' : totalPercent > 100 ? 'bg-red-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(totalPercent, 100)}%` }}
          />
        </div>
        {!isValid && formula.sections.length > 0 && (
          <p className={`text-[10px] mt-1.5 flex items-center gap-1 font-medium ${totalPercent > 100 ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>
            <AlertCircle className="w-3 h-3" />
            {totalPercent < 100 ? `Falta ${(100 - totalPercent).toFixed(1)}%` : `Excede ${(totalPercent - 100).toFixed(1)}%`}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Sections */}
        {(formula.sections || []).map((section) => {
          const isAvg = section.type === 'average';
          const secPercent = (section.max_pts || 0) * 5;
          const compSumPts = (section.components || []).reduce((s, c) => s + (c.max_pts ?? 0), 0);
          const compSumPercent = isAvg ? 100 : (compSumPts / (section.max_pts || 1)) * 100;
          const compSumOk = isAvg || Math.abs(compSumPts - section.max_pts) < 0.01;

          return (
            <div key={section.id} className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
              <div className="bg-slate-50 dark:bg-zinc-950/50 px-3 py-3 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={section.label}
                    onChange={(e) => updateSection(section.id, { label: e.target.value })}
                    className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-md px-2.5 py-1.5 text-sm font-bold text-slate-800 dark:text-zinc-100 focus:border-blue-400 dark:focus:border-blue-500 outline-none"
                    placeholder="Nombre (ej: Parcial, Trabajos)"
                  />
                  <button onClick={() => removeSection(section.id)} className="p-1.5 rounded-md text-red-400 dark:text-red-500/80 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Peso:</span>
                    <input
                      type="number" min={0} max={100} step={1}
                      value={secPercent}
                      onChange={(e) => updateSectionPercent(section.id, parseFloat(e.target.value) || 0)}
                      className="w-12 bg-transparent text-sm font-bold text-slate-800 dark:text-zinc-100 text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-sm font-bold text-slate-400 dark:text-zinc-500">%</span>
                  </label>

                  <select
                    value={section.type}
                    onChange={(e) => updateSection(section.id, { type: e.target.value as any })}
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 focus:border-blue-400 dark:focus:border-blue-500 outline-none flex-1"
                  >
                    <option value="standard">Suma directa (Exámenes)</option>
                    <option value="average">Promedio (PCs, Controles)</option>
                  </select>
                </div>
                
                {isAvg && (
                  <div className="mt-2 flex items-center gap-2">
                     <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">Redondeo del promedio:</span>
                     <select
                        value={section.roundingRule}
                        onChange={(e) => updateSection(section.id, { roundingRule: e.target.value as RoundingRule })}
                        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-xs text-slate-600 dark:text-zinc-400 outline-none"
                      >
                        <option value="round">Normal (a favor si .5)</option>
                        <option value="floor">Hacia abajo</option>
                        <option value="none">Sin redondeo exacto</option>
                      </select>
                  </div>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {!isAvg && !compSumOk && section.components.length > 0 && (
                  <p className="px-3 py-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    Los sub-pesos suman {compSumPercent.toFixed(1)}% (deben sumar 100% de este bloque)
                  </p>
                )}

                {(section.components || []).map((comp) => {
                   const compPctOfSec = section.max_pts ? ((comp.max_pts / section.max_pts) * 100) : 0;
                   return (
                    <div key={comp.id} className="flex items-center gap-2 px-3 py-2">
                      <input
                        value={comp.label}
                        onChange={(e) => updateComponent(section.id, comp.id, { label: e.target.value })}
                        className="flex-1 text-xs text-slate-700 dark:text-zinc-300 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-zinc-600 focus:border-blue-400 dark:focus:border-blue-500 outline-none py-1 transition-colors"
                        placeholder="Nombre evaluación"
                      />
                      {!isAvg && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} max={100} step={1}
                            value={Math.round(compPctOfSec)}
                            onChange={(e) => updateComponentPercent(section.id, comp.id, parseFloat(e.target.value) || 0)}
                            className="w-10 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded px-1.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 text-center outline-none focus:border-blue-400"
                          />
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">% del bloque</span>
                        </div>
                      )}
                      <button onClick={() => removeComponent(section.id, comp.id)} className="p-1 rounded text-red-300 dark:text-red-500/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={() => addComponent(section.id)}
                  className="w-full py-2.5 text-[10px] font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-1 uppercase tracking-wider"
                >
                  <Plus className="w-3 h-3" />
                  Agregar {isAvg ? 'elemento al promedio' : 'sub-evaluación'}
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={addSection}
          className="w-full py-3 text-xs font-semibold text-slate-500 dark:text-zinc-400 border border-dashed border-slate-300 dark:border-white/20 rounded-xl hover:border-slate-400 dark:hover:border-white/40 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Nuevo Bloque de Evaluación
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 flex-shrink-0">
        <button onClick={onClose} className="text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
