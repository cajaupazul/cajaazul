'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Save, X, AlertCircle, CheckCircle2, Loader2, ChevronRight, GraduationCap, BookOpen, Layers, Lightbulb } from 'lucide-react';
import type { GradingFormula, GradingSection, GradeComponent, RoundingRule } from './StudentGradeCalculator';
import { migrateFormula } from './StudentGradeCalculator';

// ─── helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function sectionTotal(sections: GradingSection[]) {
  return sections.reduce((s, sec) => s + (sec.max_pts || 0), 0);
}

// ─── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: 'PC + Exámenes',
    description: '4 PCs (8 pts) + Parcial & Final (12 pts)',
    icon: <GraduationCap className="w-4 h-4" />,
    build: () => {
      const pcId = uid(), exId = uid();
      return [
        {
          id: pcId, label: 'Prácticas Calificadas', type: 'average' as const, max_pts: 8, roundingRule: 'round' as RoundingRule,
          description: '4 prácticas · el promedio se redondea al entero más cercano',
          components: [
            { id: uid(), label: 'PC 1', max_pts: 2, roundingRule: 'none' as RoundingRule },
            { id: uid(), label: 'PC 2', max_pts: 2, roundingRule: 'none' as RoundingRule },
            { id: uid(), label: 'PC 3', max_pts: 2, roundingRule: 'none' as RoundingRule },
            { id: uid(), label: 'PC 4', max_pts: 2, roundingRule: 'none' as RoundingRule },
          ],
        },
        {
          id: exId, label: 'Exámenes', type: 'standard' as const, max_pts: 12, roundingRule: 'none' as RoundingRule,
          description: '',
          components: [
            { id: uid(), label: 'Examen Parcial', max_pts: 6, roundingRule: 'none' as RoundingRule },
            { id: uid(), label: 'Examen Final', max_pts: 6, roundingRule: 'none' as RoundingRule },
          ],
        },
      ];
    },
  },
  {
    label: 'Solo Exámenes',
    description: 'Parcial (10 pts) + Final (10 pts)',
    icon: <BookOpen className="w-4 h-4" />,
    build: () => [
      {
        id: uid(), label: 'Exámenes', type: 'standard' as const, max_pts: 20, roundingRule: 'none' as RoundingRule,
        description: '',
        components: [
          { id: uid(), label: 'Examen Parcial', max_pts: 10, roundingRule: 'none' as RoundingRule },
          { id: uid(), label: 'Examen Final', max_pts: 10, roundingRule: 'none' as RoundingRule },
        ],
      },
    ],
  },
  {
    label: 'PC + Parcial + Final',
    description: '3 PCs (5 pts) + Parcial (7 pts) + Final (8 pts)',
    icon: <Layers className="w-4 h-4" />,
    build: () => [
      {
        id: uid(), label: 'Prácticas Calificadas', type: 'average' as const, max_pts: 5, roundingRule: 'round' as RoundingRule,
        description: '3 prácticas · promedio redondeado',
        components: [
          { id: uid(), label: 'PC 1', max_pts: 2, roundingRule: 'none' as RoundingRule },
          { id: uid(), label: 'PC 2', max_pts: 2, roundingRule: 'none' as RoundingRule },
          { id: uid(), label: 'PC 3', max_pts: 1, roundingRule: 'none' as RoundingRule },
        ],
      },
      {
        id: uid(), label: 'Exámenes', type: 'standard' as const, max_pts: 15, roundingRule: 'none' as RoundingRule,
        description: '',
        components: [
          { id: uid(), label: 'Examen Parcial', max_pts: 7, roundingRule: 'none' as RoundingRule },
          { id: uid(), label: 'Examen Final', max_pts: 8, roundingRule: 'none' as RoundingRule },
        ],
      },
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

  // Fetch existing formula
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

  // Save
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

  // Section mutations
  const addSection = () => {
    const sec: GradingSection = { id: uid(), label: 'Nueva Sección', type: 'standard', max_pts: 0, components: [], roundingRule: 'none' };
    setFormula(f => ({ ...f, sections: [...f.sections, sec] }));
  };
  const removeSection = (id: string) => setFormula(f => ({ ...f, sections: f.sections.filter(s => s.id !== id) }));
  const updateSection = (id: string, patch: Partial<GradingSection>) =>
    setFormula(f => ({ ...f, sections: f.sections.map(s => s.id === id ? { ...s, ...patch } : s) }));

  // Component mutations
  const addComponent = (secId: string) => {
    const comp: GradeComponent = { id: uid(), label: '', max_pts: 0, roundingRule: 'none' };
    const sec = formula.sections.find(s => s.id === secId);
    if (!sec) return;
    updateSection(secId, { components: [...sec.components, comp] });
  };
  const removeComponent = (secId: string, compId: string) => {
    const sec = formula.sections.find(s => s.id === secId);
    if (!sec) return;
    updateSection(secId, { components: sec.components.filter(c => c.id !== compId) });
  };
  const updateComponent = (secId: string, compId: string, patch: Partial<GradeComponent>) => {
    const sec = formula.sections.find(s => s.id === secId);
    if (!sec) return;
    updateSection(secId, { components: sec.components.map(c => c.id === compId ? { ...c, ...patch } : c) });
  };

  const totalPts = sectionTotal(formula.sections);
  const isValid = formula.sections.length === 0 || Math.abs(totalPts - 20) < 0.01;

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 bg-white">
        <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  //  STEP 1 — Choose template
  // ──────────────────────────────────────────────────────────────────────
  if (step === 'template') {
    return (
      <div className="flex flex-col bg-white" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Configurar Calculadora</h2>
            <p className="text-xs text-slate-400 truncate max-w-[260px]">{courseName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600 leading-relaxed">
              Elige una plantilla del sílabo del curso. Puedes modificar los campos después.
            </p>
          </div>

          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plantillas rápidas</p>

          <div className="space-y-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => {
                  setFormula(f => ({ ...f, sections: tpl.build() }));
                  setStep('edit');
                }}
                className="w-full flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                  {tpl.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{tpl.label}</p>
                  <p className="text-xs text-slate-400">{tpl.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('edit')}
            className="w-full py-3 text-sm font-medium text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
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
    <div className="flex flex-col bg-white" style={{ maxHeight: '92vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          {!hasExisting && (
            <button
              onClick={() => setStep('template')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          )}
          <div>
            <h2 className="text-sm font-bold text-slate-800">Editor de Fórmula</h2>
            <p className="text-xs text-slate-400 truncate max-w-[240px]">{courseName}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Points progress bar */}
      <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Puntos asignados</span>
          <span className={`text-xs font-bold tabular-nums ${isValid ? 'text-green-600' : totalPts > 20 ? 'text-red-500' : 'text-amber-500'}`}>
            {totalPts.toFixed(1)} / 20 pts
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isValid ? 'bg-green-500' : totalPts > 20 ? 'bg-red-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min((totalPts / 20) * 100, 100)}%` }}
          />
        </div>
        {!isValid && formula.sections.length > 0 && (
          <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {totalPts < 20 ? `Faltan ${(20 - totalPts).toFixed(1)} pts` : `Excede ${(totalPts - 20).toFixed(1)} pts`}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Passing score */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Nota mínima aprobatoria:</span>
          <input
            type="number" min={1} max={20} step={0.5}
            value={formula.passing_score ?? 11}
            onChange={(e) => setFormula(f => ({ ...f, passing_score: parseFloat(e.target.value) || 11 }))}
            className="w-12 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 text-center focus:border-blue-300 outline-none bg-slate-50"
          />
          <span className="text-slate-400">/ 20</span>
        </div>

        {/* Sections */}
        {(formula.sections || []).map((section) => {
          const isAvg = section.type === 'average';
          const compSum = (section.components || []).reduce((s, c) => s + (c.max_pts ?? 0), 0);
          const compSumOk = isAvg || Math.abs(compSum - (section.max_pts ?? 0)) < 0.01;

          return (
            <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Section config */}
              <div className="bg-slate-50 px-4 py-3 space-y-2.5">
                {/* Row 1: name + type + delete */}
                <div className="flex items-center gap-2">
                  <input
                    value={section.label}
                    onChange={(e) => updateSection(section.id, { label: e.target.value })}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:border-blue-300 outline-none"
                    placeholder="Nombre de sección"
                  />
                  <select
                    value={section.type}
                    onChange={(e) => updateSection(section.id, { type: e.target.value as any })}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:border-blue-300 outline-none"
                  >
                    <option value="standard">Suma directa</option>
                    <option value="average">Promedio (PC)</option>
                  </select>
                  <button
                    onClick={() => removeSection(section.id)}
                    className="p-1.5 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Row 2: max pts + rounding (if average) */}
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <label className="flex items-center gap-1.5">
                    Puntos del total:
                    <input
                      type="number" min={0} max={20} step={0.5}
                      value={section.max_pts}
                      onChange={(e) => updateSection(section.id, { max_pts: parseFloat(e.target.value) || 0 })}
                      className="w-14 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 text-center focus:border-blue-300 outline-none"
                    />
                    <span className="text-slate-400">/ 20</span>
                  </label>
                  {isAvg && (
                    <label className="flex items-center gap-1.5">
                      Redondeo:
                      <select
                        value={section.roundingRule}
                        onChange={(e) => updateSection(section.id, { roundingRule: e.target.value as RoundingRule })}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:border-blue-300 outline-none"
                      >
                        <option value="round">Normal (0.5↑)</option>
                        <option value="floor">Hacia abajo</option>
                        <option value="none">Sin redondeo</option>
                      </select>
                    </label>
                  )}
                </div>

                {/* Row 3: description */}
                <input
                  value={section.description ?? ''}
                  onChange={(e) => updateSection(section.id, { description: e.target.value })}
                  className="w-full bg-transparent text-xs text-slate-400 border-b border-dashed border-slate-200 focus:border-blue-300 outline-none py-0.5 placeholder:text-slate-300"
                  placeholder="Descripción opcional (ej: 4 prácticas · promedio redondeado)"
                />
              </div>

              {/* Components */}
              <div className="divide-y divide-slate-100">
                {isAvg && (
                  <p className="px-4 py-2 text-xs text-blue-500 bg-blue-50/60 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    Modo promedio: los componentes se promedian; los puntos se calculan del total de la sección.
                  </p>
                )}

                {!isAvg && !compSumOk && section.components.length > 0 && (
                  <p className="px-4 py-2 text-xs text-amber-500 bg-amber-50 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    Los componentes suman {compSum.toFixed(1)} pts (deben sumar {section.max_pts} pts)
                  </p>
                )}

                {(section.components || []).map((comp) => (
                  <div key={comp.id} className="flex items-center gap-2 px-4 py-2.5">
                    <input
                      value={comp.label}
                      onChange={(e) => updateComponent(section.id, comp.id, { label: e.target.value })}
                      className="flex-1 text-sm text-slate-700 bg-transparent border-b border-dashed border-slate-200 focus:border-blue-300 outline-none py-0.5 font-medium"
                      placeholder="Ej: PC 1, Parcial..."
                    />
                    {!isAvg && (
                      <label className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                        <input
                          type="number" min={0} max={20} step={0.5}
                          value={comp.max_pts}
                          onChange={(e) => updateComponent(section.id, comp.id, { max_pts: parseFloat(e.target.value) || 0 })}
                          className="w-12 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 text-center focus:border-blue-300 outline-none"
                        />
                        <span>pts</span>
                      </label>
                    )}
                    <button
                      onClick={() => removeComponent(section.id, comp.id)}
                      className="p-1 rounded text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addComponent(section.id)}
                  className="w-full py-2 text-xs font-medium text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Agregar {isAvg ? 'práctica' : 'componente'}
                </button>
              </div>
            </div>
          );
        })}

        {/* Add section */}
        <button
          onClick={addSection}
          className="w-full py-3 text-sm font-medium text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 hover:border-slate-300 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Agregar sección
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0 bg-white">
        <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
