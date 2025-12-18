'use client';
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import {
  BookOpen,
  LogOut,
  Menu,
  X,
  Home,
  Users,
  Calendar,
  MessageSquare,
  Settings,
  Bell,
  Info,
  Layers,
  Sun,
  Moon,
} from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, loading: themeLoading } = useTheme();
  const { profile, loading: profileLoading } = useProfile();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAuthChecked(true);
        router.replace('/auth/login');
        return;
      }

      setAuthChecked(true);
    };

    checkAuth();
  }, [router]);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    setIsLoggingOut(true);

    try {
      // Execute sign out and delay in parallel
      await Promise.all([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
    } catch (error) {
      console.error('Error logging out:', error);
      // Ensure specific delay even on error
      await new Promise(resolve => setTimeout(resolve, 3000));
    } finally {
      // Use router for client-side transition which is safer in SPA
      router.replace('/auth/login');
    }
  };

  const isActive = (href: string) => pathname === href;

  const navItems = [
    { label: 'Inicio', href: '/dashboard', icon: Home },
    { label: 'Cursos', href: '/dashboard/courses', icon: BookOpen },
    { label: 'Profesores', href: '/dashboard/professors', icon: Users },
    { label: 'Eventos', href: '/dashboard/events', icon: Calendar },
    { label: 'Grupos', href: '/dashboard/grupos', icon: Layers },
    { label: 'Comunidad', href: '/dashboard/community', icon: MessageSquare },
    { label: 'Nosotros', href: '/dashboard/about', icon: Info },
  ];

  // Show full screen loader only if we haven't checked auth yet OR 
  // if we are loading the profile but don't have the data in memory yet.
  // This prevents flickering/stalling on tab refocus (handled by Supabase refocus checks).
  if (!authChecked || (profileLoading && !profile)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bb-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-faculty-primary"></div>
          <p className="text-bb-text-secondary">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bb-dark transition-colors duration-300">
      {/* SIDEBAR */}
      {sidebarOpen && (
        <div
          className="w-72 flex flex-col bg-bb-sidebar border-r border-bb-border text-bb-text overflow-hidden flex-shrink-0 transition-colors duration-300"
          style={{
            borderRightColor: colors?.primary + '40',
          }}
        >
          {/* Logo */}
          <div
            className="border-b px-6 py-6 flex items-center justify-between flex-shrink-0"
            style={{ borderColor: colors?.primary + '40' }}
          >
            <Link href="/dashboard" className="flex items-center space-x-3 group">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
                style={{ backgroundColor: colors?.primary }}
              >
                CL
              </div>
              <div>
                <span className="text-xl font-bold text-bb-text">CampusLink</span>
                <span className="text-xs text-bb-text-secondary block">Premium</span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg text-bb-text hover:bg-bb-hover"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Card */}
          <Link
            href="/profile"
            className="mx-4 mt-4 mb-2 rounded-xl p-4 hover:bg-bb-hover border cursor-pointer transition-all"
            style={{
              backgroundColor: 'transparent',
              borderColor: colors?.primary + '40',
            }}
          >
            <div className="flex items-center space-x-3">
              <Avatar className="h-14 w-14 ring-2 flex-shrink-0" style={{ boxShadow: `0 0 0 2px ${colors?.primary}40` }}>
                <AvatarImage src={profile?.avatar_url || ''} alt={profile?.nombre || 'Usuario'} />
                <AvatarFallback style={{ backgroundColor: colors?.primary, color: 'white' }}>
                  {profile?.nombre?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-bb-text truncate">{profile?.nombre || 'Usuario'}</p>
                <p className="text-xs text-bb-text-secondary truncate">{profile?.carrera || 'Estudiante'}</p>
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-0 py-6 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block w-full group relative transition-all duration-200"
                  style={{
                    backgroundColor: active ? colors?.primary + '20' : 'transparent',
                    paddingLeft: '1.5rem',
                    paddingRight: '1.5rem',
                    paddingTop: '1rem',
                    paddingBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: active ? colors?.primary : 'var(--bb-text-secondary)',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ backgroundColor: colors?.primary }}
                  />
                  <Icon style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
                  <span style={{ fontWeight: active ? '600' : '500' }}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div
            className="border-t px-0 py-3 flex-shrink-0"
            style={{ borderColor: colors?.primary + '40' }}
          >


            <Link
              href="/settings"
              className="flex items-center gap-3 px-6 py-3 text-bb-text-secondary hover:text-bb-text group relative transition-all duration-200"
              style={{ textDecoration: 'none', fontSize: '0.875rem' }}
            >
              <Settings style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
              <span>Configuración</span>
              <div
                className="absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ backgroundColor: colors?.primary }}
              />
            </Link>
            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center gap-3 px-6 py-3 text-bb-text-secondary hover:text-red-400 group relative transition-all duration-200"
              style={{ textDecoration: 'none', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <LogOut style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} />
              <span>Cerrar Sesión</span>
              <div
                className="absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ backgroundColor: '#ef4444' }}
              />
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bb-dark transition-colors duration-300">
        {/* HEADER */}
        <header
          className="border-b shadow-lg bg-bb-card sticky top-0 z-30 flex-shrink-0 transition-colors duration-300"
          style={{
            borderBottomColor: colors?.primary + '40',
          }}
        >
          <div
            className="h-1"
            style={{ backgroundColor: colors?.primary }}
          />

          <div className="flex items-center justify-between h-20 px-4 sm:px-8">
            <div className="flex items-center space-x-4">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-lg transition-all"
                  style={{ color: colors?.primary, backgroundColor: colors?.primary + '20' }}
                >
                  <Menu className="h-6 w-6" />
                </button>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-bb-text truncate transition-colors">
                {navItems.find((item) => isActive(item.href))?.label || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center space-x-4 sm:space-x-6">
              <button className="relative p-2 text-bb-text-secondary hover:text-bb-text transition-colors">
                <Bell className="h-6 w-6" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: colors?.primary }}></span>
              </button>
              {!sidebarOpen && (
                <Avatar className="h-10 w-10 cursor-pointer ring-2 flex-shrink-0" style={{ boxShadow: `0 0 0 2px ${colors?.primary}40` }}>
                  <AvatarImage src={profile?.avatar_url || ''} alt={profile?.nombre || 'Usuario'} />
                  <AvatarFallback style={{ backgroundColor: colors?.primary, color: 'white' }}>
                    {profile?.nombre?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-auto bg-bb-dark w-full transition-colors duration-300">
          {children}
        </main>
      </div>

      {/* LOGOUT CONFIRMATION DIALOG */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="bg-bb-card border-bb-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-bb-text flex items-center gap-2">
              <LogOut className="w-5 h-5 text-red-500" />
              Confirmar Cierre de Sesión
            </DialogTitle>
            <DialogDescription className="text-bb-text-secondary">
              ¿Estás seguro de que deseas cerrar tu sesión actual?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(false)}
              className="border-bb-border text-bb-text hover:bg-bb-hover"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLogoutConfirm}
              className="bg-red-500 hover:bg-red-600 text-white border-0"
            >
              Sí, Cerrar Sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LOGOUT LOADING OVERLAY */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${colors?.primary} transparent transparent transparent` }}></div>
            <div className="w-16 h-16 rounded-full border-4 border-white/20 absolute inset-0"></div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Cerrando Sesión...</h2>
          <p className="text-gray-400">¡Esperamos verte pronto!</p>
        </div>
      )}
    </div>
  );
}