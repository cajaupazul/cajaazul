'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

export const FACULTY_COLORS = {
  'Facultad de Ciencias Empresariales': {
    primary: '#0066FF',
    secondary: '#E6F0FF',
    dark: '#0052CC',
    light: '#F0F7FF',
  },
  'Facultad de Derecho': {
    primary: '#FF0000',
    secondary: '#FFE6E6',
    dark: '#CC0000',
    light: '#FFF0F0',
  },
  'Facultad de Economía y Finanzas': {
    primary: '#00CC00',
    secondary: '#E6FFE6',
    dark: '#009900',
    light: '#F0FFF0',
  },
  'Facultad de Ingeniería': {
    primary: '#FFCC00',
    secondary: '#FFFAE6',
    dark: '#CC9900',
    light: '#FFFBF0',
  },
};

// Define types for the 3 modes
export type ThemeMode = 'light' | 'dark' | 'glass';

interface ThemeContextType {
  faculty: string | null;
  colors: typeof FACULTY_COLORS[keyof typeof FACULTY_COLORS] | null;
  setFaculty: (faculty: string) => void;
  loading: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  faculty: null,
  colors: null,
  setFaculty: () => { },
  loading: true,
  themeMode: 'glass',
  setThemeMode: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [faculty, setFacultyState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('glass');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('themeMode') as ThemeMode;
    if (savedTheme && ['light', 'dark', 'glass'].includes(savedTheme)) {
      setThemeModeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Default to glass if no preference
      setThemeModeState('glass');
      document.documentElement.setAttribute('data-theme', 'glass');
    }
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('themeMode', mode);
    document.documentElement.setAttribute('data-theme', mode);
  };

  // Escuchar cambios de autenticación
  useEffect(() => {
    const loadUserFaculty = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('carrera')
            .eq('id', user.id)
            .single();
          if (profile?.carrera) {
            setFacultyState(profile.carrera);
          } else {
            setFacultyState(null);
          }
        } else {
          setFacultyState(null);
        }
      } catch (error) {
        console.error('Error loading user faculty:', error);
        setFacultyState(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserFaculty();

    // Escuchar cambios de sesión (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          // Only show global loading if we don't have faculty data yet
          if (!faculty) {
            setLoading(true);
          }
          await loadUserFaculty();
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Aplicar variables CSS personalizadas cuando cambia la facultad
  useEffect(() => {
    if (faculty && faculty in FACULTY_COLORS) {
      const colors = FACULTY_COLORS[faculty as keyof typeof FACULTY_COLORS];
      document.documentElement.style.setProperty('--faculty-primary', colors.primary);
      document.documentElement.style.setProperty('--faculty-secondary', colors.secondary);
      document.documentElement.style.setProperty('--faculty-dark', colors.dark);
      document.documentElement.style.setProperty('--faculty-light', colors.light);
    }
  }, [faculty]);

  const setFaculty = (newFaculty: string) => {
    setFacultyState(newFaculty);
  };

  const colors = faculty && faculty in FACULTY_COLORS
    ? FACULTY_COLORS[faculty as keyof typeof FACULTY_COLORS]
    : FACULTY_COLORS['Facultad de Ciencias Empresariales'];

  return (
    <ThemeContext.Provider value={{ faculty, colors, setFaculty, loading, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}