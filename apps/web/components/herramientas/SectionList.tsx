'use client';

import React, { useMemo } from 'react';
import { Plus, AlertTriangle, Check } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { OfertaAcademica } from '@/lib/supabase';

type SectionGroup = {
    seccion: string;
    profesor: string;
    horarios: OfertaAcademica[];
};

type Props = {
    ofertas: OfertaAcademica[];
    activeCourse: string | null;
    selectedSections: Map<string, Set<string>>; // codigo -> Set of secciones
    onToggleSection: (codigo: string, seccion: string) => void;
    allSelected: OfertaAcademica[]; // all selected ofertas for conflict detection
    viewMode: 'clases' | 'examenes';
};

const DIAS_ORDER: Record<string, number> = {
    LUN: 0, MAR: 1, MIE: 2, JUE: 3, VIE: 4, SAB: 5, DOM: 6,
};

export default function SectionList({
    ofertas,
    activeCourse,
    selectedSections,
    onToggleSection,
    allSelected,
    viewMode,
}: Props) {
    const { colors } = useTheme();

    // Get sections for the active course
    const sections = useMemo(() => {
        if (!activeCourse) return [];

        const courseOfertas = ofertas.filter(o => o.codigo_curso === activeCourse);
        const map = new Map<string, SectionGroup>();

        for (const o of courseOfertas) {
            if (!map.has(o.seccion)) {
                map.set(o.seccion, {
                    seccion: o.seccion,
                    profesor: o.profesor || 'Sin profesor',
                    horarios: [],
                });
            }
            map.get(o.seccion)!.horarios.push(o);
            if (o.profesor && map.get(o.seccion)!.profesor === 'Sin profesor') {
                map.get(o.seccion)!.profesor = o.profesor;
            }
        }

        return Array.from(map.values());
    }, [ofertas, activeCourse]);

    // Check if a section has conflicts with already selected sections
    const hasConflict = (section: SectionGroup): boolean => {
        for (const horario of section.horarios) {
            if (horario.tipo !== 'CLASE') continue;
            for (const sel of allSelected) {
                if (sel.codigo_curso === activeCourse) continue;
                if (sel.tipo !== 'CLASE') continue;
                if (sel.dia !== horario.dia) continue;

                const selStart = timeToMinutes(sel.hora_inicio);
                const selEnd = timeToMinutes(sel.hora_fin);
                const horStart = timeToMinutes(horario.hora_inicio);
                const horEnd = timeToMinutes(horario.hora_fin);

                if (horStart < selEnd && horEnd > selStart) {
                    return true;
                }
            }
        }
        return false;
    };

    const courseName = activeCourse
        ? ofertas.find(o => o.codigo_curso === activeCourse)?.nombre_curso || ''
        : '';

    return (
        <div className="flex flex-col h-full">
            <div
                className="px-4 py-3 text-sm font-bold text-white rounded-t-xl"
                style={{ backgroundColor: colors?.primary }}
            >
                PASO 2: ARRASTRAR SECCIONES AL CALENDARIO
            </div>

            {!activeCourse ? (
                <div className="flex-1 flex items-center justify-center p-6">
                    <p className="text-bb-text-secondary text-sm text-center italic">
                        Selecciona cursos en el Paso 1 para ver las secciones disponibles aquí.
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* Course header */}
                    <div className="px-4 py-2 bg-bb-hover/50 border-b border-bb-border">
                        <p className="text-sm font-semibold text-bb-text truncate">{courseName}</p>
                        <p className="text-xs text-bb-text-secondary">{sections.length} secciones disponibles</p>
                    </div>

                    {/* Section table */}
                    <table className="w-full text-xs">
                        <thead className="bg-bb-hover/30 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">CURSO / SECCIÓN</th>
                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">PROFESOR</th>
                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">HORARIOS</th>
                                <th className="px-3 py-2 text-center text-bb-text-secondary font-medium">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sections.map(section => {
                                const isSelected = selectedSections.get(activeCourse)?.has(section.seccion) || false;
                                const conflict = !isSelected && hasConflict(section);

                                // Group horarios by viewMode for display
                                const filteredHorarios = section.horarios
                                    .filter(h => {
                                        const isExam = h.tipo === 'FINAL' || h.tipo === 'PARCIAL';
                                        return viewMode === 'clases' ? !isExam : isExam;
                                    })
                                    .sort((a, b) => (DIAS_ORDER[a.dia] ?? 7) - (DIAS_ORDER[b.dia] ?? 7));

                                return (
                                    <tr
                                        key={section.seccion}
                                        className="border-b border-bb-border/30 hover:bg-bb-hover/30 transition-colors"
                                    >
                                        <td className="px-3 py-2.5">
                                            <p className="text-bb-text font-medium">Sección {section.seccion}</p>
                                        </td>
                                        <td className="px-3 py-2.5 text-bb-text-secondary">{section.profesor}</td>
                                        <td className="px-3 py-2.5">
                                            {filteredHorarios.length > 0 ? filteredHorarios.map((h, i) => (
                                                <span key={i} className="text-bb-text block leading-relaxed">
                                                    <span className="text-[10px] text-bb-text-secondary mr-1">{h.tipo}:</span>
                                                    {h.dia} {h.hora_inicio}–{h.hora_fin}
                                                </span>
                                            )) : (
                                                <span className="text-bb-text-secondary italic">Sin horario</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {conflict ? (
                                                <span className="inline-flex items-center gap-1 text-red-400 text-[10px] font-medium">
                                                    <AlertTriangle className="w-3 h-3" /> Conflicto
                                                </span>
                                            ) : isSelected ? (
                                                <button
                                                    onClick={() => onToggleSection(activeCourse, section.seccion)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-green-300 bg-green-500/20 hover:bg-green-500/30 transition-all"
                                                >
                                                    <Check className="w-3 h-3" /> Elegido
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onToggleSection(activeCourse, section.seccion)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-white hover:opacity-90 transition-all"
                                                    style={{ backgroundColor: colors?.primary }}
                                                >
                                                    <Plus className="w-3 h-3" /> Agregar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
