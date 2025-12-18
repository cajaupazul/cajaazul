'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
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

    const fetchCourses = useCallback(async () => {
        if (!session) return;
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
        if (!session) return;
        setLoading(prev => ({ ...prev, professors: true }));
        try {
            const { data, error } = await supabase
                .from('professors')
                .select(`
                  *,
                  professor_ratings (puntuacion)
                `)
                .order('nombre', { ascending: true });

            if (!error && data) {
                const formatted = data.map((prof: any) => {
                    const ratings = prof.professor_ratings || [];
                    const averageRating = ratings.length > 0
                        ? (ratings.reduce((sum: number, r: any) => sum + (r.puntuacion || 0), 0) / ratings.length)
                        : 0;

                    return {
                        ...prof,
                        averageRating: Math.round(averageRating * 10) / 10,
                        ratingCount: ratings.length,
                    };
                });
                setProfessors(formatted);
            }
        } finally {
            setLoading(prev => ({ ...prev, professors: false }));
        }
    }, [session]);

    const fetchGrupos = useCallback(async () => {
        if (!session) return;
        setLoading(prev => ({ ...prev, grupos: true }));
        try {
            const { data, error } = await supabase
                .from('grupos')
                .select(`
                  *,
                  grupo_miembros(count)
                `)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setGrupos(data);
                const counts: Record<string, number> = {};
                data.forEach((grupo: any) => {
                    counts[grupo.id] = grupo.grupo_miembros?.[0]?.count || 0;
                });
                setMiembrosCuenta(counts);
            }
        } finally {
            setLoading(prev => ({ ...prev, grupos: false }));
        }
    }, [session]);

    const fetchUserGrupos = useCallback(async (userId: string) => {
        if (!userId || !session) return;
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
        if (!session) return;

        await Promise.all([
            fetchCourses(),
            fetchProfessors(),
            fetchGrupos(),
            (userId || session.user.id) ? fetchUserGrupos(userId || session.user.id) : Promise.resolve()
        ]);
    }, [session, fetchCourses, fetchProfessors, fetchGrupos, fetchUserGrupos]);

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
        refreshAll
    }), [
        courses, professors, grupos, userGrupos, miembrosCuenta, loading,
        fetchCourses, fetchProfessors, fetchGrupos, fetchUserGrupos, refreshAll
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

