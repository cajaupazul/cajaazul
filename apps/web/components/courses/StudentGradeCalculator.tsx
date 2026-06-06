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
  contribution: number | null;
  exactAvg: number | null;
  roundedAvg: number | null;
  compContribs: Record<string, number | null>;
}

function calcSection(section: GradingSection, grades: Record<string, string>): SectionResult {
  const compContribs: Record<string, number | null> = {};
  const components = section.components || [];
  const sectionMaxPts = section.max_pts ?? 0;

  if (section.type === 'average') {
    const values: number[] = [];
    for (const comp of components) {
      const raw = grades[comp.id];
      if (raw !== undefined && raw !== '') {
        const v = parseFloat(raw);
        if (!isNaN(v)) values.push(Math.min(20, Math.max(0, v)));
      }
    }
    if (values.length === 0) {
      components.forEach((c) => (compContribs[c.id] = null));
      return { contribution: null, exactAvg: null, roundedAvg: null, compContribs };
    }
    const exactAvg = values.reduce((a, b) => a + b, 0) / values.length;
    const roundedAvg = applyRound(exactAvg, section.roundingRule || 'round');
    const contribution = (roundedAvg / 20) * sectionMaxPts;
    const perCompMax = sectionMaxPts / (components.length || 1);
    for (const comp of components) {
      const raw = grades[comp.id];
      compContribs[comp.id] = raw !== undefined && raw !== '' && !isNaN(parseFloat(raw))
        ? (parseFloat(raw) / 20) * perCompMax
        : null;
    }
    return { contribution, exactAvg, roundedAvg, compContribs };
  }

  // standard
  let total = 0;
  let hasAny = false;
  for (const comp of components) {
    const raw = grades[comp.id];
    if (raw !== undefined && raw !== '') {
      const v = Math.min(20, Math.max(0, parseFloat(raw)));
      if (!isNaN(v)) {
        const contrib = (v / 20) * (comp.max_pts ?? 0);
        compContribs[comp.id] = contrib;
        total += contrib;
        hasAny = true;
      } else { compContribs[comp.id] = null; }
    } else { compContribs[comp.id] = null; }
  }
  return { contribution: hasAny ? total : null, exactAvg: null, roundedAvg: null, compContribs };
}

