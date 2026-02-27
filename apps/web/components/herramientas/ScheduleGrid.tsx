'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { OfertaAcademica } from '@/lib/supabase';

type Props = {
    selectedOfertas: OfertaAcademica[];
    selectedCourses: Set<string>;
    onRemoveSection: (codigo: string, seccion: string) => void;
    viewMode: 'clases' | 'examenes';
};

const DAYS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
const DAY_LABELS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];

// Time slots from 7:30 to 22:30
const START_HOUR = 7;
const START_MIN = 30;
const END_HOUR = 22;
const END_MIN = 30;
const SLOT_MINUTES = 60;

const COURSE_COLORS = [
    { bg: '#3b82f615', border: '#3b82f6', text: '#2563eb' }, // Blue
    { bg: '#ef444415', border: '#ef4444', text: '#dc2626' }, // Red
    { bg: '#22c55e15', border: '#22c55e', text: '#16a34a' }, // Green
    { bg: '#f59e0b15', border: '#f59e0b', text: '#d97706' }, // Amber
    { bg: '#8b5cf615', border: '#8b5cf6', text: '#7c3aed' }, // Violet
    { bg: '#ec489915', border: '#ec4899', text: '#db2777' }, // Pink
    { bg: '#06b6d415', border: '#06b6d4', text: '#0891b2' }, // Cyan
    { bg: '#f9731615', border: '#f97316', text: '#ea580c' }, // Orange
    { bg: '#14b8a615', border: '#14b8a6', text: '#0d9488' }, // Teal
    { bg: '#6366f115', border: '#6366f1', text: '#4f46e5' }, // Indigo
    { bg: '#84cc1615', border: '#84cc16', text: '#65a30d' }, // Lime
    { bg: '#e11d4815', border: '#e11d48', text: '#be123c' }, // Rose
    { bg: '#0ea5e915', border: '#0ea5e9', text: '#0284c7' }, // Sky
    { bg: '#d946ef15', border: '#d946ef', text: '#c026d3' }, // Fuchsia
    { bg: '#facc1515', border: '#facc15', text: '#ca8a04' }, // Yellow
];

function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function generateTimeSlots() {
    const slots: string[] = [];
    let h = START_HOUR;
    let m = START_MIN;
    while (h * 60 + m <= END_HOUR * 60 + END_MIN) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        m += SLOT_MINUTES;
        if (m >= 60) { h += 1; m -= 60; }
    }
    return slots;
}

