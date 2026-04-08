'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface ProfileContextType {
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  updateProfile: (updatedProfile: Profile) => void;
  refreshProfile: () => Promise<void>;
  clearProfile: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({
  children
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Singleton pattern to avoid redundant fetches
  const hasFetchedProfile = useRef<string | null>(null);
  const isFetching = useRef(false);

  const clearProfile = useCallback(() => {
    console.log('[PROFILE_CONTEXT] Clearing profile state');
    setProfile(null);
    setSession(null);
    hasFetchedProfile.current = null;
    isFetching.current = false;
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    // Avoid redundant fetches if we already have it for this user
    if (hasFetchedProfile.current === userId || isFetching.current) {
      return;
    }

    isFetching.current = true;
    try {
      console.log(`[PROFILE_CONTEXT] Fetching profile for: ${userId}`);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[PROFILE_CONTEXT] Error fetching profile:', error.message);
        setProfile(null);
      } else {
        setProfile(data);
        if (data) {
          hasFetchedProfile.current = userId;
        }
      }
    } catch (err) {
      console.error('[PROFILE_CONTEXT] Unexpected error:', err);
      setProfile(null);
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, []);

  // 1. Session Listener
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          if (!initialSession) {
            setLoading(false);
            setProfile(null);
            hasFetchedProfile.current = null;
          }
        }
      } catch (e) {
        console.error('[PROFILE_CONTEXT] Session init error:', e);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        if (!newSession) {
          setProfile(null);
          setLoading(false);
          hasFetchedProfile.current = null;
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Profile Fetch Trigger
  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile(session.user.id);
    }
  }, [session?.user?.id, fetchProfile]);

  // 3. Realtime Subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`profile_realtime_${session.user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        (payload: any) => {
          if (payload.new && payload.new.id === session.user.id) {
            setProfile(payload.new as Profile);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const updateProfile = useCallback((updatedProfile: Profile) => {
    if (updatedProfile.id === session?.user?.id) {
      setProfile(updatedProfile);
    }
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      hasFetchedProfile.current = null;
      await fetchProfile(session.user.id);
    }
  }, [session?.user?.id, fetchProfile]);

  const isGuest = useMemo(() => {
    return !!session?.user?.is_anonymous;
  }, [session]);

  const value = useMemo(() => ({
    profile,
    session,
    loading,
    isGuest,
    updateProfile,
    refreshProfile,
    clearProfile
  }), [profile, session, loading, isGuest, updateProfile, refreshProfile, clearProfile]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
