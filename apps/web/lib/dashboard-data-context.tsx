'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { supabase, Course, Professor } from '@/lib/supabase';
import { useProfile } from './profile-context';

interface DashboardDataContextType {
    courses: Course[];
    professors: any[];
    grupos: any[];
    userGrupos: Set<string>;
    miembrosCuenta: Record<string, number>;
    loading: {
        courses: boolean;
        professors: boolean;
        grupos: boolean;
    };
    fetchCourses: () => Promise<void>;
    fetchProfessors: () => Promise<void>;
    fetchGrupos: () => Promise<void>;
    fetchUserGrupos: (userId: string) => Promise<void>;
    refreshAll: (userId?: string) => Promise<void>;
    addCourse: (course: Course) => void;
    removeCourse: (courseId: string) => void;
    addProfessor: (professor: any) => void;
    removeProfessor: (professorId: string) => void;
}

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
    const { session } = useProfile();
    const [courses, setCourses] = useState<Course[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [grupos, setGrupos] = useState<any[]>([]);
    const [userGrupos, setUserGrupos] = useState<Set<string>>(new Set());
    const [miembrosCuenta, setMiembrosCuenta] = useState<Record<string, number>>({});

    // Tracking per-session fetches to avoid loops
    const initialFetchDone = useRef(false);

    const [loading, setLoading] = useState({
        courses: false,
        professors: false,
        grupos: false
    });

    // Clear data when user logs out
    useEffect(() => {
        if (!session) {
            setCourses([]);
            setProfessors([]);
            setGrupos([]);
            setUserGrupos(new Set());
            setMiembrosCuenta({});
            initialFetchDone.current = false;
        }
    }, [session]);

    const fetchCourses = useCallback(async () => {
        setLoading(prev => ({ ...prev, courses: true }));
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .order('nombre', { ascending: true });

            if (!error && data) {
                setCourses(data);
            }
        } finally {
            setLoading(prev => ({ ...prev, courses: false }));
        }
    }, [session]);

    const fetchProfessors = useCallback(async () => {
        setLoading(prev => ({ ...prev, professors: true }));
        try {
            // Usamos la VIEW professor_with_courses que ya calcula:
            // - courses: array JSON de cursos del catálogo
            // - avg_puntuacion, avg_claridad, avg_facilidad
            // - total_ratings, total_comments
            const { data, error } = await supabase
                .from('professor_with_courses')
                .select('*')
                .order('nombre', { ascending: true });

            if (!error && data) {
                const formatted = data.map((prof: any) => {
                    const courses = Array.isArray(prof.courses) ? prof.courses : [];
                    return {
                        ...prof,
                        // Compatibilidad con código existente que usa especialidad/otros_cursos
                        especialidad: courses[0]?.nombre || null,
                        otros_cursos: courses.length > 1
                            ? courses.slice(1).map((c: any) => c.nombre).join(', ')
                            : null,
                        courses: courses.map((c: any) => c.nombre),
                        averageRating: prof.avg_puntuacion ? Math.round(prof.avg_puntuacion * 10) / 10 : 0,
                        ratingCount: prof.total_ratings || 0,
                    };
                });
                setProfessors(formatted);
            }
        } finally {
            setLoading(prev => ({ ...prev, professors: false }));
        }
    }, [session]);


    const fetchGrupos = useCallback(async () => {
        setLoading(prev => ({ ...prev, grupos: true }));
        try {
            const { data, error } = await supabase
                .from('grupos')
                .select(`
                  *,
                  grupo_miembros(count)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[FETCH_GRUPOS] Error:', error.message, error.details);
            }

            if (data) {
                // Normalizar datos por si hay discrepancias de casing de Supabase UI
                const normalized = data.map((g: any) => ({
                    ...g,
                    nombre: g.nombre || g.Nombre || 'Sin nombre',
                    descripcion: g.descripcion || g.Descripcion || '',
                    logo_url: g.logo_url || g.Logo_url || null,
                    banner_url: g.banner_url || g.Banner_url || null
                }));

                setGrupos(normalized);
                const counts: Record<string, number> = {};
                normalized.forEach((grupo: any) => {
                    counts[grupo.id] = grupo.grupo_miembros?.[0]?.count || 0;
                });
                setMiembrosCuenta(counts);
            }
        } catch (err) {
            console.error('[FETCH_GRUPOS] Fatal error:', err);
        } finally {
            setLoading(prev => ({ ...prev, grupos: false }));
        }
    }, [session]);

    const fetchUserGrupos = useCallback(async (userId: string) => {
        if (!userId || !session || session.user?.is_anonymous) return;
        try {
            const { data, error } = await supabase
                .from('grupo_miembros')
                .select('grupo_id')
                .eq('user_id', userId);

            if (!error && data) {
                setUserGrupos(new Set(data.map(m => m.grupo_id)));
            }
        } catch (e) {
            console.error('Error fetching user groups:', e);
        }
    }, [session]);

    const refreshAll = useCallback(async (userId?: string) => {
        const effectiveUserId = userId || session?.user?.id;
        const isGuest = !session || session.user?.is_anonymous;
        
        await Promise.all([
            fetchCourses(),
            fetchProfessors(),
            fetchGrupos(),
            (effectiveUserId && !isGuest) ? fetchUserGrupos(effectiveUserId) : Promise.resolve()
        ]);
    }, [session, fetchCourses, fetchProfessors, fetchGrupos, fetchUserGrupos]);

    const addCourse = useCallback((course: Course) => {
        setCourses(prev => [...prev, course].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }, []);

    const removeCourse = useCallback((courseId: string) => {
        setCourses(prev => prev.filter(c => c.id !== courseId));
    }, []);

    const addProfessor = useCallback((professor: any) => {
        setProfessors(prev => {
            const index = prev.findIndex(p => p.id === professor.id);
            if (index >= 0) {
                // Replaces the existing professor with updated info (e.g. new courses) while keeping ratings intact if omitted
                const newList = [...prev];
                newList[index] = { ...newList[index], ...professor };
                return newList;
            }
            // Add new
            return [...prev, professor].sort((a, b) => a.nombre.localeCompare(b.nombre));
        });
    }, []);

    const removeProfessor = useCallback((professorId: string) => {
        setProfessors(prev => prev.filter(p => p.id !== professorId));
    }, []);

    const value = useMemo(() => ({
        courses,
        professors,
        grupos,
        userGrupos,
        miembrosCuenta,
        loading,
        fetchCourses,
        fetchProfessors,
        fetchGrupos,
        fetchUserGrupos,
        refreshAll,
        addCourse,
        removeCourse,
        addProfessor,
        removeProfessor
    }), [
        courses, professors, grupos, userGrupos, miembrosCuenta, loading,
        fetchCourses, fetchProfessors, fetchGrupos, fetchUserGrupos, refreshAll, addCourse, removeCourse, addProfessor, removeProfessor
    ]);

    return (
        <DashboardDataContext.Provider value={value}>
            {children}
        </DashboardDataContext.Provider>
    );
}

export function useDashboardData() {
    const context = useContext(DashboardDataContext);
    if (!context) {
        throw new Error('useDashboardData must be used within DashboardDataProvider');
    }
    return context;
}

