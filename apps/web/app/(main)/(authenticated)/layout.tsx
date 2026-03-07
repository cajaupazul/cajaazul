'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, ShopItem, getStorageUrl } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';
import { AvatarWithFrame } from '@/components/ui/AvatarWithFrame';
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
  ShoppingBag,
  Package,
  ShieldCheck,
  ChevronDown,
  LayoutDashboard,
  Wrench
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, loading: themeLoading } = useTheme();
  const { profile, session, loading: profileLoading } = useProfile();
  const { refreshAll, courses, professors, grupos } = useDashboardData();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [equippedFrame, setEquippedFrame] = useState<ShopItem | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // State for collapsible menus
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    'Administración Tienda': true
  });

  const dataFetched = useRef(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // 1. Core Auth Guard & Ready State
  useEffect(() => {
    if (!profileLoading) {
      if (!session) {
        console.log('[AUTH_GUARD] No session. Redirecting...');
        router.replace('/auth/login');
      } else if (!profile) {
        console.warn('[AUTH_GUARD] Profile missing. Redirecting to onboarding...');
        router.replace('/auth/complete-profile');
      } else {
        // Auth is confirmed and profile is loaded
        setIsAuthReady(true);
      }
    }
  }, [profileLoading, session, profile, router]);

  // 2. Data fetching - Only when Auth is Ready
  useEffect(() => {
    if (isAuthReady && session && profile && !dataFetched.current) {
      refreshAll(profile.id);
      dataFetched.current = true;
    }
  }, [isAuthReady, session, profile, refreshAll]);

  // 3. Mobile handling
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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

  const handleLogoutClick = () => setShowLogoutConfirm(true);

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await supabase.auth.signOut();
  };

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/inventory') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navItems = [
    { label: 'Inicio', href: '/dashboard', icon: Home },
    { label: 'Cursos', href: '/dashboard/courses', icon: BookOpen },
    { label: 'Profesores', href: '/dashboard/professors', icon: Users },
    { label: 'Herramientas', href: '/dashboard/herramientas', icon: Wrench },
    { label: 'Tienda', href: '/dashboard/store', icon: ShoppingBag },
    { label: 'Inventario', href: '/inventory', icon: Package },
    { label: 'Eventos', href: '/dashboard/events', icon: Calendar },
    { label: 'Grupos', href: '/dashboard/grupos', icon: Layers },
    { label: 'Nosotros', href: '/dashboard/about', icon: Info },
  ];

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

  // 5. Permission Hunter (Diagnostic for unexpected browser prompts)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track potential permission-requesting APIs
    const trackApi = (name: string, obj: any, method: string) => {
      if (!obj || !obj[method]) return;
      const original = obj[method].bind(obj);
      obj[method] = async function (...args: any[]) {
        console.warn(`🚨 [PERMISSION_HUNTER] Gated API access detected: ${name}.${method}`, { args });
        return original(...args);
      };
    };

    // APIs likely to trigger the generic "Permission" prompt in Chrome
    if ((navigator as any).usb) trackApi('navigator.usb', (navigator as any).usb, 'requestDevice');
    if ((navigator as any).hid) trackApi('navigator.hid', (navigator as any).hid, 'requestDevice');
    if ((navigator as any).serial) trackApi('navigator.serial', (navigator as any).serial, 'requestPort');
    if ((navigator as any).bluetooth) trackApi('navigator.bluetooth', (navigator as any).bluetooth, 'requestDevice');

    // Also look for wakeLock, keyboard lock, etc.
    if ((navigator as any).keyboard) trackApi('navigator.keyboard', (navigator as any).keyboard, 'lock');

  }, []);

  const isInitialLoading = false;

  return (
    <div className="relative flex h-screen bg-bb-dark transition-colors duration-300">
      {/* Overlay de Carga Global */}
      {/* Overlay de Carga Global */}
      {isInitialLoading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bb-dark">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-faculty-primary" style={{ borderColor: colors?.primary }}></div>
            <p className="text-bb-text-secondary animate-pulse">Sincronizando perfil...</p>
          </div>
        </div>
      )}

      {/* El contenido se mantiene montado siempre */}
      <div className={`flex w-full h-full ${isInitialLoading ? 'invisible' : 'visible'}`}>

        {/* MOBILE OVERLAY BACKDROP */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[90] md:hidden backdrop-blur-sm cursor-pointer"
            onClick={() => {
              console.log('Cerrando sidebar desde overlay');
              setSidebarOpen(false);
            }}
            role="button"
            aria-label="Cerrar menú"
            tabIndex={0}
          />
        )}

        {/* SIDEBAR */}
        <div
          className={`
              fixed md:relative z-[100] h-full
              w-72 flex flex-col bg-bb-sidebar border-r border-bb-border text-bb-text overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-none'}
            `}
          style={{
            borderRightColor: colors?.primary + '40',
            // FORCE HIDE ON MOBILE: Si es móvil (<768px) y sidebarOpen es false, forzar translate negativo
            // Usamos una media query inline-like check o simplemente confiamos en el CSS,
            // pero para asegurar, agregamos esto:
            transform: !sidebarOpen && isMobile ? 'translateX(-100%)' : undefined
          }}
        >
          {/* Logo */}
          <div
            className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0 relative"
            style={{ borderColor: colors?.primary + '40' }}
          >
            <Link href="/dashboard" className="flex items-center space-x-3 group relative z-10">
              <div
                className="w-full h-20 flex items-center justify-center overflow-hidden"
              >
                <img
                  src="/logo/logo-gemini.png"
                  alt="CampusLink"
                  className="w-full h-full object-contain"
                />
              </div>
            </Link>
            <button
              onClick={() => {
                console.log('Cerrando sidebar desde botón X');
                setSidebarOpen(false);
              }}
              className="p-2 text-bb-text-secondary hover:text-white cursor-pointer relative z-[110] active:scale-95 touch-manipulation transition-all"
              aria-label="Cerrar panel lateral"
              type="button"
              style={{ pointerEvents: 'auto' }}
            >
              <X className="h-5 w-5 pointer-events-none" />
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
              <div className="relative">
                <AvatarWithFrame
                  size={56}
                  avatarUrl={getStorageUrl(profile?.avatar_url)}
                  frameUrl={equippedFrame?.image_url}
                  frameScale={equippedFrame?.frame_settings?.card?.scale}
                  offsetX={equippedFrame?.frame_settings?.card?.x}
                  offsetY={equippedFrame?.frame_settings?.card?.y}
                  name={profile?.nombre}
                />
              </div>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-bb-text truncate">{profile?.nombre || 'Usuario'}</p>
                  {profile?.es_vip && (
                    <img src="/vip-icon.png" alt="VIP" className="w-4 h-4 object-contain shadow-sm" />
                  )}
                  {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400 fill-blue-400/10" />
                  )}
                </div>
                <p className="text-xs text-bb-text-secondary truncate">{profile?.role === 'admin' || profile?.role === 'superadmin' ? 'Administrador' : (profile?.carrera || 'Estudiante')}</p>
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-0 py-6 overflow-y-auto">
            {navItems.map((item: any) => {
              // 1. Render Normal Item
              if (!item.children) {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className="block w-full group relative transition-all duration-200"
                    style={{
                      backgroundColor: active ? colors?.primary + '08' : 'transparent',
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
                      borderRadius: '0.75rem',
                      margin: '0 0.5rem',
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
              }

              // 2. Render Collapsible Group
              const children = (item as any).children;
              if (!children) return null;

              const isOpen = expandedMenus[item.label] !== false; // Default Open or Controlled
              const Icon = item.icon;
              const hasActiveChild = children.some((child: any) => isActive(child.href));

              return (
                <div key={item.label} className="mb-2">
                  <button
                    onClick={() => setExpandedMenus(prev => ({ ...prev, [item.label]: !isOpen }))}
                    className="w-full flex items-center justify-between px-6 py-3 text-bb-text-secondary hover:text-bb-text transition-colors group relative"
                    style={{ margin: '0 0.5rem', width: 'auto', borderRadius: '0.75rem' }}
                  >
                    <div className="flex items-center gap-3">
                      <Icon style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0, color: hasActiveChild ? colors?.primary : undefined }} />
                      <span className={`font-semibold text-sm ${hasActiveChild ? 'text-white' : ''}`}>{item.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      style={{ color: hasActiveChild ? colors?.primary : undefined }}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1 pb-2">
                          {item.children.map((child: any) => {
                            const ChildIcon = child.icon;
                            const active = isActive(child.href);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => {
                                  if (window.innerWidth < 768) setSidebarOpen(false);
                                }}
                                className="flex items-center gap-3 pl-12 pr-6 py-2.5 text-sm transition-all relative"
                                style={{
                                  color: active ? colors?.primary : 'var(--bb-text-secondary)',
                                  backgroundColor: active ? colors?.primary + '10' : 'transparent',
                                  borderRight: active ? `3px solid ${colors?.primary}` : '3px solid transparent'
                                }}
                              >
                                <ChildIcon className="w-4 h-4" />
                                <span className={active ? 'font-bold' : 'font-medium'}>{child.label}</span>
                              </Link>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div
            className="border-t px-0 py-3 flex-shrink-0"
            style={{ borderColor: colors?.primary + '40' }}
          >
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

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden bg-bb-dark transition-colors duration-300 w-full">
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
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`p-2 rounded-lg transition-all hover:bg-white/5 ${sidebarOpen ? 'hidden' : 'block'}`}
                  style={{ color: colors?.primary }}
                >
                  <Menu className="h-6 w-6" />
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-bb-text truncate transition-colors">
                  {(() => {
                    if (pathname === '/profile') return 'Perfil';
                    // Helper to find active label recursively
                    for (const item of navItems as any[]) {
                      if (item.href && isActive(item.href)) return item.label;
                      if (item.children) {
                        const child = item.children.find((c: any) => isActive(c.href));
                        if (child) return child.label;
                      }
                    }
                    return 'Dashboard';
                  })()}
                </h1>
              </div>

              <div className="flex items-center space-x-4 sm:space-x-6">
                {/* Coin Counter */}
                <div className="flex items-center gap-2 bg-bb-card border border-bb-border px-3 py-1.5 rounded-xl shadow-sm">
                  <img src="/icons/moneda.png" alt="Coin" className="w-5 h-5 object-contain" />
                  <CoinCounter value={profile?.monedas || 0} className="font-bold text-bb-text text-sm" />
                </div>

                <button className="relative p-2 text-bb-text-secondary hover:text-bb-text transition-colors">
                  <Bell className="h-6 w-6" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: colors?.primary }}></span>
                </button>
                <div className="relative">
                  <div className={`relative ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 block'} transition-opacity duration-300`}>
                    <AvatarWithFrame
                      size={40}
                      avatarUrl={getStorageUrl(profile?.avatar_url)}
                      frameUrl={equippedFrame?.image_url}
                      frameScale={equippedFrame?.frame_settings?.navbar?.scale}
                      offsetX={equippedFrame?.frame_settings?.navbar?.x}
                      offsetY={equippedFrame?.frame_settings?.navbar?.y}
                      name={profile?.nombre}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* CONTENT */}
          <main className="flex-1 overflow-auto bg-bb-dark w-full transition-colors duration-300 relative">
            {children}
          </main>
        </div>
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
