'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calculator, Loader2, AlertCircle, X, ChevronDown, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GradingFormula, GradingSection, GradeComponent } from './AdminGradingFormulaEditor';

// ─── Types ─────────────────────────────────────────────────────────────────
interface StudentGrades {
  [componentId: string]: string; // value as string for controlled input
}

interface SubItemGrades {
  [subItemId: string]: string;
}

interface ComponentSubGrades {
  [componentId: string]: SubItemGrades;
}

// ─── Rounding helpers ────────────────────────────────────────────────────────
function applyRounding(val: number, rule: 'none' | 'round' | 'floor'): number {
  if (rule === 'round') return Math.round(val * 10) / 10; // round to 1 decimal, then Math.round handles .5
  if (rule === 'floor') return Math.floor(val);
  return val;
}

// Strict rounding: 14.5 → 15, 14.3 → 14
function smartRound(val: number): number {
  return Math.round(val);
}

function applyRoundingFull(val: number, rule: 'none' | 'round' | 'floor'): number {
  if (rule === 'round') return smartRound(val);
  if (rule === 'floor') return Math.floor(val);
  return Math.round(val * 100) / 100;
}

// ─── Calculate section average ─────────────────────────────────────────────
function calcComponentValue(
  comp: GradeComponent,
  grades: StudentGrades,
  subGrades: ComponentSubGrades
): number | null {
  // If the component has sub-items, compute weighted average of sub-items
  if (comp.subItems && comp.subItems.length > 0) {
    const subG = subGrades[comp.id] || {};
    let totalWeight = 0;
    let weightedSum = 0;
    let hasAny = false;

    for (const si of comp.subItems) {
      const raw = subG[si.id];
      if (raw !== undefined && raw !== '') {
        const v = parseFloat(raw);
        if (!isNaN(v)) {
          weightedSum += v * (si.weight / 100);
          totalWeight += si.weight;
          hasAny = true;
        }
      }
    }
    if (!hasAny) return null;
    const avg = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : weightedSum;
    return applyRounding(avg, comp.roundingRule);
  }

  // Simple grade
  const raw = grades[comp.id];
  if (raw === undefined || raw === '') return null;
  const v = parseFloat(raw);
  if (isNaN(v)) return null;
  return applyRounding(v, comp.roundingRule);
}

function calcSectionAverage(
  section: GradingSection,
  grades: StudentGrades,
  subGrades: ComponentSubGrades
): number | null {
  if (section.components.length === 0) return null;

  let weightedSum = 0;
  let totalUsedWeight = 0;
  let hasAny = false;

  for (const comp of section.components) {
    const val = calcComponentValue(comp, grades, subGrades);
    if (val !== null) {
      weightedSum += val * (comp.weight / 100);
      totalUsedWeight += comp.weight;
      hasAny = true;
    }
  }

  if (!hasAny) return null;

  // Scale to 0-20 scale (assume all weights together = section total)
  // If weights don't add up to 100, we normalize
  const avg = totalUsedWeight > 0 ? (weightedSum / totalUsedWeight) * 100 : weightedSum;
  return applyRoundingFull(avg, section.roundingRule);
}

