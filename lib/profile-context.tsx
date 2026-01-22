'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AUTH_CONFIG } from '@/lib/auth-config';
import { Profile } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

const STORAGE_KEY = 'campuslink_profile_v1';

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
  // Initialize profile from localStorage for instant render
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error('Error parsing cached profile', e);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    return null;
  });

  const [session, setSession] = useState<Session | null>(null);

  // If we have a cached profile, we are NOT loading visually (Optimistic UI)
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem(STORAGE_KEY);
    }
    return true;
  });

  // Refs to track state effectively without causing re-renders
  const lastFetchedUserId = useRef<string | null>(null);
  const isFetching = useRef(false);

  // Fallback to release loading state if something hangs indefinitely
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.warn('[PROFILE_CONTEXT] Safety timer triggered: Forcing loading to false explicitly.');
        setLoading(false);
      }
    }, 8000); // 8 seconds max loading time
    return () => clearTimeout(safetyTimer);
  }, [loading]);

  const saveProfileToCache = (data: Profile | null) => {
    if (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const fetchProfile = useCallback(async (userId: string, currentSession: Session) => {
    // Prevent duplicate fetches for the same user if already in progress
    if (isFetching.current && lastFetchedUserId.current === userId) return;

    isFetching.current = true;
    lastFetchedUserId.current = userId;

    // We don't set loading=true here to avoid flickering if re-fetching.
    // Initial load handling is done by the caller or initial state.

    try {
      console.log(`[PROFILE_CONTEXT] Fetching profile for: ${userId}`);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[PROFILE_CONTEXT] Error fetching profile:', error);
        // Do NOT block UI on read error, just continue.
      }

      if (data) {
        setProfile(data);
        saveProfileToCache(data);
      } else {
        console.log('[PROFILE_CONTEXT] No profile found. Attempting to create one...');

        // Check if we hit a race condition where cache has it but DB read missed (rare but possible) or valid cache exists
        // If we have a cached profile for THIS user, keep it rather than nuking it, unless sure.

        // Auto-create profile from user metadata logic
        const user = currentSession.user;
        const defaultProfile = {
          id: userId,
          nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
          universidad: user.user_metadata?.universidad || 'Universidad del Pacífico',
          carrera: user.user_metadata?.carrera || 'General',
          puntos: 0,
          avatar_url: null,
          bio: null,
          email: user.email // Ensure email is captured if schema requires it
        };

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .single();

        if (insertError) {
          console.error('[PROFILE_CONTEXT] Failed to auto-create profile:', insertError);
          // Critical: We stop here but we MUST release loading. 
          // We do NO redirects here.
        } else if (newProfile) {
          console.log('[PROFILE_CONTEXT] Profile created successfully.');
          setProfile(newProfile);
          saveProfileToCache(newProfile);
        }
      }
    } catch (err) {
      console.error('[PROFILE_CONTEXT] Unexpected error in fetchProfile:', err);
    } finally {
      isFetching.current = false;
      setLoading(false); // ALWAYS release loading
    }
  }, []);

  // 1. Auth State Listener - ONLY handles Session
  useEffect(() => {
    let mounted = true;

    // Initial session check
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);

          if (!initialSession) {
            setLoading(false); // No session = no profile to load = done.
            setProfile(null);
            localStorage.removeItem(STORAGE_KEY);
          } else {
            // If we have session, check if our cached profile matches this user
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
              try {
                const p = JSON.parse(cached);
                if (p.id !== initialSession.user.id) {
                  // Cache belongs to another user, clear it
                  setProfile(null);
                  localStorage.removeItem(STORAGE_KEY);
                  setLoading(true); // Force loading to true to refetch for the new user
                }
              } catch {
                // If parsing fails, clear the bad cache
                setProfile(null);
                localStorage.removeItem(STORAGE_KEY);
                setLoading(true);
              }
            }
          }
        }
      } catch (e) {
        console.error('Session init error:', e);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        if (!newSession) {
          // LOGOUT or Session Expiry -> Clear Everything correctly
          setProfile(null);
          setLoading(false); // User signed out? Loading done.
          lastFetchedUserId.current = null;
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Profile Sync Effect - Reacts to Session changes
  useEffect(() => {
    if (!session?.user?.id) return;

    // Proactive Domain Check - kept from original requirements but purely for session validity
    if (session.user.email && !session.user.email.endsWith('@alum.up.edu.pe')) {
      // We perform the redirect/signout entirely separately to avoid blocking the fetch logic
      console.warn('[AUTH_GUARD] Invalid domain. Signing out...');
      localStorage.removeItem(STORAGE_KEY); // Security cleanup
      supabase.auth.signOut().then(() => {
        window.location.href = `/auth/login?error=${encodeURIComponent(AUTH_CONFIG.messages.domainError)}`;
      });
      return;
    }

    // Trigger profile fetch
    fetchProfile(session.user.id, session);

    // Realtime subscription for profile updates
    const channel = supabase
      .channel(`profile_realtime_${session.user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        (payload: any) => {
          if (payload.new && payload.new.id === session.user.id) {
            const newP = payload.new as Profile;
            setProfile(newP);
            saveProfileToCache(newP);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchProfile]);


  const updateProfile = useCallback((updatedProfile: Profile) => {
    if (updatedProfile.id === session?.user?.id) {
      setProfile(updatedProfile);
      saveProfileToCache(updatedProfile);
    }
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id, session);
    }
  }, [session, fetchProfile]);

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