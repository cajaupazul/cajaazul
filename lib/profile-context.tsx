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

export function ProfileProvider({
  children,
  initialSession = null,
  initialProfile = null
}: {
  children: React.ReactNode,
  initialSession?: Session | null,
  initialProfile?: Profile | null
}) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [loading, setLoading] = useState(!initialSession && !initialProfile);
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

      if (error && error.code === 'PGRST116') {
        // Profile not found, let's try to create a default one
        console.log('Profile not found for authenticated user, creating default...');

        // Get user metadata from current session if available
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const defaultProfile = {
            id: userId,
            nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
            universidad: user.user_metadata?.universidad || 'Universidad Nacional',
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
          } else {
            console.error('Error creating default profile:', insertError);
          }
        }
      }

      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching/creating profile:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Get initial session and profile
    const initialize = async () => {
      if (initialProfile) {
        setLoading(false);
        return;
      }

      if (initialSession?.user) {
        await fetchProfile(initialSession.user.id);
        setLoading(false);
      } else {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(currentSession);
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        }
        setLoading(false);
      }
    };

    initialize();

    // 2. Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;

        console.log(`[AUTH_CHANGE] Event: ${event}, User: ${currentSession?.user?.id?.slice(0, 5) || 'none'}`);

        setSession(currentSession);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (currentSession?.user) {
            setLoading(true);
            // Use ref to check up-to-date profile state
            if (!profileRef.current || profileRef.current.id !== currentSession.user.id) {
              await fetchProfile(currentSession.user.id);
            }
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
          }
          setLoading(false);
        }
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