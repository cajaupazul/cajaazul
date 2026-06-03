'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Calculator, Loader2, X, RefreshCw, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Shared formula types (also exported for AdminGradingFormulaEditor) ────────
export type RoundingRule = 'none' | 'round' | 'floor';

export interface GradeComponent {
  id: string;
  label: string;     // "PC1", "Examen Parcial"
  max_pts: number;   // max contribution to section total
  roundingRule: RoundingRule;
}

export interface GradingSection {
  id: string;
  label: string;          // "Exámenes", "Prácticas Calificadas"
  type: 'standard' | 'average'; // average = PC-style (avg first, then apply max_pts)
  max_pts: number;        // max contribution to final grade (sections sum to 20)
  components: GradeComponent[];
  roundingRule: RoundingRule; // for averaged sections: how to round the computed average
  description?: string;   // shown below badge
}

export interface GradingFormula {
  version: number;
  sections: GradingSection[];
  passing_score?: number; // default 11
  notes?: string;
}

// ─── Rounding helper ─────────────────────────────────────────────────────────
function applyRound(val: number, rule: RoundingRule): number {
  if (rule === 'round') return Math.round(val);
  if (rule === 'floor') return Math.floor(val);
  return val;
}

// ─── Per-component contribution (pts earned) ──────────────────────────────────
function compContribution(grade: number, maxPts: number): number {
  // grade is 0-20, contribution is grade/20 * max_pts
  return (grade / 20) * maxPts;
}

// ─── Section contribution ─────────────────────────────────────────────────────
interface SectionResult {
  contribution: number | null; // pts earned towards final
  exactAvg: number | null;     // for 'average' type only — raw avg before rounding
  roundedAvg: number | null;   // for 'average' type only — after rounding
  compContribs: Record<string, number | null>; // per component
}

function calcSection(
  section: GradingSection,
  grades: Record<string, string>
): SectionResult {
  const compContribs: Record<string, number | null> = {};

  if (section.type === 'average') {
    // Average all entered grades (0-20 scale), then apply rounding, then multiply by max_pts/20
    const values: number[] = [];
    for (const comp of section.components) {
      const raw = grades[comp.id];
      if (raw !== undefined && raw !== '') {
        const v = parseFloat(raw);
        if (!isNaN(v)) values.push(v);
      }
    }
    if (values.length === 0) {
      section.components.forEach((c) => (compContribs[c.id] = null));
      return { contribution: null, exactAvg: null, roundedAvg: null, compContribs };
    }
    const exactAvg = values.reduce((a, b) => a + b, 0) / values.length;
    const roundedAvg = applyRound(exactAvg, section.roundingRule);
    // contribution = roundedAvg / 20 * section.max_pts
    const contribution = (roundedAvg / 20) * section.max_pts;
    // per-component contribution is proportional to rounded average
    for (const comp of section.components) {
      const raw = grades[comp.id];
      compContribs[comp.id] =
        raw !== undefined && raw !== '' && !isNaN(parseFloat(raw))
          ? (roundedAvg / 20) * (section.max_pts / section.components.length)
          : null;
    }
    return { contribution, exactAvg, roundedAvg, compContribs };
  }

  // standard: each component contributes independently via its own max_pts
  let total = 0;
  let hasAny = false;
  for (const comp of section.components) {
    const raw = grades[comp.id];
    if (raw !== undefined && raw !== '') {
      const v = parseFloat(raw);
      if (!isNaN(v)) {
        const contrib = compContribution(v, comp.max_pts);
        compContribs[comp.id] = contrib;
        total += contrib;
        hasAny = true;
      } else {
        compContribs[comp.id] = null;
      }
    } else {
      compContribs[comp.id] = null;
    }
  }
  return {
    contribution: hasAny ? total : null,
    exactAvg: null,
    roundedAvg: null,
    compContribs,
  };
}

// ─── Color helpers ────────────────────────────────────────────────────────────
function scoreColor(score: number | null, passing: number): string {
  if (score === null) return 'text-bb-text-secondary';
  return score >= passing ? 'text-green-500' : 'text-red-500';
}

function contribColor(contrib: number | null): string {
  if (contrib === null) return 'text-bb-text-secondary/50';
  if (contrib > 0) return 'text-green-400';
  return 'text-red-400';
}