// ─── Grade display helper ───────────────────────────────────────────────────
function gradeColor(grade: number | null): string {
  if (grade === null) return 'text-bb-text-secondary';
  if (grade >= 17) return 'text-green-400';
  if (grade >= 14) return 'text-blue-400';
  if (grade >= 11) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Main Component ─────────────────────────────────────────────────────────
interface Props {
  courseId: string;
  courseName: string;
  onClose: () => void;
}

export default function StudentGradeCalculator({ courseId, courseName, onClose }: Props) {
  const [formula, setFormula] = useState<GradingFormula | null>(null);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<StudentGrades>({});
  const [subGrades, setSubGrades] = useState<ComponentSubGrades>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // ── Fetch formula ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_grading_formulas')
        .select('formula_json')
        .eq('course_id', courseId)
        .maybeSingle();

      if (!error && data?.formula_json) {
        const f = data.formula_json as GradingFormula;
        setFormula(f);
        // Expand all sections
        const exp: Record<string, boolean> = {};
        f.sections?.forEach((s) => (exp[s.id] = true));
        setExpandedSections(exp);
      }
      setLoading(false);
    };
    fetch();
  }, [courseId]);

  // ── Grade mutations ────────────────────────────────────────────────────
  const setGrade = (compId: string, val: string) => {
    // Clamp input to 0-20
    setGrades((g) => ({ ...g, [compId]: val }));
  };

  const setSubGrade = (compId: string, subId: string, val: string) => {
    setSubGrades((sg) => ({
      ...sg,
      [compId]: { ...(sg[compId] || {}), [subId]: val },
    }));
  };

  const reset = () => {
    setGrades({});
    setSubGrades({});
  };

  // ── Calculations ───────────────────────────────────────────────────────
  const sectionAverages = useMemo(() => {
    if (!formula) return {};
    const avgs: Record<string, number | null> = {};
    formula.sections.forEach((sec) => {
      avgs[sec.id] = calcSectionAverage(sec, grades, subGrades);
    });
    return avgs;
  }, [formula, grades, subGrades]);

  const finalGrade = useMemo(() => {
    if (!formula) return null;
    let weightedSum = 0;
    let totalUsedWeight = 0;
    let hasAny = false;

    formula.sections.forEach((sec) => {
      const avg = sectionAverages[sec.id];
      if (avg !== null && avg !== undefined) {
        weightedSum += avg * (sec.weight / 100);
        totalUsedWeight += sec.weight;
        hasAny = true;
      }
    });

    if (!hasAny) return null;
    const raw = totalUsedWeight > 0 ? (weightedSum / totalUsedWeight) * 100 : weightedSum;
    return applyRoundingFull(raw, formula.finalRoundingRule);
  }, [formula, sectionAverages]);

  const finalGradeDisplay = finalGrade !== null ? finalGrade.toFixed(2) : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full max-h-[88vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-bb-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-bb-text tracking-tight">Calculadora de Notas</h2>
            <p className="text-xs text-bb-text-secondary truncate max-w-[240px]">{courseName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            title="Reiniciar notas"
            className="p-2 rounded-lg hover:bg-bb-darker text-bb-text-secondary hover:text-amber-400 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bb-darker text-bb-text-secondary hover:text-bb-text transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : !formula || formula.sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-4 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-bb-darker border border-bb-border flex items-center justify-center">
            <Calculator className="w-8 h-8 text-bb-text-secondary" />
          </div>
          <div>
            <p className="font-bold text-bb-text mb-1">Calculadora no disponible</p>
            <p className="text-sm text-bb-text-secondary">El administrador aún no ha configurado la fórmula de evaluación para este curso.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Notes */}
          {formula.notes && (
            <div className="flex gap-2.5 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-300/90">{formula.notes}</p>
            </div>
          )}

          {/* Sections */}
          {formula.sections.map((section) => {
            const secAvg = sectionAverages[section.id];
            return (
              <div key={section.id} className="border border-bb-border rounded-2xl overflow-hidden">
                {/* Section header */}
                <button
                  onClick={() => setExpandedSections((e) => ({ ...e, [section.id]: !e[section.id] }))}
                  className="w-full flex items-center justify-between p-4 bg-bb-darker/60 hover:bg-bb-darker transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={`w-4 h-4 text-bb-text-secondary transition-transform ${expandedSections[section.id] ? '' : '-rotate-90'}`}
                    />
                    <div className="text-left">
                      <p className="text-sm font-bold text-bb-text">{section.label}</p>
                      <p className="text-xs text-bb-text-secondary">Peso: {section.weight}% del promedio final</p>
                    </div>
                  </div>
                  <div className={`text-xl font-black tabular-nums ${gradeColor(secAvg)}`}>
                    {secAvg !== null ? secAvg.toFixed(1) : '–'}
                  </div>
                </button>

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
                        {section.components.map((comp) => {
                          const compVal = calcComponentValue(comp, grades, subGrades);
                          const hasSubItems = comp.subItems && comp.subItems.length > 0;

                          return (
                            <div key={comp.id} className="bg-bb-darker/40 border border-bb-border rounded-xl overflow-hidden">
                              {/* Component row */}
                              <div className="flex items-center gap-3 px-4 py-3">
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-bb-text">{comp.label || 'Componente'}</p>
                                  <p className="text-xs text-bb-text-secondary">
                                    Peso: {comp.weight}%
                                    {comp.roundingRule !== 'none' && ` · Redondeo: ${comp.roundingRule === 'round' ? 'normal' : 'abajo'}`}
                                  </p>
                                </div>

                                {!hasSubItems ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      max={20}
                                      step={0.1}
                                      value={grades[comp.id] || ''}
                                      onChange={(e) => setGrade(comp.id, e.target.value)}
                                      className="w-20 bg-bb-card border border-bb-border rounded-xl px-3 py-2 text-sm font-bold text-bb-text text-center focus:border-blue-400 outline-none focus:ring-1 focus:ring-blue-400/30 transition-all"
                                      placeholder="0.0"
                                    />
                                    <span className="text-xs text-bb-text-secondary w-4">/ 20</span>
                                  </div>
                                ) : (
                                  <div className={`text-lg font-black tabular-nums ${gradeColor(compVal)}`}>
                                    {compVal !== null ? compVal.toFixed(1) : '–'}
                                  </div>
                                )}
                              </div>

                              {/* Sub-items */}
                              {hasSubItems && (
                                <div className="border-t border-bb-border bg-bb-darker/40 p-3 space-y-2">
                                  {(comp.subItems || []).map((si) => (
                                    <div key={si.id} className="flex items-center gap-3">
                                      <p className="flex-1 text-xs text-bb-text-secondary">
                                        {si.label || 'Sub-componente'}
                                        <span className="ml-1 text-bb-text-secondary/60">({si.weight}%)</span>
                                      </p>
                                      <input
                                        type="number"
                                        min={0}
                                        max={20}
                                        step={0.1}
                                        value={(subGrades[comp.id] || {})[si.id] || ''}
                                        onChange={(e) => setSubGrade(comp.id, si.id, e.target.value)}
                                        className="w-18 bg-bb-card border border-bb-border rounded-lg px-2.5 py-1.5 text-sm font-bold text-bb-text text-center focus:border-blue-400 outline-none transition-all"
                                        style={{ width: '72px' }}
                                        placeholder="0.0"
                                      />
                                      <span className="text-xs text-bb-text-secondary">/ 20</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Final grade footer (always visible when formula loaded) */}
      {formula && formula.sections.length > 0 && (
        <div className="flex-shrink-0 border-t border-bb-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-bb-text-secondary font-medium uppercase tracking-wider">Promedio Final</p>
              <p className="text-xs text-bb-text-secondary mt-0.5">
                Redondeo: {formula.finalRoundingRule === 'round' ? 'Normal' : formula.finalRoundingRule === 'floor' ? 'Hacia abajo' : 'Sin redondeo'}
              </p>
            </div>
            <div className={`text-5xl font-black tabular-nums tracking-tight ${gradeColor(finalGrade)}`}>
              {finalGradeDisplay ?? '–'}
            </div>
          </div>
          {finalGrade !== null && (
            <div className="mt-3">
              <div className="w-full h-2.5 bg-bb-darker rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${finalGrade >= 17 ? 'bg-green-500' : finalGrade >= 14 ? 'bg-blue-500' : finalGrade >= 11 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${(finalGrade / 20) * 100}%` }}
                />
              </div>
              <p className={`text-xs font-bold mt-1.5 ${gradeColor(finalGrade)}`}>
                {finalGrade >= 17 ? '🏆 Excelente' : finalGrade >= 14 ? '✅ Aprobado' : finalGrade >= 11 ? '⚠️ En riesgo' : '❌ Desaprobado'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