// ─── Section badge colors ─────────────────────────────────────────────────────
const BADGE_COLORS = [
  { badge: 'bg-blue-50 text-blue-700 border border-blue-100', accent: 'border-blue-100' },
  { badge: 'bg-purple-50 text-purple-700 border border-purple-100', accent: 'border-purple-100' },
  { badge: 'bg-amber-50 text-amber-700 border border-amber-100', accent: 'border-amber-100' },
  { badge: 'bg-green-50 text-green-700 border border-green-100', accent: 'border-green-100' },
  { badge: 'bg-rose-50 text-rose-700 border border-rose-100', accent: 'border-rose-100' },
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

  const finalScore = useMemo<number | null>(() => {
    if (!formula) return null;
    let total = 0; let hasAny = false;
    for (const sec of (formula.sections || [])) {
      const r = sectionResults[sec.id];
      if (r?.contribution !== null && r?.contribution !== undefined) { total += r.contribution; hasAny = true; }
    }
    return hasAny ? total : null;
  }, [formula, sectionResults]);

  const allMax = formula?.sections?.reduce((s, sec) => s + (sec.max_pts ?? 0), 0) ?? 20;
  const hasAnyInput = Object.values(grades).some(v => v !== '');
  const passed = finalScore !== null && finalScore >= passing;
  const lacking = finalScore !== null && !passed ? passing - finalScore : 0;

  const setGrade = (compId: string, val: string) => setGrades((g) => ({ ...g, [compId]: val }));
  const reset = () => setGrades({});

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white">
        <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── No formula ─────────────────────────────────────────────────────────
  if (!formula || (formula.sections || []).length === 0) {
    return (
      <div className="flex flex-col bg-white" style={{ minHeight: 240 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-800">📋 Calculadora de Notas</p>
            <p className="text-xs text-slate-400 truncate max-w-[230px]">{courseName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-3 p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
            <Calculator className="w-7 h-7 text-slate-300" />
          </div>
          <div>
            <p className="font-bold text-slate-700 mb-1 text-sm">Calculadora no disponible</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              El administrador aún no ha configurado la fórmula de evaluación para este curso.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Full calculator ────────────────────────────────────────────────────
  // Determine result card state
  const resultBorder = !hasAnyInput ? 'border-slate-200' : passed ? 'border-green-200' : 'border-red-200';
  const scoreColor = !hasAnyInput ? '#94a3b8' : passed ? '#16a34a' : '#dc2626';
  const progBg = !hasAnyInput ? '#e2e8f0' : passed ? '#16a34a' : '#dc2626';
  const progW = `${Math.min(100, ((finalScore ?? 0) / allMax) * 100).toFixed(1)}%`;

  const statusText = !hasAnyInput
    ? 'Puntos acumulados / 20'
    : passed
    ? '✓ Aprobado'
    : `✗ Desaprobado — faltan ${lacking.toFixed(2)} pts`;
  const statusColor = !hasAnyInput ? '#94a3b8' : passed ? '#16a34a' : '#dc2626';

  return (
    <div className="flex flex-col bg-[#f8fafc]" style={{ maxHeight: '90vh' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-white flex-shrink-0">
        <div>
          <p className="text-sm font-bold text-slate-800 leading-tight">📋 Calculadora</p>
          <p className="text-xs text-slate-400 truncate max-w-[220px] leading-tight">{courseName}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">

        {/* ── Result card ────────────────────────────────────────────── */}
        <div
          className="rounded-2xl bg-white p-5 text-center transition-all duration-300"
          style={{ border: `1px solid`, borderColor: resultBorder.includes('green') ? '#bbf7d0' : resultBorder.includes('red') ? '#fecaca' : '#e2e8f0' }}
        >
          <div
            className="text-6xl font-bold tabular-nums leading-none mb-1.5 transition-colors duration-300"
            style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", color: scoreColor }}
          >
            {(finalScore ?? 0).toFixed(2)}
          </div>
          <div className="text-sm font-semibold mb-3 transition-colors duration-300" style={{ color: statusColor }}>
            {statusText}
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: progW, background: progBg }}
            />
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Aprobado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Desaprobado
            </span>
          </div>
        </div>

        {/* ── Section cards ───────────────────────────────────────────── */}
        {(formula.sections || []).map((section, sIdx) => {
          const result = sectionResults[section.id];
          const colors = BADGE_COLORS[sIdx % BADGE_COLORS.length];
          const isAvg = section.type === 'average';
          const components = section.components || [];
          const perCompMax = isAvg ? (section.max_pts ?? 0) / (components.length || 1) : 0;

          return (
            <div key={section.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* Section header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${colors.badge}`}>
                    {section.label}
                  </span>
                  <span className="text-xs text-slate-400">hasta {section.max_pts} pts del total</span>
                </div>
                {section.description && (
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{section.description}</p>
                )}
              </div>

              {/* 2-column component grid */}
              <div className="px-4 pb-3 grid grid-cols-2 gap-3">
                {components.map((comp) => {
                  const compMax = isAvg ? perCompMax : (comp.max_pts ?? 0);
                  const grade = grades[comp.id] ?? '';
                  const gradeNum = grade !== '' ? Math.min(20, Math.max(0, parseFloat(grade))) : null;
                  const contrib = result?.compContribs[comp.id] ?? null;
                  const hasGrade = gradeNum !== null && !isNaN(gradeNum);

                  return (
                    <div key={comp.id} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-600">
                        {comp.label}{' '}
                        <span className="text-slate-400 font-normal">
                          (máx {compMax % 1 === 0 ? compMax.toFixed(0) : compMax.toFixed(2)} pts)
                        </span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.1}
                        value={grade}
                        onChange={(e) => setGrade(comp.id, e.target.value)}
                        placeholder="0 – 20"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base font-semibold text-slate-800 bg-slate-50 outline-none focus:border-blue-300 focus:bg-white transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}
                      />
                      <p
                        className="text-xs"
                        style={{
                          fontFamily: "'SF Mono', 'Fira Code', monospace",
                          color: hasGrade ? '#16a34a' : '#94a3b8',
                        }}
                      >
                        {hasGrade && contrib !== null
                          ? `+${contrib.toFixed(2)} / ${compMax.toFixed(2)} pts`
                          : `— / ${compMax.toFixed(2)} pts`}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Average box for PC-style sections */}
              {isAvg && (
                <>
                  <hr className="border-slate-100 mx-4" />
                  <div className="mx-4 mb-4 mt-3 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                    <p className="text-xs font-semibold text-slate-500">Promedio {section.label}</p>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 mb-0.5">Exacto</p>
                        <p
                          className="text-xl font-bold tabular-nums transition-colors"
                          style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", color: result?.exactAvg !== null && result?.exactAvg !== undefined ? '#475569' : '#94a3b8' }}
                        >
                          {result?.exactAvg !== null && result?.exactAvg !== undefined ? result.exactAvg.toFixed(2) : '—'}
                        </p>
                      </div>
                      <span className="text-lg text-slate-300">→</span>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-400 mb-0.5">Redondeado</p>
                        <p
                          className="text-xl font-bold tabular-nums transition-colors"
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            color: result?.roundedAvg !== null && result?.roundedAvg !== undefined
                              ? (result.roundedAvg >= passing ? '#16a34a' : '#dc2626')
                              : '#94a3b8',
                          }}
                        >
                          {result?.roundedAvg !== null && result?.roundedAvg !== undefined ? result.roundedAvg : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Reset button */}
        <button
          onClick={reset}
          className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors font-medium"
        >
          Limpiar todo
        </button>

      </div>
    </div>
  );
}
