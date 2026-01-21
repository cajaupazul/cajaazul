'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { AUTH_CONFIG } from '@/lib/auth-config';
import { Profile } from '@/lib/supabase'; // Re-adding Profile as it's used in ProfileContextType
import { Session } from '@supabase/supabase-js';

interface ProfileContextType {
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  updateProfile: (updatedProfile: Profile) => void;
  refreshProfile: () => Promise<void>;
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
  const subscriptionRef = useRef<any>(null);

  // Track if we have performed initial session check
  const hasHydrated = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Always verify we still have a valid session for this user before fetching
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!activeSession || activeSession.user.id !== userId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === userId) {
          const defaultProfile = {
            id: userId,
            nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
            universidad: user.user_metadata?.universidad || 'Universidad del Pacífico',
            carrera: user.user_metadata?.carrera || 'General',
            puntos: 0,
            avatar_url: null,
            bio: null
          };

          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert(defaultProfile)
            .select()
            .single();

          if (!insertError && newProfile) {
            setProfile(newProfile);
            return;
          }
        }
      }

      // Final check before setting profile state
      const { data: { session: finalCheck } } = await supabase.auth.getSession();
      if (finalCheck?.user?.id === userId && !error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial hydration check
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        console.log('[PROFILE_PROVIDER] Initial hydration session:', currentSession?.user?.id || 'none');
        setSession(currentSession);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        }
      } catch (err) {
        console.error('[PROFILE_PROVIDER] Hydration error:', err);
      } finally {
        if (isMounted) {
          hasHydrated.current = true;
          setLoading(false);
          console.log('[PROFILE_PROVIDER] Ready.');
        }
      }
    };

    initSession();

    // 2. Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        console.log(`[AUTH_CHANGE] Event: ${event}, User: ${currentSession?.user?.id?.slice(0, 5) || 'none'}`);

        // PROACTIVE DOMAIN GUARD: 
        // If we get a session with an unauthorized email, sign out immediately.
        // This handles cases where the session might be briefly created before the trigger blocks it 
        // or for better UX when the user is already partially authenticated.
        if (currentSession?.user?.email && !currentSession.user.email.endsWith('@alum.up.edu.pe')) {
          console.warn('[AUTH_GUARD] Unauthorized domain detected. Forcing sign out...');
          setSession(null);
          setProfile(null);
          setLoading(false);

          await supabase.auth.signOut();

          // Redirect with clear error message
          const errorMsg = encodeURIComponent(AUTH_CONFIG.messages.domainError);
          window.location.replace(`/auth/login?error=${errorMsg}`);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
          if (currentSession?.user) {
            setLoading(true);
            await fetchProfile(currentSession.user.id);
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[AUTH_CHANGE] Handling SIGNED_OUT - clearing session and profile.');
          setSession(null);
          setProfile(null);
          setLoading(false);
        } else {
          setSession(currentSession);
        }
      }
    );

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // Real-time profile sync
  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;
    const channel = supabase
      .channel(`profile_realtime_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.new && (payload.new as Profile).id === userId) {
            setProfile(payload.new as Profile);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [session?.user?.id]);

  const updateProfile = useCallback((updatedProfile: Profile) => {
    if (updatedProfile.id === session?.user?.id) {
      setProfile(updatedProfile);
    }
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session?.user?.id, fetchProfile]);

  const value = useMemo(() => ({
    profile,
    session,
    loading,
    updateProfile,
    refreshProfile
  }), [profile, session, loading, updateProfile, refreshProfile]);

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