// ─── Badge colors for section type ───────────────────────────────────────────
const SECTION_BADGE_COLORS = [
  'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  'bg-green-500/20 text-green-300 border border-green-500/30',
  'bg-rose-500/20 text-rose-300 border border-rose-500/30',
];

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

  // Fetch formula
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('course_grading_formulas')
        .select('formula_json')
        .eq('course_id', courseId)
        .maybeSingle();
      if (data?.formula_json) setFormula(data.formula_json as GradingFormula);
      setLoading(false);
    })();
  }, [courseId]);

  // Section results
  const sectionResults = useMemo<Record<string, SectionResult>>(() => {
    if (!formula) return {};
    const res: Record<string, SectionResult> = {};
    formula.sections.forEach((sec) => {
      res[sec.id] = calcSection(sec, grades);
    });
    return res;
  }, [formula, grades]);

  // Final score
  const finalScore = useMemo<number | null>(() => {
    if (!formula) return null;
    let total = 0;
    let hasAny = false;
    for (const sec of formula.sections) {
      const r = sectionResults[sec.id];
      if (r?.contribution !== null && r?.contribution !== undefined) {
        total += r.contribution;
        hasAny = true;
      }
    }
    return hasAny ? total : null;
  }, [formula, sectionResults]);

  const allSectionMax = formula?.sections.reduce((s, sec) => s + sec.max_pts, 0) ?? 20;
  const passed = finalScore !== null && finalScore >= passing;
  const lacking = finalScore !== null && !passed ? passing - finalScore : 0;

  const setGrade = (compId: string, val: string) =>
    setGrades((g) => ({ ...g, [compId]: val }));

  const reset = () => setGrades({});

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // ── No formula ────────────────────────────────────────────────────────
  if (!formula || formula.sections.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-5 border-b border-bb-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <Calculator className="w-4.5 h-4.5 text-blue-400" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="text-sm font-black text-bb-text">Calculadora de Notas</p>
              <p className="text-xs text-bb-text-secondary truncate max-w-[220px]">{courseName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-bb-darker text-bb-text-secondary hover:text-bb-text transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-bb-darker border border-bb-border flex items-center justify-center">
            <Calculator className="w-8 h-8 text-bb-text-secondary/50" />
          </div>
          <div>
            <p className="font-bold text-bb-text mb-1">Calculadora no disponible</p>
            <p className="text-sm text-bb-text-secondary leading-relaxed max-w-xs">
              El administrador aún no ha configurado la fórmula de evaluación para este curso.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Full calculator ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ maxHeight: '90vh' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-bb-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📋</span>
          <div>
            <p className="text-sm font-black text-bb-text leading-tight">Calculadora</p>
            <p className="text-xs text-bb-text-secondary truncate max-w-[200px] leading-tight">{courseName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={reset}
            className="p-2 rounded-lg text-bb-text-secondary hover:text-amber-400 hover:bg-amber-400/10 transition-all"
            title="Limpiar todo"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg text-bb-text-secondary hover:text-bb-text hover:bg-bb-darker transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 p-4 space-y-3">

        {/* ── Score card ─────────────────────────────────────────────── */}
        <div className="bg-bb-darker/60 border border-bb-border rounded-2xl p-5 text-center">
          {/* Big score */}
          <motion.div
            key={finalScore?.toFixed(2) ?? 'null'}
            initial={{ scale: 0.95, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-6xl font-black tabular-nums tracking-tight mb-1 ${scoreColor(finalScore, passing)}`}
          >
            {finalScore !== null ? finalScore.toFixed(2) : '–'}
          </motion.div>

          {/* Status */}
          {finalScore !== null ? (
            <p className={`text-sm font-semibold mb-3 ${passed ? 'text-green-400' : 'text-red-400'}`}>
              {passed
                ? `✓ Aprobado — llevas ${(finalScore - passing).toFixed(2)} pts de margen`
                : `✗ Desaprobado — faltan ${lacking.toFixed(2)} pts`}
            </p>
          ) : (
            <p className="text-sm text-bb-text-secondary mb-3">Ingresa tus notas para ver el resultado</p>
          )}

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-bb-card rounded-full overflow-hidden mb-2">
            <motion.div
              className={`h-full rounded-full transition-all duration-500 ${passed ? 'bg-green-500' : 'bg-red-500'}`}
              animate={{ width: finalScore !== null ? `${(finalScore / allSectionMax) * 100}%` : '0%' }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-xs text-bb-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Aprobado (≥{passing} pts)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Desaprobado
            </span>
          </div>
        </div>

        {/* ── Section cards ────────────────────────────────────────────── */}
        {formula.sections.map((section, sIdx) => {
          const result = sectionResults[section.id];
          const badgeClass = SECTION_BADGE_COLORS[sIdx % SECTION_BADGE_COLORS.length];
          const isAvg = section.type === 'average';
          // For 2-column layout
          const cols = section.components.length > 1 ? 'grid-cols-2' : 'grid-cols-1';

          return (
            <div key={section.id} className="bg-bb-card border border-bb-border rounded-2xl overflow-hidden">
              {/* Section header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>
                    {section.label}
                  </span>
                  <span className="text-xs text-bb-text-secondary">hasta {section.max_pts} pts del total</span>
                </div>
                {section.description && (
                  <p className="text-xs text-bb-text-secondary mt-1 leading-relaxed">{section.description}</p>
                )}
              </div>

              {/* Components grid */}
              <div className={`grid ${cols} gap-px bg-bb-border`}>
                {section.components.map((comp) => {
                  const compMax = isAvg
                    ? section.max_pts / section.components.length
                    : comp.max_pts;
                  const grade = grades[comp.id];
                  const gradeVal = grade !== undefined && grade !== '' ? parseFloat(grade) : null;
                  const contrib = result?.compContribs[comp.id] ?? null;
                  const hasGrade = gradeVal !== null && !isNaN(gradeVal);

                  return (
                    <div key={comp.id} className="bg-bb-card px-4 py-3">
                      {/* Label */}
                      <p className="text-xs font-semibold text-bb-text mb-2">
                        {comp.label}
                        <span className="text-bb-text-secondary font-normal ml-1">(máx {compMax.toFixed(0)} pts)</span>
                      </p>

                      {/* Input — mimics "0 – 20" style */}
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.5}
                          value={grade ?? ''}
                          onChange={(e) => setGrade(comp.id, e.target.value)}
                          placeholder=""
                          className="w-full bg-bb-darker border border-bb-border rounded-xl px-4 py-3 text-xl font-bold text-bb-text focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 outline-none transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        {/* Placeholder: "0 – 20" */}
                        {!grade && (
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-bb-text-secondary/40 pointer-events-none select-none">
                            0 – 20
                          </span>
                        )}
                      </div>

                      {/* Contribution */}
                      <p className={`text-xs font-semibold mt-1.5 tabular-nums ${hasGrade ? contribColor(contrib) : 'text-bb-text-secondary/50'}`}>
                        {hasGrade && contrib !== null
                          ? `+${contrib.toFixed(2)} / ${compMax.toFixed(2)} pts`
                          : `– / ${compMax.toFixed(2)} pts`}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Average row for PC-style sections */}
              {isAvg && (
                <div className="border-t border-bb-border px-4 py-3 bg-bb-darker/40">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-bb-text-secondary font-medium">Promedio {section.label}</span>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-[10px] text-bb-text-secondary uppercase tracking-wider mb-0.5">Exacto</p>
                        <p className="font-bold text-bb-text tabular-nums">
                          {result?.exactAvg !== null && result?.exactAvg !== undefined
                            ? result.exactAvg.toFixed(2)
                            : '–'}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-bb-text-secondary" />
                      <div className="text-center">
                        <p className="text-[10px] text-bb-text-secondary uppercase tracking-wider mb-0.5">Redondeado</p>
                        <p className="font-bold text-bb-text tabular-nums">
                          {result?.roundedAvg !== null && result?.roundedAvg !== undefined
                            ? result.roundedAvg
                            : '–'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Clear all button */}
        <button
          onClick={reset}
          className="w-full py-3.5 text-sm font-semibold text-bb-text-secondary hover:text-bb-text border border-bb-border rounded-2xl hover:bg-bb-darker transition-all active:scale-[0.99]"
        >
          Limpiar todo
        </button>
      </div>
    </div>
  );
}
