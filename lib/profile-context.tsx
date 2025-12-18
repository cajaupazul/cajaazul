'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface ProfileContextType {
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  updateProfile: (updatedProfile: Profile) => void;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);
  const profileRef = useRef<Profile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (isMounted) {
        setSession(initialSession);
        if (initialSession?.user) {
          fetchProfile(initialSession.user.id);
        }
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        console.log(`[AUTH_CHANGE] Event: ${event}, User: ${currentSession?.user?.id?.slice(0, 5) || 'none'}`);

        setSession(currentSession);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (currentSession?.user) {
            // Use ref to check up-to-date profile state
            if (!profileRef.current || profileRef.current.id !== currentSession.user.id) {
              await fetchProfile(currentSession.user.id);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
          }
        }

        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [fetchProfile]);

  // Separate effect for real-time profile updates
  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
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
          if (payload.new?.id === userId) {
            setProfile(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [session?.user?.id]);

  const updateProfile = useCallback((updatedProfile: Profile) => {
    if (updatedProfile.id === session?.user?.id) {
      setProfile(updatedProfile);
      supabase
        .from('profiles')
        .update({
          avatar_url: updatedProfile.avatar_url,
          background_url: updatedProfile.background_url,
          nombre: updatedProfile.nombre,
          carrera: updatedProfile.carrera
        })
        .eq('id', session.user.id)
        .then(({ error }) => {
          if (error) console.error('Error auto-syncing profile:', error);
        });
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