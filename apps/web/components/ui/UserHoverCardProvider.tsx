'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserStats {
    user_id: string;
    messages_count: number;
    reaction_score: number;
    updated_at: string;
}

export interface FrameData {
    id: string;
    frame_key: string;
    image_url: string;
    frame_settings: any;
}

interface UserHoverCardContextType {
    statsCache: Map<string, UserStats>;
    framesCache: Map<string, FrameData>;
    loadingIds: Set<string>;
    fetchUserStats: (userId: string) => Promise<void>;
    fetchFrame: (frameKey: string) => Promise<void>;
    prefetchUserStats: (userId: string) => void;
    cancelPrefetch: (userId: string) => void;
}

const UserHoverCardContext = createContext<UserHoverCardContextType | undefined>(undefined);

export function UserHoverCardProvider({ children }: { children: React.ReactNode }) {
    const [statsCache, setStatsCache] = useState<Map<string, UserStats>>(new Map());
    const [framesCache, setFramesCache] = useState<Map<string, FrameData>>(new Map());
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const prefetchTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const fetchUserStats = useCallback(async (userId: string) => {
        if (statsCache.has(userId) || loadingIds.has(userId)) return;

        setLoadingIds(prev => new Set(prev).add(userId));

        try {
            const { data, error } = await supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
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

    const fetchFrame = useCallback(async (frameKey: string) => {
        if (framesCache.has(frameKey)) return;

        try {
            const { data, error } = await supabase
                .from('shop_items')
                .select('*')
                .eq('frame_key', frameKey)
                .eq('type', 'profile_frame')
                .single();

            if (data) {
                setFramesCache(prev => new Map(prev).set(frameKey, data as FrameData));
            }
        } catch (err) {
            console.error(`[HOVER_CARD] Error fetching frame ${frameKey}:`, err);
        }
    }, [framesCache]);

    const prefetchUserStats = useCallback((userId: string) => {
        if (statsCache.has(userId) || loadingIds.has(userId)) return;

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
            framesCache,
            loadingIds,
            fetchUserStats,
            fetchFrame,
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

