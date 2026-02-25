'use client';

import React, { useMemo, useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { OfertaAcademica } from '@/lib/supabase';

type CourseGroup = {
    codigo: string;
    nombre: string;
    creditos: number;
    secciones: string[];
};

type Props = {
    ofertas: OfertaAcademica[];
    selectedCourses: Set<string>;
    onToggleCourse: (codigo: string) => void;
    activeCourse: string | null;
    onSelectActiveCourse: (codigo: string) => void;
};

export default function CourseSelector({
    ofertas,
    selectedCourses,
    onToggleCourse,
    activeCourse,
    onSelectActiveCourse,
}: Props) {
    const { colors } = useTheme();
    const [search, setSearch] = useState('');

    const courseGroups = useMemo(() => {
        const map = new Map<string, CourseGroup>();
        for (const o of ofertas) {
            if (!map.has(o.codigo_curso)) {
                map.set(o.codigo_curso, {
                    codigo: o.codigo_curso,
                    nombre: o.nombre_curso,
                    creditos: o.creditos,
                    secciones: [],
                });
            }
            const group = map.get(o.codigo_curso)!;
            if (!group.secciones.includes(o.seccion)) {
                group.secciones.push(o.seccion);
            }
        }
        return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [ofertas]);

    const filtered = useMemo(() => {
        if (!search.trim()) return courseGroups;
        const q = search.toLowerCase();
        return courseGroups.filter(
            c => c.nombre.toLowerCase().includes(q) || c.codigo.includes(q)
        );
    }, [courseGroups, search]);

    // Color palette for courses
    const COURSE_COLORS = [
        '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
        '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
        '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#facc15',
    ];

    const getColorForCourse = (codigo: string) => {
        const selectedArr = Array.from(selectedCourses);
        const idx = selectedArr.indexOf(codigo);
        return idx >= 0 ? COURSE_COLORS[idx % COURSE_COLORS.length] : '#6b7280';
    };

    return (
        <div className="flex flex-col h-full">
            <div
                className="px-4 py-3 text-sm font-bold text-white flex items-center justify-between rounded-t-xl"
                style={{ backgroundColor: colors?.primary }}
            >
                <span>PASO 1: SELECCIONAR CURSOS</span>
                <span className="text-xs opacity-80">{selectedCourses.size} sel.</span>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-bb-border">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bb-text-secondary" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar curso por nombre..."
                        className="w-full bg-bb-dark border border-bb-border rounded-lg pl-9 pr-3 py-2 text-sm text-bb-text placeholder:text-bb-text-secondary/50 focus:outline-none focus:ring-1"
                        style={{ focusRingColor: colors?.primary } as any}
                    />
                </div>
            </div>

            {/* Course list */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="p-4 text-center text-bb-text-secondary text-sm">
                        No se encontraron cursos
                    </div>
                ) : (
                    filtered.map(course => {
                        const isSelected = selectedCourses.has(course.codigo);
                        const isActive = activeCourse === course.codigo;
                        const color = getColorForCourse(course.codigo);

                        return (
                            <div
                                key={course.codigo}
                                className="flex items-center gap-2 px-3 py-2.5 border-b border-bb-border/30 cursor-pointer transition-all hover:bg-bb-hover/50"
                                style={{
                                    backgroundColor: isActive ? colors?.primary + '10' : 'transparent',
                                }}
                                onClick={() => {
                                    onToggleCourse(course.codigo);
                                    onSelectActiveCourse(course.codigo);
                                }}
                            >
                                {/* Checkbox */}
                                <div
                                    className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{
                                        borderColor: isSelected ? color : 'var(--bb-border)',
                                        backgroundColor: isSelected ? color : 'transparent',
                                    }}
                                >
                                    {isSelected && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                                        </svg>
                                    )}
                                </div>

                                {/* Color dot */}
                                <div
                                    className="w-3 h-3 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: isSelected ? color : '#4b5563' }}
                                />

                                {/* Course name */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-bb-text truncate leading-tight">
                                        {course.nombre}
                                    </p>
                                    <p className="text-[10px] text-bb-text-secondary">
                                        {course.codigo} · {course.creditos} cred · {course.secciones.length} secc
                                    </p>
                                </div>

                                {isActive && (
                                    <ChevronRight className="w-4 h-4 text-bb-text-secondary flex-shrink-0" />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
