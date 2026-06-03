'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  Save,
  Calculator,
  GripVertical,
  Info,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ─────────────────────────────────────────────────────────────────
export type GradeComponentType = 'PC' | 'EXAM' | 'TRABAJO' | 'OTRO';

export interface GradeComponent {
  id: string; // local uuid
  label: string; // e.g. "PC1", "Parcial", "Final"
  type: GradeComponentType;
  weight: number; // percentage 0-100
  roundingRule: 'none' | 'round' | 'floor'; // how to round this grade
  subItems?: GradeSubItem[]; // optional nested breakdown (e.g. PC1 might have lab + exam)
}

export interface GradeSubItem {
  id: string;
  label: string;
  weight: number; // percentage within parent component
}

export interface GradingSection {
  id: string;
  label: string; // e.g. "Promedio de Trabajo", "Promedio de Exámenes"
  weight: number; // percentage of final grade
  components: GradeComponent[];
  roundingRule: 'none' | 'round' | 'floor';
  subFormula?: string; // optional description
}

export interface GradingFormula {
  version: number;
  sections: GradingSection[];
  finalRoundingRule: 'none' | 'round' | 'floor';
  notes?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2);
}

const TYPE_COLORS: Record<GradeComponentType, string> = {
  PC: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  EXAM: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  TRABAJO: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  OTRO: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const TYPE_LABELS: Record<GradeComponentType, string> = {
  PC: 'Práctica Calificada',
  EXAM: 'Examen',
  TRABAJO: 'Trabajo',
  OTRO: 'Otro',
};

interface Props {
  courseId: string;
  courseName: string;
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Default empty section ──────────────────────────────────────────────────
function newSection(label = 'Nueva Sección'): GradingSection {
  return {
    id: uid(),
    label,
    weight: 0,
    components: [],
    roundingRule: 'round',
  };
}

function newComponent(label = ''): GradeComponent {
  return {
    id: uid(),
    label,
    type: 'PC',
    weight: 0,
    roundingRule: 'round',
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AdminGradingFormulaEditor({
  courseId,
  courseName,
  onClose,
  onSaved,
}: Props) {
  const [formula, setFormula] = useState<GradingFormula>({
    version: 1,
    sections: [],
    finalRoundingRule: 'round',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});

  // ── Fetch existing formula ─────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_grading_formulas')
        .select('formula_json')
        .eq('course_id', courseId)
        .maybeSingle();

      if (!error && data?.formula_json) {
        const loaded = data.formula_json as GradingFormula;
        setFormula(loaded);
        // Expand all sections by default
        const expanded: Record<string, boolean> = {};
        loaded.sections?.forEach((s) => (expanded[s.id] = true));
        setExpandedSections(expanded);
      }
      setLoading(false);
    };
    fetch();
  }, [courseId]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Save formula ───────────────────────────────────────────────────────
  const handleSave = async () => {
    // Validate total weights
    const totalWeight = formula.sections.reduce((s, sec) => s + sec.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      showToast('error', `Los pesos de las secciones deben sumar 100% (actualmente ${totalWeight.toFixed(1)}%)`);
      return;
    }

    setSaving(true);
    const payload = { ...formula, version: (formula.version || 0) + 1 };

    const { error } = await supabase
      .from('course_grading_formulas')
      .upsert(
        { course_id: courseId, formula_json: payload },
        { onConflict: 'course_id' }
      );

    setSaving(false);
    if (error) {
      showToast('error', 'Error al guardar: ' + error.message);
    } else {
      setFormula(payload);
      showToast('success', '¡Fórmula guardada exitosamente!');
      onSaved?.();
    }
  };

  // ── Section mutations ──────────────────────────────────────────────────
  const addSection = () => {
    const sec = newSection();
    setFormula((f) => ({ ...f, sections: [...f.sections, sec] }));
    setExpandedSections((e) => ({ ...e, [sec.id]: true }));
  };

  const removeSection = (sectionId: string) => {
    setFormula((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== sectionId) }));
  };

  const updateSection = (sectionId: string, patch: Partial<GradingSection>) => {
    setFormula((f) => ({
      ...f,
      sections: f.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    }));
  };

  // ── Component mutations ────────────────────────────────────────────────
  const addComponent = (sectionId: string) => {
    const comp = newComponent();
    updateSection(sectionId, {
      components: [
        ...(formula.sections.find((s) => s.id === sectionId)?.components || []),
        comp,
      ],
    });
  };

  const removeComponent = (sectionId: string, compId: string) => {
    const section = formula.sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      components: section.components.filter((c) => c.id !== compId),
    });
  };

  const updateComponent = (sectionId: string, compId: string, patch: Partial<GradeComponent>) => {
    const section = formula.sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      components: section.components.map((c) => (c.id === compId ? { ...c, ...patch } : c)),
    });
  };

  // ── Sub-items mutations ────────────────────────────────────────────────
  const addSubItem = (sectionId: string, compId: string) => {
    const section = formula.sections.find((s) => s.id === sectionId);
    const comp = section?.components.find((c) => c.id === compId);
    if (!comp) return;
    updateComponent(sectionId, compId, {
      subItems: [...(comp.subItems || []), { id: uid(), label: '', weight: 0 }],
    });
  };

  const removeSubItem = (sectionId: string, compId: string, subId: string) => {
    const section = formula.sections.find((s) => s.id === sectionId);
    const comp = section?.components.find((c) => c.id === compId);
    if (!comp) return;
    updateComponent(sectionId, compId, {
      subItems: (comp.subItems || []).filter((si) => si.id !== subId),
    });
  };

  const updateSubItem = (sectionId: string, compId: string, subId: string, patch: Partial<GradeSubItem>) => {
    const section = formula.sections.find((s) => s.id === sectionId);
    const comp = section?.components.find((c) => c.id === compId);
    if (!comp) return;
    updateComponent(sectionId, compId, {
      subItems: (comp.subItems || []).map((si) => (si.id === subId ? { ...si, ...patch } : si)),
    });
  };

  // ── Weight helpers ─────────────────────────────────────────────────────
  const totalSectionWeight = formula.sections.reduce((s, sec) => s + (sec.weight || 0), 0);
  const isWeightValid = Math.abs(totalSectionWeight - 100) < 0.01;

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-bb-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-bb-text tracking-tight">Editor de Fórmula</h2>
            <p className="text-xs text-bb-text-secondary truncate max-w-[280px]">{courseName}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-bb-darker text-bb-text-secondary hover:text-bb-text transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* Weight summary bar */}
        <div className={`p-3 rounded-xl border text-sm font-semibold flex items-center gap-2 ${isWeightValid ? 'bg-green-500/10 border-green-500/25 text-green-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-300'}`}>
          {isWeightValid ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          Peso total de secciones: <span className="ml-auto font-black">{totalSectionWeight.toFixed(1)}% / 100%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-bb-darker rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isWeightValid ? 'bg-green-500' : totalSectionWeight > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(totalSectionWeight, 100)}%` }}
          />
        </div>

        {/* Sections */}
        {formula.sections.map((section, sIdx) => (
          <div key={section.id} className="border border-bb-border rounded-2xl overflow-hidden bg-bb-darker/30">
            {/* Section header */}
            <div className="flex items-center gap-3 p-4 bg-bb-darker/50">
              <button
                onClick={() => setExpandedSections((e) => ({ ...e, [section.id]: !e[section.id] }))}
                className="text-bb-text-secondary hover:text-bb-text transition-colors"
              >
                {expandedSections[section.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <div className="flex-1 flex flex-wrap items-center gap-2">
                <input
                  value={section.label}
                  onChange={(e) => updateSection(section.id, { label: e.target.value })}
                  className="bg-transparent text-sm font-bold text-bb-text border-b border-dashed border-bb-border focus:border-blue-400 outline-none flex-1 min-w-[120px] py-0.5"
                  placeholder="Nombre de sección..."
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-bb-text-secondary">Peso:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={section.weight}
                    onChange={(e) => updateSection(section.id, { weight: parseFloat(e.target.value) || 0 })}
                    className="w-16 bg-bb-card border border-bb-border rounded-lg px-2 py-1 text-xs font-bold text-bb-text text-center focus:border-blue-400 outline-none"
                  />
                  <span className="text-xs text-bb-text-secondary">%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-bb-text-secondary">Redondeo:</span>
                  <select
                    value={section.roundingRule}
                    onChange={(e) => updateSection(section.id, { roundingRule: e.target.value as any })}
                    className="bg-bb-card border border-bb-border rounded-lg px-2 py-1 text-xs text-bb-text focus:border-blue-400 outline-none"
                  >
                    <option value="none">Sin redondeo</option>
                    <option value="round">Redondeo normal</option>
                    <option value="floor">Hacia abajo</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => removeSection(section.id)}
                className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Section body */}
            <AnimatePresence initial={false}>
              {expandedSections[section.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    {/* Components */}
                    {section.components.map((comp, cIdx) => (
                      <div key={comp.id} className="border border-bb-border rounded-xl bg-bb-card overflow-hidden">
                        {/* Component row */}
                        <div className="flex items-center gap-2 p-3">
                          <button
                            onClick={() => setExpandedComponents((e) => ({ ...e, [comp.id]: !e[comp.id] }))}
                            className="text-bb-text-secondary hover:text-bb-text transition-colors"
                          >
                            {expandedComponents[comp.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>

                          <input
                            value={comp.label}
                            onChange={(e) => updateComponent(section.id, comp.id, { label: e.target.value })}
                            className="bg-transparent text-sm font-semibold text-bb-text border-b border-dashed border-bb-border focus:border-blue-400 outline-none flex-1 py-0.5 min-w-[80px]"
                            placeholder="Ej: PC1, Parcial..."
                          />

                          <select
                            value={comp.type}
                            onChange={(e) => updateComponent(section.id, comp.id, { type: e.target.value as GradeComponentType })}
                            className={`text-xs px-2 py-1 rounded-lg border font-medium outline-none ${TYPE_COLORS[comp.type]} bg-transparent`}
                          >
                            {Object.entries(TYPE_LABELS).map(([k, v]) => (
                              <option key={k} value={k} className="bg-bb-card text-bb-text">{v}</option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={comp.weight}
                              onChange={(e) => updateComponent(section.id, comp.id, { weight: parseFloat(e.target.value) || 0 })}
                              className="w-14 bg-bb-darker border border-bb-border rounded-lg px-2 py-1 text-xs font-bold text-bb-text text-center focus:border-blue-400 outline-none"
                            />
                            <span className="text-xs text-bb-text-secondary">%</span>
                          </div>

                          <select
                            value={comp.roundingRule}
                            onChange={(e) => updateComponent(section.id, comp.id, { roundingRule: e.target.value as any })}
                            className="bg-bb-darker border border-bb-border rounded-lg px-2 py-1 text-xs text-bb-text focus:border-blue-400 outline-none"
                          >
                            <option value="none">Sin rdnd.</option>
                            <option value="round">Rdnd. normal</option>
                            <option value="floor">Rdnd. abajo</option>
                          </select>

                          <button
                            onClick={() => removeComponent(section.id, comp.id)}
                            className="p-1 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Sub-items */}
                        <AnimatePresence initial={false}>
                          {expandedComponents[comp.id] && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden border-t border-bb-border bg-bb-darker/40"
                            >
                              <div className="p-3 space-y-2">
                                <p className="text-xs text-bb-text-secondary font-medium">Sub-componentes del {comp.label || 'componente'} (opcional, deben sumar 100%)</p>
                                {(comp.subItems || []).map((si) => (
                                  <div key={si.id} className="flex items-center gap-2">
                                    <input
                                      value={si.label}
                                      onChange={(e) => updateSubItem(section.id, comp.id, si.id, { label: e.target.value })}
                                      className="bg-bb-card border border-bb-border rounded-lg px-2 py-1.5 text-xs text-bb-text flex-1 focus:border-blue-400 outline-none"
                                      placeholder="Ej: Laboratorio, Examen..."
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={si.weight}
                                      onChange={(e) => updateSubItem(section.id, comp.id, si.id, { weight: parseFloat(e.target.value) || 0 })}
                                      className="w-14 bg-bb-card border border-bb-border rounded-lg px-2 py-1 text-xs font-bold text-bb-text text-center focus:border-blue-400 outline-none"
                                    />
                                    <span className="text-xs text-bb-text-secondary">%</span>
                                    <button onClick={() => removeSubItem(section.id, comp.id, si.id)} className="p-1 rounded text-red-400/60 hover:text-red-400 transition-colors">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => addSubItem(section.id, comp.id)}
                                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                                >
                                  <Plus className="w-3 h-3" /> Agregar sub-componente
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}

                    {/* Add component */}
                    <button
                      onClick={() => addComponent(section.id)}
                      className="w-full py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 border border-dashed border-blue-500/30 hover:border-blue-400/50 rounded-xl transition-all hover:bg-blue-400/5 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar componente
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Add section */}
        <button
          onClick={addSection}
          className="w-full py-3 text-sm font-bold text-bb-text-secondary hover:text-bb-text border border-dashed border-bb-border hover:border-blue-500/50 rounded-2xl transition-all hover:bg-bb-darker flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar sección de calificación
        </button>

        {/* Global settings */}
        <div className="border border-bb-border rounded-2xl p-4 space-y-3 bg-bb-darker/20">
          <h4 className="text-xs font-bold text-bb-text-secondary uppercase tracking-wider">Configuración Global</h4>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-bb-text-secondary">Redondeo promedio final:</span>
              <select
                value={formula.finalRoundingRule}
                onChange={(e) => setFormula((f) => ({ ...f, finalRoundingRule: e.target.value as any }))}
                className="bg-bb-card border border-bb-border rounded-lg px-2 py-1.5 text-xs text-bb-text focus:border-blue-400 outline-none"
              >
                <option value="none">Sin redondeo</option>
                <option value="round">Redondeo normal</option>
                <option value="floor">Hacia abajo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-bb-text-secondary block mb-1">Notas / descripción de la fórmula</label>
            <textarea
              value={formula.notes || ''}
              onChange={(e) => setFormula((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full bg-bb-card border border-bb-border rounded-xl px-3 py-2 text-xs text-bb-text focus:border-blue-400 outline-none resize-none placeholder:text-bb-text-secondary/50"
              placeholder="Ej: Fórmula basada en sílabo 2026-1. PC promedio no se redondea individualmente..."
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 p-5 border-t border-bb-border flex-shrink-0">
        <button onClick={onClose} className="text-sm text-bb-text-secondary hover:text-bb-text transition-colors font-medium">
          Cancelar
        </button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar Fórmula'}
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
