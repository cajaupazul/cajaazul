'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calculator, Loader2, X } from 'lucide-react';

// ─── Shared formula types (also exported for AdminGradingFormulaEditor) ────────
export type RoundingRule = 'none' | 'round' | 'floor';

export interface GradeComponent {
  id: string;
  label: string;
  max_pts: number;
  roundingRule: RoundingRule;
}

export interface GradingSection {
  id: string;
  label: string;
  type: 'standard' | 'average';
  max_pts: number;
  components: GradeComponent[];
  roundingRule: RoundingRule;
  description?: string;
}

export interface GradingFormula {
  version: number;
  sections: GradingSection[];
  passing_score?: number;
  notes?: string;
}

// ─── Migrate old formulas ─────────────────────────────────────────────────────
export function migrateFormula(raw: any): GradingFormula {
  if (!raw) return { version: 1, sections: [], passing_score: 11 };

  const isNewSchema = Array.isArray(raw.sections) && raw.sections.every((s: any) => s && s.max_pts !== undefined);
  if (isNewSchema) {
    return {
      version: raw.version ?? 1,
      sections: (raw.sections || []).map((s: any) => ({
        id: s.id || Math.random().toString(36).slice(2, 9),
        label: s.label || '',
        type: s.type || 'standard',
        max_pts: s.max_pts ?? 0,
        description: s.description || '',
        roundingRule: s.roundingRule || 'round',
        components: (s.components || []).map((c: any) => ({
          id: c.id || Math.random().toString(36).slice(2, 9),
          label: c.label || '',
          max_pts: c.max_pts ?? 0,
          roundingRule: c.roundingRule || 'none',
        })),
      })),
      passing_score: raw.passing_score ?? 11,
      notes: raw.notes || '',
    };
  }

  // Old weight-based schema migration
  const rawSections = raw.sections || [];
  const sumWeights = rawSections.reduce((sum: number, sec: any) => sum + (sec.weight ?? sec.max_pts ?? 0), 0);
  const scale = sumWeights > 25 ? 20 / sumWeights : 1;

  const sections: GradingSection[] = rawSections.map((s: any) => {
    const sectionWeight = s.weight ?? s.max_pts ?? 0;
    const max_pts = sectionWeight * scale;
    const labelLower = (s.label || '').toLowerCase();
    const hasPcComponent = s.components?.some((c: any) => c.type === 'PC' || (c.label || '').toLowerCase().includes('pc'));
    const isAveraged =
      hasPcComponent ||
      labelLower.includes('práctica') ||
      labelLower.includes('calificada') ||
      labelLower.includes('pc') ||
      labelLower.includes('trabajo') ||
      labelLower.includes('tp') ||
      labelLower.includes('taller') ||
      labelLower.includes('laboratorio');

    const sectionType = isAveraged ? 'average' : 'standard';

    const components: GradeComponent[] = (s.components || []).map((c: any) => {
      const compWeight = c.weight ?? c.max_pts ?? 0;
      let compMax = 0;
      if (sectionType === 'average') {
        compMax = max_pts / (s.components?.length || 1);
      } else {
        compMax = sectionWeight > 0 ? (compWeight / sectionWeight) * max_pts : max_pts / (s.components?.length || 1);
      }
      return { id: c.id || Math.random().toString(36).slice(2, 9), label: c.label || '', max_pts: compMax, roundingRule: c.roundingRule || 'none' };
    });

    return { id: s.id || Math.random().toString(36).slice(2, 9), label: s.label || '', type: sectionType, max_pts, roundingRule: s.roundingRule || 'round', description: s.description || '', components };
  });

  return { version: raw.version ?? 1, sections, passing_score: raw.passing_score ?? 11, notes: raw.notes || '' };
}

// ─── Calculation helpers ──────────────────────────────────────────────────────
function applyRound(val: number, rule: RoundingRule): number {
  if (rule === 'round') return Math.round(val);
  if (rule === 'floor') return Math.floor(val);
  return val;
}

interface SectionResult {
  contribution: number;
  exactAvg: number | null;
  roundedAvg: number | null;
  compContribs: Record<string, number>;
}

