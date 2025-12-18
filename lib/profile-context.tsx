'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, Profile } from '@/lib/supabase';

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (updatedProfile: Profile) => void;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (user) {
          setCurrentUserId(user.id);

          // Cargar perfil del usuario
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (!isMounted) return;

          if (error) {
            console.error('Error loading profile:', error);
            setProfile(null);
          } else if (data) {
            setProfile(data);
          }

          // Suscribirse a cambios en tiempo real SOLO para este usuario
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
          }

          subscriptionRef.current = supabase
            .channel(`profile_${user.id}_${Date.now()}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${user.id}`,
              },
              (payload: any) => {
                if (isMounted && payload.new?.id === user.id) {
                  setProfile(payload.new);
                }
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                console.log('Profile subscription active for user:', user.id);
              }
            });
        } else {
          setProfile(null);
          setCurrentUserId(null);
        }
      } catch (error) {
        console.error('Error initializing profile:', error);
        if (isMounted) {
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeProfile();

    // Escuchar cambios de autenticación
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setCurrentUserId(session.user.id);

          // Only show global loading if we don't have a profile yet
          if (!profile) {
            setLoading(true);
          }

          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (isMounted) {
            if (data) setProfile(data);
            setLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setCurrentUserId(null);
          if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
          }
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
  }, []);

  const updateProfile = (updatedProfile: Profile) => {
    if (updatedProfile.id === currentUserId) {
      setProfile(updatedProfile);
      // Guardar cambios en Supabase automáticamente
      supabase
        .from('profiles')
        .update({
          avatar_url: updatedProfile.avatar_url,
          background_url: updatedProfile.background_url,
        })
        .eq('id', currentUserId)
        .then(({ error }) => {
          if (error) console.error('Error updating profile:', error);
        });
    }
  };

  const refreshProfile = async () => {
    if (currentUserId) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .single();

        if (data) {
          setProfile(data);
        }
      } catch (error) {
        console.error('Error refreshing profile:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, refreshProfile }}>
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