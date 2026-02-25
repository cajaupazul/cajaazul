'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    GraduationCap, Clock, CalendarDays, Save, Plus, Trash2, Loader2,
    FileText, ChevronDown
} from 'lucide-react';
import { supabase, OfertaAcademica, UserSchedule } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useTheme } from '@/lib/theme-context';
import CourseSelector from './CourseSelector';
import SectionList from './SectionList';
import ScheduleGrid from './ScheduleGrid';

const DIAS_LIBRES_ALL = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
const DIA_LABELS: Record<string, string> = {
    LUN: 'LUN', MAR: 'MAR', MIE: 'MIE', JUE: 'JUE', VIE: 'VIE', SAB: 'SAB', DOM: 'DOM',
};

export default function ScheduleBuilder() {
    const { profile } = useProfile();
    const { colors } = useTheme();

    // Data
    const [ofertas, setOfertas] = useState<OfertaAcademica[]>([]);
    const [loading, setLoading] = useState(true);
    const [periodos, setPeriodos] = useState<string[]>([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState('');

    // Schedule state
    const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
    const [selectedSections, setSelectedSections] = useState<Map<string, Set<string>>>(new Map());
    const [activeCourse, setActiveCourse] = useState<string | null>(null);

    // Saved schedules
    const [savedSchedules, setSavedSchedules] = useState<UserSchedule[]>([]);
    const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showScheduleMenu, setShowScheduleMenu] = useState(false);
    const [viewMode, setViewMode] = useState<'clases' | 'examenes'>('clases'); // clases vs examenes filter

    // Fetch periodos
    useEffect(() => {
        const fetchPeriodos = async () => {
            const { data } = await supabase
                .from('sche_sections')
                .select('periodo')
                .order('periodo', { ascending: false });

            if (data) {
                const unique = [...new Set(data.map(d => d.periodo))];
                setPeriodos(unique);
                if (unique.length > 0) setSelectedPeriodo(unique[0]);
            }
            setLoading(false);
        };
        fetchPeriodos();
    }, []);

    // Fetch ofertas for selected periodo (Normalized Join)
    useEffect(() => {
        if (!selectedPeriodo) return;
        const fetchOfertas = async () => {
            setLoading(true);

            // 1. Fetch courses
            const { data: courses } = await supabase.from('sche_courses').select('*');
            // 2. Fetch sections and their schedule blocks
            const { data: sections } = await supabase
                .from('sche_sections')
                .select('*, sche_schedule_blocks(*)')
                .eq('periodo', selectedPeriodo);

            if (sections) {
                // Flatten to maintain compatibility with existing UI components
                const flat: OfertaAcademica[] = [];
                sections.forEach(sec => {
                    const course = courses?.find(c => c.id === sec.course_id);
                    const blocks = (sec as any).sche_schedule_blocks || [];

                    blocks.forEach((block: any) => {
                        flat.push({
                            id: block.id,
                            periodo: sec.periodo,
                            codigo_curso: sec.course_id,
                            nombre_curso: course?.name || 'Curso Desconocido',
                            seccion: sec.letter,
                            profesor: sec.teacher,
                            creditos: Number(course?.credits || 0),
                            tipo: block.type,
                            dia: block.day,
                            hora_inicio: block.start_time,
                            hora_fin: block.end_time,
                            duracion: 0,
                            cupos: 0,
                            aula: block.classroom || 'PEND',
                            // Add metadata for section-based selection
                            section_id: sec.id
                        } as any);
                    });
                });
                setOfertas(flat);
            }
            setLoading(false);
        };
        fetchOfertas();
    }, [selectedPeriodo]);

    // Fetch user schedules
    useEffect(() => {
        if (!profile?.id || !selectedPeriodo) return;
        const fetchSchedules = async () => {
            const { data } = await supabase
                .from('user_schedules')
                .select('*')
                .eq('user_id', profile.id)
                .eq('periodo', selectedPeriodo)
                .order('created_at');

            if (data) {
                setSavedSchedules(data);
                if (data.length > 0 && !activeScheduleId) {
                    loadSchedule(data[0]);
                }
            }
        };
        fetchSchedules();
    }, [profile?.id, selectedPeriodo]);

    const loadSchedule = (schedule: UserSchedule) => {
        setActiveScheduleId(schedule.id);
        const sectionIds = schedule.secciones || []; // Now expects Course-Section IDs

        const newCourses = new Set<string>();
        const newSections = new Map<string, Set<string>>();

        for (const oferta of ofertas) {
            const o = oferta as any;
            if (sectionIds.includes(o.section_id)) {
                newCourses.add(o.codigo_curso);
                if (!newSections.has(o.codigo_curso)) {
                    newSections.set(o.codigo_curso, new Set());
                }
                newSections.get(o.codigo_curso)!.add(o.seccion);
            }
        }

        setSelectedCourses(newCourses);
        setSelectedSections(newSections);
    };

    // Get all selected ofertas (for conflict detection and grid)
    const allSelectedOfertas = useMemo(() => {
        const result: OfertaAcademica[] = [];
        for (const [codigo, secciones] of selectedSections) {
            for (const seccion of secciones) {
                const matching = ofertas.filter(o => o.codigo_curso === codigo && o.seccion === seccion);
                result.push(...matching);
            }
        }
        return result;
    }, [ofertas, selectedSections]);

    // Stats
    const totalCredits = useMemo(() => {
        const seen = new Set<string>();
        let total = 0;
        for (const o of allSelectedOfertas) {
            if (!seen.has(o.codigo_curso)) {
                seen.add(o.codigo_curso);
                total += o.creditos;
            }
        }
        return total;
    }, [allSelectedOfertas]);

    const freeDays = useMemo(() => {
        const busyDays = new Set(
            allSelectedOfertas
                .filter(o => o.tipo !== 'FINAL' && o.tipo !== 'PARCIAL')
                .map(o => o.dia)
        );
        return DIAS_LIBRES_ALL.filter(d => !busyDays.has(d));
    }, [allSelectedOfertas]);

    const gapHours = useMemo(() => {
        // Calculate gap hours between classes per day
        let totalGap = 0;
        const byDay = new Map<string, number[]>();

        for (const o of allSelectedOfertas) {
            if (o.tipo === 'FINAL' || o.tipo === 'PARCIAL') continue;
            if (!byDay.has(o.dia)) byDay.set(o.dia, []);
            const start = timeToMin(o.hora_inicio);
            const end = timeToMin(o.hora_fin);
            byDay.get(o.dia)!.push(start, end);
        }

        for (const [, times] of byDay) {
            if (times.length < 4) continue;
            times.sort((a, b) => a - b);
            // Times are: start1, end1, start2, end2, ...
            for (let i = 1; i < times.length - 1; i += 2) {
                const gap = times[i + 1] - times[i];
                if (gap > 0) totalGap += gap;
            }
        }

        return Math.round(totalGap / 60 * 10) / 10;
    }, [allSelectedOfertas]);

    const handleToggleCourse = useCallback((codigo: string) => {
        setSelectedCourses(prev => {
            const next = new Set(prev);
            if (next.has(codigo)) {
                next.delete(codigo);
                // Also remove its sections
                setSelectedSections(prevSec => {
                    const nextSec = new Map(prevSec);
                    nextSec.delete(codigo);
                    return nextSec;
                });
            } else {
                next.add(codigo);
            }
            return next;
        });
    }, []);

    const handleToggleSection = useCallback((codigo: string, seccion: string) => {
        setSelectedSections(prev => {
            const next = new Map(prev);
            if (!next.has(codigo)) next.set(codigo, new Set());
            const secs = new Set(next.get(codigo)!);

            if (secs.has(seccion)) {
                secs.delete(seccion);
            } else {
                // Remove any previously selected section for this course (one section at a time)
                secs.clear();
                secs.add(seccion);
            }

            next.set(codigo, secs);
            return next;
        });
    }, []);

    const handleRemoveSection = useCallback((codigo: string, seccion: string) => {
        setSelectedSections(prev => {
            const next = new Map(prev);
            if (next.has(codigo)) {
                const secs = new Set(next.get(codigo)!);
                secs.delete(seccion);
                if (secs.size === 0) {
                    next.delete(codigo);
                    setSelectedCourses(prevC => {
                        const nc = new Set(prevC);
                        nc.delete(codigo);
                        return nc;
                    });
                } else {
                    next.set(codigo, secs);
                }
            }
            return next;
        });
    }, []);

    const handleSaveSchedule = async () => {
        if (!profile?.id) return;
        setSaving(true);

        try {
            // Collect unique section IDs (The Shield: we save by section, not by block)
            const sectionIds = Array.from(new Set(allSelectedOfertas.map(o => (o as any).section_id))).filter(Boolean);

            if (activeScheduleId) {
                // Update existing
                await supabase
                    .from('user_schedules')
                    .update({
                        secciones: sectionIds,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', activeScheduleId);
            } else {
                // Create new
                const nombre = `Horario ${savedSchedules.length + 1}`;
                const { data } = await supabase
                    .from('user_schedules')
                    .insert({
                        user_id: profile.id,
                        periodo: selectedPeriodo,
                        nombre,
                        secciones: sectionIds,
                    })
                    .select()
                    .single();

                if (data) {
                    setSavedSchedules(prev => [...prev, data]);
                    setActiveScheduleId(data.id);
                }
            }
        } catch (err: any) {
            console.error('Error saving schedule:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleNewSchedule = async () => {
        if (!profile?.id) return;
        const nombre = `Horario ${savedSchedules.length + 1}`;
        const { data } = await supabase
            .from('user_schedules')
            .insert({
                user_id: profile.id,
                periodo: selectedPeriodo,
                nombre,
                secciones: [],
            })
            .select()
            .single();

        if (data) {
            setSavedSchedules(prev => [...prev, data]);
            setActiveScheduleId(data.id);
            setSelectedCourses(new Set());
            setSelectedSections(new Map());
            setActiveCourse(null);
        }
        setShowScheduleMenu(false);
    };

    const handleDeleteSchedule = async (id: string) => {
        await supabase.from('user_schedules').delete().eq('id', id);
        setSavedSchedules(prev => prev.filter(s => s.id !== id));
        if (activeScheduleId === id) {
            setActiveScheduleId(null);
            setSelectedCourses(new Set());
            setSelectedSections(new Map());
        }
        setShowScheduleMenu(false);
    };

    if (loading && ofertas.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-bb-text-secondary" />
            </div>
        );
    }

    if (periodos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="w-12 h-12 text-bb-text-secondary mb-4" />
                <h3 className="text-lg font-semibold text-bb-text mb-2">Sin oferta académica</h3>
                <p className="text-bb-text-secondary text-sm max-w-md">
                    El administrador aún no ha subido la oferta académica. Vuelve más tarde.
                </p>
            </div>
        );
    }

    const activeScheduleName = savedSchedules.find(s => s.id === activeScheduleId)?.nombre || 'Nuevo Horario';

    return (
        <div className="flex flex-col gap-4">
            {/* Stats Bar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Credits */}
                <div className="flex items-center gap-2 bg-bb-card border border-bb-border rounded-xl px-4 py-2.5">
                    <GraduationCap className="w-5 h-5" style={{ color: colors?.primary }} />
                    <div>
                        <p className="text-[10px] text-bb-text-secondary uppercase font-medium">Créditos</p>
                        <p className="text-lg font-bold text-bb-text leading-none">{totalCredits}</p>
                    </div>
                </div>

                {/* Free days */}
                <div className="flex items-center gap-2 bg-bb-card border border-bb-border rounded-xl px-4 py-2.5">
                    <CalendarDays className="w-5 h-5 text-green-400" />
                    <div>
                        <p className="text-[10px] text-bb-text-secondary uppercase font-medium">Días Libres</p>
                        <p className="text-sm font-bold text-bb-text leading-none">
                            {freeDays.length > 0 ? freeDays.map(d => DIA_LABELS[d]).join(', ') : 'Ninguno'}
                        </p>
                    </div>
                </div>

                {/* Gap hours */}
                <div className="flex items-center gap-2 bg-bb-card border border-bb-border rounded-xl px-4 py-2.5">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <div>
                        <p className="text-[10px] text-bb-text-secondary uppercase font-medium">Horas Hueco</p>
                        <p className="text-lg font-bold text-bb-text leading-none">{gapHours}h</p>
                    </div>
                </div>

                {/* Schedule selector */}
                <div className="relative ml-auto">
                    <button
                        onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                        className="flex items-center gap-2 bg-bb-card border border-bb-border rounded-xl px-4 py-2.5 hover:bg-bb-hover transition-all"
                    >
                        <FileText className="w-5 h-5 text-bb-text-secondary" />
                        <div className="text-left">
                            <p className="text-[10px] text-bb-text-secondary uppercase font-medium">HORARIOS</p>
                            <p className="text-sm font-semibold text-bb-text">{activeScheduleName}</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-bb-text-secondary" />
                    </button>

                    {showScheduleMenu && (
                        <div className="absolute right-0 top-full mt-1 w-56 bg-bb-card border border-bb-border rounded-xl shadow-xl z-30 overflow-hidden">
                            {savedSchedules.map(s => (
                                <div
                                    key={s.id}
                                    className="flex items-center justify-between px-4 py-2.5 hover:bg-bb-hover cursor-pointer transition-all"
                                    onClick={() => {
                                        loadSchedule(s);
                                        setShowScheduleMenu(false);
                                    }}
                                >
                                    <span className={`text-sm ${s.id === activeScheduleId ? 'font-bold text-bb-text' : 'text-bb-text-secondary'}`}>
                                        {s.nombre}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }}
                                        className="p-1 text-bb-text-secondary hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={handleNewSchedule}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm border-t border-bb-border hover:bg-bb-hover transition-all"
                                style={{ color: colors?.primary }}
                            >
                                <Plus className="w-4 h-4" /> Nuevo horario
                            </button>
                        </div>
                    )}
                </div>

                {/* Save button */}
                <button
                    onClick={handleSaveSchedule}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: colors?.primary }}
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                </button>
            </div>

            {/* Periodo and Mode selector */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-bb-card border border-bb-border rounded-xl p-1">
                    <button
                        onClick={() => setViewMode('clases')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'clases' ? 'bg-white text-black shadow-sm' : 'text-bb-text-secondary hover:text-bb-text'
                            }`}
                    >
                        Clases
                    </button>
                    <button
                        onClick={() => setViewMode('examenes')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'examenes' ? 'bg-white text-black shadow-sm' : 'text-bb-text-secondary hover:text-bb-text'
                            }`}
                    >
                        Exámenes
                    </button>
                </div>

                {periodos.length > 1 && (
                    <select
                        value={selectedPeriodo}
                        onChange={e => setSelectedPeriodo(e.target.value)}
                        className="bg-bb-card border border-bb-border rounded-xl px-4 py-2 text-sm text-bb-text"
                    >
                        {periodos.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Main 2-column layout: Course selector + Section list */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4">
                {/* Step 1: Course Selector */}
                <div className="bg-bb-card border border-bb-border rounded-xl overflow-hidden max-h-[400px] flex flex-col">
                    <CourseSelector
                        ofertas={ofertas}
                        selectedCourses={selectedCourses}
                        onToggleCourse={handleToggleCourse}
                        activeCourse={activeCourse}
                        onSelectActiveCourse={setActiveCourse}
                    />
                </div>

                {/* Step 2: Section List */}
                <div className="bg-bb-card border border-bb-border rounded-xl overflow-hidden max-h-[400px] flex flex-col">
                    <SectionList
                        ofertas={ofertas}
                        activeCourse={activeCourse}
                        selectedSections={selectedSections}
                        onToggleSection={handleToggleSection}
                        allSelected={allSelectedOfertas}
                        viewMode={viewMode}
                    />
                </div>
            </div>

            {/* Step 3: Schedule Grid */}
            <div className="bg-bb-card border border-bb-border rounded-xl overflow-hidden">
                <ScheduleGrid
                    selectedOfertas={allSelectedOfertas}
                    selectedCourses={selectedCourses}
                    onRemoveSection={handleRemoveSection}
                    viewMode={viewMode}
                />
            </div>
        </div>
    );
}

function timeToMin(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