function calcSection(section: GradingSection, grades: Record<string, string>): SectionResult {
  const compContribs: Record<string, number> = {};
  const components = section.components || [];
  const sectionMaxPts = section.max_pts ?? 0;

  if (section.type === 'average') {
    const values: number[] = [];
    for (const comp of components) {
      const raw = grades[comp.id];
      if (raw !== undefined && raw !== '') {
        const v = parseFloat(raw);
        values.push(!isNaN(v) ? Math.min(20, Math.max(0, v)) : 0);
      } else {
        // Unfilled counts as 0
        values.push(0);
      }
    }
    
    const exactAvg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const roundedAvg = applyRound(exactAvg, section.roundingRule || 'round');
    const contribution = (roundedAvg / 20) * sectionMaxPts;
    
    const perCompMax = sectionMaxPts / (components.length || 1);
    for (const comp of components) {
      const raw = grades[comp.id];
      const v = raw !== undefined && raw !== '' ? parseFloat(raw) : 0;
      compContribs[comp.id] = (!isNaN(v) ? Math.min(20, Math.max(0, v)) : 0) / 20 * perCompMax;
    }
    return { contribution, exactAvg, roundedAvg, compContribs };
  }

  // standard
  let totalContrib = 0;
  for (const comp of components) {
    const raw = grades[comp.id];
    let v = 0;
    if (raw !== undefined && raw !== '') {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) v = Math.min(20, Math.max(0, parsed));
    }
    // Round exams (like Parcial/Final)
    const roundedV = applyRound(v, 'round'); 
    const contrib = (roundedV / 20) * (comp.max_pts ?? 0);
    compContribs[comp.id] = contrib;
    totalContrib += contrib;
  }
  return { contribution: totalContrib, exactAvg: null, roundedAvg: null, compContribs };
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  courseId: string;
  courseName: string;
  onClose: () => void;
}

