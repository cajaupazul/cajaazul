'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { OfertaAcademica } from '@/lib/supabase';

type Props = {
    selectedOfertas: OfertaAcademica[];
    selectedCourses: Set<string>;
    onRemoveSection: (codigo: string, seccion: string) => void;
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
    { bg: '#3b82f620', border: '#3b82f6', text: '#93c5fd' },
    { bg: '#ef444420', border: '#ef4444', text: '#fca5a5' },
    { bg: '#22c55e20', border: '#22c55e', text: '#86efac' },
    { bg: '#f59e0b20', border: '#f59e0b', text: '#fcd34d' },
    { bg: '#8b5cf620', border: '#8b5cf6', text: '#c4b5fd' },
    { bg: '#ec489920', border: '#ec4899', text: '#f9a8d4' },
    { bg: '#06b6d420', border: '#06b6d4', text: '#67e8f9' },
    { bg: '#f9731620', border: '#f97316', text: '#fdba74' },
    { bg: '#14b8a620', border: '#14b8a6', text: '#5eead4' },
    { bg: '#6366f120', border: '#6366f1', text: '#a5b4fc' },
    { bg: '#84cc1620', border: '#84cc16', text: '#bef264' },
    { bg: '#e11d4820', border: '#e11d48', text: '#fb7185' },
    { bg: '#0ea5e920', border: '#0ea5e9', text: '#7dd3fc' },
    { bg: '#d946ef20', border: '#d946ef', text: '#e879f9' },
    { bg: '#facc1520', border: '#facc15', text: '#fde047' },
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

export default function ScheduleGrid({ selectedOfertas, selectedCourses, onRemoveSection }: Props) {
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

    // Only show CLASE type entries on the grid
    const classOfertas = selectedOfertas.filter(o => o.tipo === 'CLASE');

    // Group blocks by day
    const blocksByDay = useMemo(() => {
        const map = new Map<string, OfertaAcademica[]>();
        for (const day of DAYS) map.set(day, []);
        for (const o of classOfertas) {
            const existing = map.get(o.dia) || [];
            existing.push(o);
            map.set(o.dia, existing);
        }
        return map;
    }, [classOfertas]);

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[800px]">
                {/* Header row */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b-2" style={{ borderColor: '#1e3a5f' }}>
                    <div className="px-2 py-2 text-[11px] font-bold text-bb-text-secondary text-center"
                        style={{ backgroundColor: '#0a1929', borderRight: '1px solid #1e3a5f' }}
                    >
                        HORARIO
                    </div>
                    {DAY_LABELS.map((day, i) => (
                        <div
                            key={day}
                            className="px-2 py-2 text-[11px] font-bold text-center"
                            style={{
                                backgroundColor: '#0a1929',
                                color: '#60a5fa',
                                borderRight: i < 6 ? '1px solid #1e3a5f' : 'none',
                            }}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Time grid */}
                <div className="relative">
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
                                    className="flex items-center justify-center text-[10px] text-bb-text-secondary font-mono"
                                    style={{ borderRight: '1px solid #1e3a5f', backgroundColor: '#0a192905' }}
                                >
                                    {slot} - {nextSlot || ''}
                                </div>

                                {/* Day cells */}
                                {DAYS.map((day, dayIdx) => (
                                    <div
                                        key={`${slot}-${day}`}
                                        className="relative"
                                        style={{
                                            borderRight: dayIdx < 6 ? '1px solid #1e3a5f20' : 'none',
                                        }}
                                    />
                                ))}
                            </div>
                        );
                    })}

                    {/* Course blocks (positioned absolutely) */}
                    {DAYS.map((day, dayIdx) => {
                        const blocks = blocksByDay.get(day) || [];
                        return blocks.map((oferta, bIdx) => {
                            const startMin = timeToMinutes(oferta.hora_inicio) - gridStartMin;
                            const endMin = timeToMinutes(oferta.hora_fin) - gridStartMin;
                            const color = getColorForCourse(oferta.codigo_curso);

                            const topPercent = (startMin / totalMinutes) * 100;
                            const heightPercent = ((endMin - startMin) / totalMinutes) * 100;

                            // Calculate left position: 80px for time col + day column
                            // Each day col = (100% - 80px) / 7
                            const colWidth = `calc((100% - 80px) / 7)`;
                            const left = `calc(80px + ${dayIdx} * ${colWidth})`;

                            return (
                                <div
                                    key={`${oferta.id || bIdx}-${day}-${oferta.hora_inicio}`}
                                    className="absolute rounded-md overflow-hidden group cursor-pointer transition-all hover:z-20 hover:shadow-lg"
                                    style={{
                                        top: `${topPercent}%`,
                                        height: `${heightPercent}%`,
                                        left,
                                        width: colWidth,
                                        backgroundColor: color.bg,
                                        borderLeft: `3px solid ${color.border}`,
                                        padding: '2px 4px',
                                        zIndex: 10,
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

                                    <p className="text-[10px] font-bold leading-tight" style={{ color: color.text }}>
                                        {oferta.hora_inicio} - {oferta.hora_fin}
                                    </p>
                                    <p className="text-[9px] leading-tight mt-0.5 truncate" style={{ color: color.text + 'cc' }}>
                                        {oferta.nombre_curso}
                                    </p>
                                </div>
                            );
                        });
                    })}
                </div>
            </div>
        </div>
    );
}
