'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserStats {
    user_id: string;
    messages_count: number;
    reaction_score: number;
    updated_at: string;
}

interface UserHoverCardContextType {
    statsCache: Map<string, UserStats>;
    loadingIds: Set<string>;
    fetchUserStats: (userId: string) => Promise<void>;
    prefetchUserStats: (userId: string) => void;
    cancelPrefetch: (userId: string) => void;
}

const UserHoverCardContext = createContext<UserHoverCardContextType | undefined>(undefined);

export function UserHoverCardProvider({ children }: { children: React.ReactNode }) {
    const [statsCache, setStatsCache] = useState<Map<string, UserStats>>(new Map());
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const prefetchTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const fetchUserStats = useCallback(async (userId: string) => {
        // Don't fetch if already in cache or currently loading
        if (statsCache.has(userId) || loadingIds.has(userId)) return;

        setLoadingIds(prev => new Set(prev).add(userId));

        try {
            const { data, error } = await supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                // If not found, it might be a new user without stats yet
                if (error.code === 'PGRST116') {
                    const emptyStats: UserStats = {
                        user_id: userId,
                        messages_count: 0,
                        reaction_score: 0,
                        updated_at: new Date().toISOString()
                    };
                    setStatsCache(prev => new Map(prev).set(userId, emptyStats));
                } else {
                    console.error(`[HOVER_CARD] Error fetching stats for ${userId}:`, error);
                }
            } else if (data) {
                setStatsCache(prev => new Map(prev).set(userId, data as UserStats));
            }
        } catch (err) {
            console.error(`[HOVER_CARD] Unexpected error for ${userId}:`, err);
        } finally {
            setLoadingIds(prev => {
                const updated = new Set(prev);
                updated.delete(userId);
                return updated;
            });
        }
    }, [statsCache, loadingIds]);

    const prefetchUserStats = useCallback((userId: string) => {
        if (statsCache.has(userId) || loadingIds.has(userId)) return;

        // Debounce/Delay prefetch by 150ms to avoid flicker on fast movement
        const timer = setTimeout(() => {
            fetchUserStats(userId);
            prefetchTimers.current.delete(userId);
        }, 150);

        prefetchTimers.current.set(userId, timer);
    }, [statsCache, loadingIds, fetchUserStats]);

    const cancelPrefetch = useCallback((userId: string) => {
        const timer = prefetchTimers.current.get(userId);
        if (timer) {
            clearTimeout(timer);
            prefetchTimers.current.delete(userId);
        }
    }, []);

    return (
        <UserHoverCardContext.Provider value={{
            statsCache,
            loadingIds,
            fetchUserStats,
            prefetchUserStats,
            cancelPrefetch
        }}>
            {children}
        </UserHoverCardContext.Provider>
    );
}

export function useUserHoverCard() {
    const context = useContext(UserHoverCardContext);
    if (!context) {
        throw new Error('useUserHoverCard must be used within a UserHoverCardProvider');
    }
    return context;
}