export default function ScheduleGrid({ selectedOfertas, selectedCourses, onRemoveSection, viewMode }: Props) {
    const timeSlots = useMemo(() => generateTimeSlots(), []);
    const gridStartMin = START_HOUR * 60 + START_MIN;
    const gridEndMin = END_HOUR * 60 + END_MIN;
    const totalMinutes = gridEndMin - gridStartMin;

    // Get color for a course based on its position in selected courses
    const getColorForCourse = (codigo: string) => {
        const arr = Array.from(selectedCourses);
        const idx = arr.indexOf(codigo);
        return COURSE_COLORS[idx % COURSE_COLORS.length];
    };

    // Exam-type specific colors
    const EXAM_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
        FINAL: { bg: '#ef444420', border: '#ef4444', text: '#fca5a5', badge: '#ef4444', badgeText: '#fff' },
        PARCIAL: { bg: '#f59e0b20', border: '#f59e0b', text: '#fcd34d', badge: '#f59e0b', badgeText: '#fff' },
    };

    // Filter based on viewMode
    const filteredOfertas = useMemo(() => {
        return selectedOfertas.filter(o => {
            const isExam = o.tipo === 'FINAL' || o.tipo === 'PARCIAL';
            return viewMode === 'clases' ? !isExam : isExam;
        });
    }, [selectedOfertas, viewMode]);

    // Merged exam blocks: group same day+time FINAL+PARCIAL into one entry
    const mergedExamBlocksByDay = useMemo(() => {
        if (viewMode !== 'examenes') return new Map<string, any[]>();
        const map = new Map<string, any[]>();
        for (const day of DAYS) map.set(day, []);

        // Group by day+course+start+end
        const groupKey = (o: OfertaAcademica) => `${o.codigo_curso}|${o.dia}|${o.hora_inicio}|${o.hora_fin}`;
        const groups = new Map<string, { exams: OfertaAcademica[] }>();
        for (const o of filteredOfertas) {
            const key = groupKey(o);
            if (!groups.has(key)) groups.set(key, { exams: [] });
            groups.get(key)!.exams.push(o);
        }

        // Build merged blocks
        for (const [, group] of groups) {
            const first = group.exams[0];
            const types = group.exams.map(e => e.tipo);
            const hasFinal = types.includes('FINAL');
            const hasParcial = types.includes('PARCIAL');
            const isBoth = hasFinal && hasParcial;

            const block = {
                ...first,
                tipos: types,
                isBoth,
                hasFinal,
                hasParcial,
            };

            const dayBlocks = map.get(first.dia) || [];
            dayBlocks.push(block);
            map.set(first.dia, dayBlocks);
        }

        return map;
    }, [filteredOfertas, viewMode]);

    // Group class blocks by day (only for clases mode)
    const blocksByDay = useMemo(() => {
        const map = new Map<string, OfertaAcademica[]>();
        for (const day of DAYS) map.set(day, []);
        for (const o of filteredOfertas) {
            const existing = map.get(o.dia) || [];
            existing.push(o);
            map.set(o.dia, existing);
        }
        return map;
    }, [filteredOfertas]);

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[800px]">
                {/* Header row */}
                {/* Header row */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-bb-border">
                    <div className="px-2 py-3 text-[11px] font-black text-bb-text uppercase tracking-widest text-center bg-bb-sidebar border-r border-bb-border">
                        HORARIO
                    </div>
                    {DAY_LABELS.map((day, i) => (
                        <div
                            key={day}
                            className="px-2 py-3 text-[11px] font-black text-center bg-bb-sidebar text-blue-500 border-r border-bb-border last:border-r-0"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Time grid */}
                <div className="relative overflow-hidden" style={{ minHeight: '600px' }}>
                    {/* Time slot rows */}
                    {timeSlots.map((slot, idx) => {
                        const nextSlot = timeSlots[idx + 1];
                        if (!nextSlot && idx < timeSlots.length - 1) return null;

                        return (
                            <div
                                key={slot}
                                className="grid grid-cols-[80px_repeat(7,1fr)]"
                                style={{
                                    height: '50px',
                                    borderBottom: '1px solid #1e3a5f20',
                                }}
                            >
                                {/* Time label */}
                                <div
                                    className="flex items-center justify-center text-[10px] text-bb-text-secondary font-mono border-r border-bb-border bg-bb-sidebar/20"
                                >
                                    {slot} - {nextSlot || ''}
                                </div>

                                {/* Day cells */}
                                {DAYS.map((day, dayIdx) => (
                                    <div
                                        key={`${slot}-${day}`}
                                        className="relative"
                                        style={{
                                            borderRight: dayIdx < 6 ? '1px solid var(--bb-border)' : 'none',
                                            opacity: 0.3
                                        }}
                                    />
                                ))}
                            </div>
                        );
                    })}

                    {/* EXAM blocks (merged FINAL+PARCIAL) */}
                    {viewMode === 'examenes' && DAYS.map((day, dayIdx) => {
                        const blocks = mergedExamBlocksByDay.get(day) || [];
                        return blocks.map((block: any, bIdx: number) => {
                            const startMin = timeToMinutes(block.hora_inicio) - gridStartMin;
                            const endMin = timeToMinutes(block.hora_fin) - gridStartMin;
                            const color = getColorForCourse(block.codigo_curso);

                            const topPercent = (startMin / totalMinutes) * 100;
                            const heightPercent = ((endMin - startMin) / totalMinutes) * 100;
                            const colWidth = `calc((100% - 80px) / 7)`;
                            const left = `calc(80px + ${dayIdx} * ${colWidth})`;

                            const borderColor = block.isBoth
                                ? '#ef4444' // red for combined
                                : block.hasFinal ? EXAM_COLORS['FINAL'].border : EXAM_COLORS['PARCIAL'].border;

                            const bgColor = block.isBoth
                                ? 'linear-gradient(135deg, #ef444420 50%, #f59e0b20 50%)'
                                : block.hasFinal ? EXAM_COLORS['FINAL'].bg : EXAM_COLORS['PARCIAL'].bg;

                            return (
                                <div
                                    key={`exam-${block.codigo_curso}-${day}-${block.hora_inicio}-${bIdx}`}
                                    className="absolute rounded-md overflow-hidden group cursor-pointer transition-all hover:z-20 hover:shadow-lg"
                                    style={{
                                        top: `${topPercent}%`,
                                        height: `${heightPercent}%`,
                                        left,
                                        width: `calc(${colWidth} - 2px)`,
                                        background: bgColor,
                                        borderLeft: `3px solid ${borderColor}`,
                                        borderTop: `1px solid ${borderColor}20`,
                                        borderBottom: `1px solid ${borderColor}20`,
                                        borderRight: `1px solid ${borderColor}20`,
                                        padding: '2px 4px',
                                        zIndex: 10,
                                        margin: '0 1px',
                                    }}
                                >
                                    {/* Remove button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveSection(block.codigo_curso, block.seccion);
                                        }}
                                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                                    >
                                        <X className="w-2.5 h-2.5 text-white" />
                                    </button>

                                    <div className="flex flex-col h-full">
                                        {/* Type badges */}
                                        <div className="flex gap-0.5 flex-wrap mb-0.5">
                                            {block.hasFinal && (
                                                <span className="text-[8px] font-black px-1 rounded" style={{ backgroundColor: EXAM_COLORS['FINAL'].badge, color: '#fff' }}>FINAL</span>
                                            )}
                                            {block.hasParcial && (
                                                <span className="text-[8px] font-black px-1 rounded" style={{ backgroundColor: EXAM_COLORS['PARCIAL'].badge, color: '#fff' }}>PARCIAL</span>
                                            )}
                                        </div>
                                        <p className="text-[9px] font-bold leading-tight" style={{ color: color.text }}>
                                            {block.hora_inicio} – {block.hora_fin}
                                        </p>
                                        <p className="text-[10px] font-bold leading-tight mt-0.5" style={{ color: color.text }}>
                                            {block.codigo_curso}
                                        </p>
                                        <p className="text-[9px] leading-tight mt-0.5 line-clamp-2" style={{ color: color.text + 'cc' }}>
                                            {block.nombre_curso}
                                        </p>
                                        <p className="text-[8px] mt-auto font-medium" style={{ color: color.text + '99' }}>
                                            {block.aula !== 'PEND' ? block.aula : ''}
                                        </p>
                                    </div>
                                </div>
                            );
                        });
                    })}

                    {/* CLASS blocks */}
                    {viewMode === 'clases' && DAYS.map((day, dayIdx) => {
                        const blocks = blocksByDay.get(day) || [];
                        return blocks.map((oferta, bIdx) => {
                            const startMin = timeToMinutes(oferta.hora_inicio) - gridStartMin;
                            const endMin = timeToMinutes(oferta.hora_fin) - gridStartMin;
                            const color = getColorForCourse(oferta.codigo_curso);

                            const topPercent = (startMin / totalMinutes) * 100;
                            const heightPercent = ((endMin - startMin) / totalMinutes) * 100;

                            const colWidth = `calc((100% - 80px) / 7)`;
                            const left = `calc(80px + ${dayIdx} * ${colWidth})`;

                            return (
                                <div
                                    key={`${oferta.id || bIdx}-${day}-${oferta.hora_inicio}-${oferta.tipo}`}
                                    className="absolute rounded-md overflow-hidden group cursor-pointer transition-all hover:z-20 hover:shadow-lg"
                                    style={{
                                        top: `${topPercent}%`,
                                        height: `${heightPercent}%`,
                                        left,
                                        width: `calc(${colWidth} - 2px)`,
                                        backgroundColor: color.bg,
                                        borderLeft: `3px solid ${color.border}`,
                                        borderTop: `1px solid ${color.border}20`,
                                        borderBottom: `1px solid ${color.border}20`,
                                        borderRight: `1px solid ${color.border}20`,
                                        padding: '2px 4px',
                                        zIndex: 10,
                                        margin: '0 1px',
                                    }}
                                >
                                    {/* Remove button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveSection(oferta.codigo_curso, oferta.seccion);
                                        }}
                                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                                    >
                                        <X className="w-2.5 h-2.5 text-white" />
                                    </button>

                                    <div className="flex flex-col h-full">
                                        <p className="text-[9px] font-bold leading-tight" style={{ color: color.text }}>
                                            {oferta.tipo} | {oferta.hora_inicio} - {oferta.hora_fin}
                                        </p>
                                        <p className="text-[10px] font-bold leading-tight mt-0.5" style={{ color: color.text }}>
                                            {oferta.codigo_curso}
                                        </p>
                                        <p className="text-[9px] leading-tight mt-0.5 line-clamp-2" style={{ color: color.text + 'cc' }}>
                                            {oferta.nombre_curso}
                                        </p>
                                        <p className="text-[8px] mt-auto font-medium" style={{ color: color.text + '99' }}>
                                            {oferta.aula}
                                        </p>
                                    </div>
                                </div>
                            );
                        });
                    })}
                </div>
            </div>
        </div>
    );
}
