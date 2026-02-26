'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    GraduationCap, Clock, CalendarDays, Save, Plus, Trash2, Loader2,
    FileText, ChevronDown, Edit2
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

    // Rename state
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [editingScheduleName, setEditingScheduleName] = useState('');

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
        if (savedSchedules.length >= 3) return; // MAX 3 LIMIT

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

    const handleRenameSchedule = async (id: string, newName: string) => {
        if (!newName.trim()) return;

        await supabase
            .from('user_schedules')
            .update({ nombre: newName.trim() })
            .eq('id', id);

        setSavedSchedules(prev => prev.map(s => s.id === id ? { ...s, nombre: newName.trim() } : s));
        setEditingScheduleId(null);
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
        <div className="flex flex-col gap-4 sm:gap-6">
            {/* Stats Bar & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Stats Group */}
                <div className="flex gap-3">
                    {/* Credits */}
                    <div className="flex-1 sm:flex-none flex items-center gap-2 sm:gap-3 bg-bb-card border border-bb-border rounded-xl px-3 py-2 sm:px-4 sm:py-2.5">
                        <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: colors?.primary }} />
                        <div className="min-w-0">
                            <p className="text-[9px] sm:text-[10px] text-bb-text-secondary uppercase font-bold tracking-wider truncate">Créditos</p>
                            <p className="text-base sm:text-lg font-black text-bb-text leading-none">{totalCredits}</p>
                        </div>
                    </div>

                    {/* Free days / Study days */}
                    <div className="flex-[2] sm:flex-none flex items-center gap-2 sm:gap-3 bg-bb-card border border-bb-border rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 overflow-hidden">
                        <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] sm:text-[10px] text-bb-text-secondary uppercase font-bold tracking-wider truncate">Días Estudio</p>
                            <p className="text-xs sm:text-sm font-bold text-bb-text leading-none truncate">
                                {freeDays.length > 0 ? freeDays.map(d => DIA_LABELS[d]).join(', ') : 'Todos ocupados'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions Group */}
                <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
                    {/* Schedule selector */}
                    <div className="relative flex-1 sm:flex-none">
                        <button
                            onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                            className="w-full flex items-center justify-between sm:justify-start gap-2 bg-bb-card border border-bb-border rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 hover:bg-bb-hover transition-all"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-bb-text-secondary shrink-0" />
                                <div className="text-left min-w-0">
                                    <p className="text-[9px] sm:text-[10px] text-bb-text-secondary uppercase font-bold tracking-wider truncate">Horarios</p>
                                    <p className="text-xs sm:text-sm font-bold text-bb-text truncate max-w-[120px] sm:max-w-xs">{activeScheduleName}</p>
                                </div>
                            </div>
                            <ChevronDown className="w-4 h-4 text-bb-text-secondary shrink-0" />
                        </button>

                        {showScheduleMenu && (
                            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-64 bg-bb-card border border-bb-border rounded-xl shadow-xl z-30 overflow-hidden">
                                {savedSchedules.map(s => (
                                    <div
                                        key={s.id}
                                        className="flex items-center justify-between px-4 py-3 sm:py-2.5 hover:bg-bb-hover cursor-pointer transition-all border-b border-bb-border/50 last:border-0"
                                        onClick={() => {
                                            if (editingScheduleId !== s.id) {
                                                loadSchedule(s);
                                                setShowScheduleMenu(false);
                                            }
                                        }}
                                    >
                                        {editingScheduleId === s.id ? (
                                            <input
                                                autoFocus
                                                className="bg-bb-bg border border-bb-border rounded px-2 py-1 w-full text-sm text-bb-text mr-2 focus:outline-none focus:border-blue-500"
                                                value={editingScheduleName}
                                                onChange={e => setEditingScheduleName(e.target.value)}
                                                onBlur={() => handleRenameSchedule(s.id, editingScheduleName)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleRenameSchedule(s.id, editingScheduleName);
                                                    if (e.key === 'Escape') setEditingScheduleId(null);
                                                }}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className={`text-sm flex-1 truncate mr-2 ${s.id === activeScheduleId ? 'font-bold text-bb-text' : 'text-bb-text-secondary'}`}>
                                                {s.nombre}
                                            </span>
                                        )}

                                        {editingScheduleId !== s.id && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingScheduleId(s.id);
                                                        setEditingScheduleName(s.nombre);
                                                    }}
                                                    className="p-1.5 text-bb-text-secondary hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                                                    title="Renombrar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }}
                                                    className="p-1.5 text-bb-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {savedSchedules.length < 3 && (
                                    <button
                                        onClick={handleNewSchedule}
                                        className="w-full flex items-center gap-2 px-4 py-3 sm:py-2.5 text-sm font-bold border-t border-bb-border hover:bg-bb-hover transition-all justify-center"
                                        style={{ color: colors?.primary }}
                                    >
                                        <Plus className="w-4 h-4" /> Nuevo horario
                                    </button>
                                )}
                                {savedSchedules.length >= 3 && (
                                    <div className="px-4 py-3 sm:py-2.5 text-xs text-center font-bold text-bb-text-secondary border-t border-bb-border bg-bb-bg/50">
                                        Límite de 3 alcanzado
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Save button */}
                    <button
                        onClick={handleSaveSchedule}
                        disabled={saving}
                        className="flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: colors?.primary }}
                    >
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                <span className="hidden sm:inline">Guardar</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Periodo and Mode selector */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex w-full sm:w-auto items-center gap-1 sm:gap-2 bg-bb-card border border-bb-border rounded-xl p-1">
                    <button
                        onClick={() => setViewMode('clases')}
                        className={`flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-sm sm:text-base font-bold transition-all ${viewMode === 'clases' ? 'bg-white text-black shadow-sm' : 'text-bb-text-secondary hover:text-bb-text'
                            }`}
                    >
                        Clases
                    </button>
                    <button
                        onClick={() => setViewMode('examenes')}
                        className={`flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg text-sm sm:text-base font-bold transition-all ${viewMode === 'examenes' ? 'bg-white text-black shadow-sm' : 'text-bb-text-secondary hover:text-bb-text'
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