export default function StudentGradeCalculator({ courseId, courseName, onClose }: Props) {
  const [formula, setFormula] = useState<GradingFormula | null>(null);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Record<string, string>>({});

  const passing = formula?.passing_score ?? 11;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('course_grading_formulas')
        .select('formula_json')
        .eq('course_id', courseId)
        .maybeSingle();
      if (data?.formula_json) setFormula(migrateFormula(data.formula_json));
      setLoading(false);
    })();
  }, [courseId]);

  const sectionResults = useMemo<Record<string, SectionResult>>(() => {
    if (!formula) return {};
    const res: Record<string, SectionResult> = {};
    (formula.sections || []).forEach((sec) => { res[sec.id] = calcSection(sec, grades); });
    return res;
  }, [formula, grades]);

  const finalScore = useMemo<number>(() => {
    if (!formula) return 0;
    let total = 0;
    for (const sec of (formula.sections || [])) {
      total += sectionResults[sec.id]?.contribution || 0;
    }
    return total;
  }, [formula, sectionResults]);

  const allMax = formula?.sections?.reduce((s, sec) => s + (sec.max_pts ?? 0), 0) ?? 20;
  const hasAnyInput = Object.values(grades).some(v => v !== '');
  const passed = finalScore >= passing;
  const lacking = passed ? 0 : passing - finalScore;

  const setGrade = (compId: string, val: string) => setGrades((g) => ({ ...g, [compId]: val }));
  const reset = () => setGrades({});

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 bg-white dark:bg-zinc-900">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  // ── No formula ─────────────────────────────────────────────────────────
  if (!formula || (formula.sections || []).length === 0) {
    return (
      <div className="flex flex-col bg-white dark:bg-zinc-900" style={{ minHeight: 200 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">Calculadora</p>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[200px] uppercase tracking-wider">{courseName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 dark:text-zinc-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-2 p-6 text-center">
          <Calculator className="w-6 h-6 text-slate-300 dark:text-zinc-600 mb-1" />
          <p className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">Calculadora no configurada</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-[240px]">El administrador aún no ha definido la fórmula para este curso.</p>
        </div>
      </div>
    );
  }

  // ── Full calculator ────────────────────────────────────────────────────
  const resultBorder = !hasAnyInput ? 'border-slate-200 dark:border-white/10' : passed ? 'border-green-200 dark:border-green-500/30' : 'border-red-200 dark:border-red-500/30';
  const scoreColor = !hasAnyInput ? 'text-slate-400 dark:text-zinc-500' : passed ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
  const progBg = !hasAnyInput ? 'bg-slate-200 dark:bg-white/10' : passed ? 'bg-green-500' : 'bg-red-500';
  const progW = `${Math.min(100, (finalScore / allMax) * 100).toFixed(1)}%`;

  const statusText = !hasAnyInput ? 'Puntos / 20' : passed ? '✓ Aprobado' : `✗ Faltan ${lacking.toFixed(2)} pts`;
  const statusColor = !hasAnyInput ? 'text-slate-400 dark:text-zinc-500' : passed ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-zinc-950" style={{ maxHeight: '85vh' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 flex-shrink-0">
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-none mb-1">Calculadora</p>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[200px] uppercase tracking-wider">{courseName}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 dark:text-zinc-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 px-3 py-3 space-y-2.5">

        {/* ── Result card ────────────────────────────────────────────── */}
        <div className={`rounded-xl bg-white dark:bg-zinc-900 p-4 text-center transition-all duration-300 border ${resultBorder}`}>
          <div className={`text-[40px] font-bold tabular-nums leading-none mb-1.5 transition-colors duration-300 ${scoreColor}`} style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
            {finalScore.toFixed(2)}
          </div>
          <div className={`text-xs font-semibold mb-2 transition-colors duration-300 ${statusColor}`}>
            {statusText}
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mb-1.5">
            <div className={`h-full rounded-full transition-all duration-500 ${progBg}`} style={{ width: progW }} />
          </div>
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 dark:text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Aprobado</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Desaprobado</span>
          </div>
        </div>

        {/* ── Section cards ───────────────────────────────────────────── */}
        {(formula.sections || []).map((section) => {
          const result = sectionResults[section.id];
          const isAvg = section.type === 'average';
          const components = section.components || [];
          const perCompMax = isAvg ? (section.max_pts ?? 0) / (components.length || 1) : 0;

          return (
            <div key={section.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">
                  {section.label}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">{section.max_pts} pts máx</span>
              </div>

              <div className="px-3 pb-2 grid grid-cols-2 gap-2">
                {components.map((comp) => {
                  const compMax = isAvg ? perCompMax : (comp.max_pts ?? 0);
                  const grade = grades[comp.id] ?? '';
                  const contrib = result?.compContribs[comp.id] ?? 0;
                  const hasGrade = grade !== '';

                  return (
                    <div key={comp.id} className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400 flex justify-between">
                        {comp.label}
                        <span className="font-normal opacity-70">({compMax % 1 === 0 ? compMax.toFixed(0) : compMax.toFixed(1)} pts)</span>
                      </label>
                      <input
                        type="number" min={0} max={20} step={0.5}
                        value={grade}
                        onChange={(e) => setGrade(comp.id, e.target.value)}
                        placeholder="0-20"
                        className="w-full border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-800 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950/50 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}
                      />
                      <p className={`text-[9px] mt-0.5 ${hasGrade ? 'text-green-600 dark:text-green-500' : 'text-slate-400 dark:text-zinc-500'}`} style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                        +{contrib.toFixed(2)} pts
                      </p>
                    </div>
                  );
                })}
              </div>

              {isAvg && (
                <div className="mx-3 mb-3 mt-1 flex items-center justify-between bg-slate-50 dark:bg-zinc-950/50 border border-slate-100 dark:border-white/5 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">Promedio</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-zinc-500 tabular-nums">
                      {result?.exactAvg !== null ? result.exactAvg.toFixed(2) : '0.00'}
                    </span>
                    <span className="text-slate-300 dark:text-zinc-600">→</span>
                    <span className={`text-sm font-bold tabular-nums ${result && result.roundedAvg !== null && result.roundedAvg >= passing ? 'text-green-600 dark:text-green-500' : 'text-slate-700 dark:text-zinc-300'}`}>
                      {result?.roundedAvg !== null ? result.roundedAvg : '0'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={reset} className="w-full py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors font-medium">
          Limpiar notas
        </button>

      </div>
    </div>
  );
}
