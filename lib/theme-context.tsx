'use client';
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useProfile } from './profile-context';

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
} as const;

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  faculty: string | null;
  colors: typeof FACULTY_COLORS[keyof typeof FACULTY_COLORS];
  setFaculty: (faculty: string) => void;
  loading: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const DEFAULT_COLORS = FACULTY_COLORS['Facultad de Ciencias Empresariales'];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: profileLoading } = useProfile();
  const [facultyState, setFacultyState] = useState<string | null>(null);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('themeMode') as ThemeMode;
    if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
      setThemeModeState(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('themeMode', mode);
    document.documentElement.setAttribute('data-theme', mode);
  };

  // Sync faculty from profile
  useEffect(() => {
    if (profile?.carrera) {
      setFacultyState(profile.carrera);
    }
  }, [profile?.carrera]);

  // Apply custom CSS variables
  useEffect(() => {
    const activeFaculty = facultyState || 'Facultad de Ciencias Empresariales';
    const colors = FACULTY_COLORS[activeFaculty as keyof typeof FACULTY_COLORS] || DEFAULT_COLORS;

    document.documentElement.style.setProperty('--faculty-primary', colors.primary);
    document.documentElement.style.setProperty('--faculty-secondary', colors.secondary);
    document.documentElement.style.setProperty('--faculty-dark', colors.dark);
    document.documentElement.style.setProperty('--faculty-light', colors.light);
  }, [facultyState]);

  const colors = useMemo(() => {
    const activeFaculty = facultyState || 'Facultad de Ciencias Empresariales';
    return FACULTY_COLORS[activeFaculty as keyof typeof FACULTY_COLORS] || DEFAULT_COLORS;
  }, [facultyState]);

  const value = useMemo(() => ({
    faculty: facultyState,
    colors,
    setFaculty: setFacultyState,
    loading: profileLoading,
    themeMode,
    setThemeMode
  }), [facultyState, colors, profileLoading, themeMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
