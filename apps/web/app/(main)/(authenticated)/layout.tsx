'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, ShopItem, getStorageUrl } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
import {
  BookOpen,
  LogOut,
  Menu,
  X,
  Home,
  Users,
  Calendar,
  Bell,
  Info,
  Layers,
  ShoppingBag,
  Package,
  ShieldCheck,
  Wrench,
  Eye,
  EyeOff,
  Library,
} from 'lucide-react';
import Link from 'next/link';
import { CoinCounter } from '@/components/ui/coin-counter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import AnnouncementPopup from '@/components/announcements/AnnouncementPopup';
import styles from './AuthenticatedLayout.module.css';
import { isProfileComplete } from '@/lib/profile-completion';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const pathname = usePathname();
  const { colors } = useTheme();
  const { profile, session, loading: profileLoading, isGuest, clearProfile } = useProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [equippedFrame, setEquippedFrame] = useState<ShopItem | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Visibility settings for sidebar sections
  const [visibilitySettings, setVisibilitySettings] = useState<Record<string, boolean>>({});

  // Fetch visibility settings
  useEffect(() => {
    const fetchVisibility = async () => {
      try {
        const { data, error } = await supabase
          .from('sidebar_visibility')
          .select('section_key,is_hidden');

        if (error) {
          console.warn('[SIDEBAR_VISIBILITY] Could not fetch settings. Using defaults.');
          return;
        }

        const settings: Record<string, boolean> = {};
        data.forEach(item => {
          settings[item.section_key] = item.is_hidden;
        });
        setVisibilitySettings(settings);
      } catch (err) {
        console.error('[SIDEBAR_VISIBILITY] Error:', err);
      }
    };

    fetchVisibility();
  }, [profile]);

  const toggleVisibility = async (sectionKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currentlyHidden = visibilitySettings[sectionKey] || false;
    const nextHidden = !currentlyHidden;

    // Optimistic update
    setVisibilitySettings(prev => ({ ...prev, [sectionKey]: nextHidden }));

    try {
      const { error } = await supabase
        .from('sidebar_visibility')
        .upsert({ section_key: sectionKey, is_hidden: nextHidden }, { onConflict: 'section_key' });

      if (error) throw error;
    } catch (err) {
      console.error('[SIDEBAR_VISIBILITY] Failed to update:', err);
      // Revert on error
      setVisibilitySettings(prev => ({ ...prev, [sectionKey]: currentlyHidden }));
    }
  };

  // 1. Core Auth Guard & Ready State
  useEffect(() => {
    if (!profileLoading) {
      if (!session) {
        // Guest mode is allowed - just set ready
        setIsAuthReady(true);
      } else if (!profile || !isProfileComplete(profile)) {
        console.warn('[AUTH_GUARD] Profile pending. Redirecting to onboarding...');
        router.replace('/auth/complete-profile');
      } else {
        // Auth is confirmed and profile is loaded
        setIsAuthReady(true);
      }
    }
  }, [profileLoading, session, profile, router]);

  // 2. Data fetching is now handled on-demand by individual pages to optimize performance.

  // 3. Mobile handling
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const syncSidebar = (mobile: boolean) => setSidebarOpen(!mobile);

    syncSidebar(mobileQuery.matches);
    const handleBreakpointChange = (event: MediaQueryListEvent) => syncSidebar(event.matches);
    mobileQuery.addEventListener('change', handleBreakpointChange);

    return () => mobileQuery.removeEventListener('change', handleBreakpointChange);
  }, []);

  // 4. Fetch equipped frame - Only when Auth is Ready
  useEffect(() => {
    const fetchEquippedFrame = async () => {
      if (!isAuthReady || !profile?.active_frame_key) {
        setEquippedFrame(null);
        return;
      }
      const { data } = await supabase
        .from('shop_items')
        .select('*')
        .eq('frame_key', profile.active_frame_key)
        .single();
      if (data) setEquippedFrame(data);
    };
    fetchEquippedFrame();
  }, [isAuthReady, profile?.active_frame_key]);

  const handleLogoutClick = async () => {
    if (isGuest) {
      // Clear any session (anonymous or stale) to prevent login redirect loops
      await supabase.auth.signOut();
      clearProfile();
      router.replace('/auth/login');
      router.refresh();
      return;
    }
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await supabase.auth.signOut();
    clearProfile();
    router.replace('/auth/login');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/inventory') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const allNavItems = [
    { label: 'Inicio', href: '/dashboard', icon: Home },
    ...(isAdmin ? [
      { label: 'Panel Admin', href: '/admin', icon: ShieldCheck }
    ] : []),
    { label: 'Cursos', href: '/dashboard/courses', icon: BookOpen },
    { label: 'Biblioteca', href: '/dashboard/library', icon: Library },
    { label: 'Profesores', href: '/dashboard/professors', icon: Users },
    { label: 'Herramientas', href: '/dashboard/herramientas', icon: Wrench },
    { label: 'Tienda', href: '/dashboard/store', icon: ShoppingBag },
    { label: 'Inventario', href: '/inventory', icon: Package },
    { label: 'Eventos', href: '/dashboard/events', icon: Calendar },
    { label: 'Grupos', href: '/dashboard/grupos', icon: Layers },
    { label: 'Nosotros', href: '/dashboard/about', icon: Info },

  ];

  // Filter items for non-admins and guests
  const navItems = allNavItems.filter(item => {
    if (isAdmin) return true; // Admins see everything
    
    // Guests only see specific public sections
    if (isGuest) {
      const allowedForGuests = ['Inicio', 'Cursos', 'Biblioteca', 'Profesores', 'Herramientas', 'Nosotros'];
      return allowedForGuests.includes(item.label);
    }

    return !visibilitySettings[item.label]; // Others see only non-hidden
  });

  // While checking initial session, show minimal splash
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-bb-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-bb-text-secondary animate-pulse text-sm">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  const currentSection = pathname === '/profile'
    ? 'Perfil'
    : navItems.find((item) => isActive(item.href))?.label || 'CampusLink';

  return (
    <div
      className={styles.layout}
      style={{ '--nav-accent': colors?.primary || '#1677ff' } as React.CSSProperties}
    >
      <AnnouncementPopup />

      {sidebarOpen && (
        <button
          type="button"
          className={styles.mobileOverlay}
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú de navegación"
        />
      )}

      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <div className={styles.brandBar}>
          <Link href="/dashboard" className={styles.brand} aria-label="Ir al inicio de CampusLink">
            <span className={styles.brandMark}>
              <img src="/logo/logo-campuslink-v2.png" alt="" />
            </span>
            <span className={styles.brandCopy}>
              <strong>CampusLink</strong>
              <small>Tu espacio académico</small>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className={styles.closeButton}
            aria-label="Cerrar panel lateral"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <Link href="/profile" className={styles.profileCard}>
          <AvatarWithFrame
            size={48}
            avatarUrl={getStorageUrl(profile?.avatar_url)}
            frameUrl={equippedFrame?.image_url}
            frameScale={equippedFrame?.frame_settings?.card?.scale}
            offsetX={equippedFrame?.frame_settings?.card?.x}
            offsetY={equippedFrame?.frame_settings?.card?.y}
            name={profile?.nombre}
          />
          <span className={styles.profileCopy}>
            <span className={styles.profileName}>
              <strong>{profile?.nombre || 'Usuario'}</strong>
              {profile?.es_vip && <img src="/vip-icon.png" alt="Cuenta VIP" />}
              {isAdmin && <ShieldCheck aria-label="Administrador" />}
            </span>
            <small>{isGuest ? 'Invitado' : isAdmin ? 'Administrador' : (profile?.carrera || 'Estudiante')}</small>
          </span>
        </Link>

        <nav className={styles.navigation} aria-label="Navegación principal">
          <p className={styles.navigationLabel}>Explorar</p>
          <div className={styles.navigationList}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const isHidden = Boolean(visibilitySettings[item.label]);

              return (
                <div className={styles.navRow} key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className={styles.navIcon} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(event) => toggleVisibility(item.label, event)}
                      className={`${styles.visibilityButton} ${isHidden ? styles.visibilityButtonHidden : ''}`}
                      aria-label={`${isHidden ? 'Mostrar' : 'Ocultar'} ${item.label} para usuarios`}
                      title={`${isHidden ? 'Mostrar' : 'Ocultar'} sección`}
                    >
                      {isHidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <button type="button" onClick={handleLogoutClick} className={styles.logoutButton}>
            <LogOut aria-hidden="true" />
            <span>{isGuest ? 'Salir' : 'Cerrar sesión'}</span>
          </button>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.accentBar} />
          <div className={styles.topbarInner}>
            <div className={styles.topbarLeading}>
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className={`${styles.menuButton} ${sidebarOpen ? styles.menuButtonHidden : ''}`}
                aria-label="Abrir menú de navegación"
              >
                <Menu aria-hidden="true" />
              </button>
              <div className={styles.pageIdentity}>
                <span>Área personal</span>
                <h1>{currentSection}</h1>
              </div>
            </div>

            <div className={styles.topbarActions}>
              <Link href="/dashboard/store" className={styles.coinCounter} aria-label={`${profile?.monedas || 0} monedas`}>
                <img src="/icons/moneda.png" alt="" />
                <CoinCounter value={profile?.monedas || 0} />
              </Link>

              <button type="button" className={styles.notificationButton} aria-label="Ver notificaciones">
                <Bell aria-hidden="true" />
                <span className={styles.notificationDot} />
              </button>

              <Link href="/profile" className={styles.topbarProfile} aria-label="Abrir mi perfil">
                <AvatarWithFrame
                  size={38}
                  avatarUrl={getStorageUrl(profile?.avatar_url)}
                  frameUrl={equippedFrame?.image_url}
                  frameScale={equippedFrame?.frame_settings?.navbar?.scale}
                  offsetX={equippedFrame?.frame_settings?.navbar?.x}
                  offsetY={equippedFrame?.frame_settings?.navbar?.y}
                  name={profile?.nombre}
                />
              </Link>
            </div>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>

      {/* LOGOUT CONFIRMATION DIALOG */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="bg-bb-card border-bb-border w-[95vw] max-w-md sm:w-full z-[200] rounded-xl">
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

    </div>
  );
}
