'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Calculator,
  Calendar,
  FileSpreadsheet,
  LayoutGrid,
  Library,
  Mail,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Tags,
  User,
  Users,
  UserRoundCheck,
  UserPlus,
  Flag,
} from 'lucide-react';
import { supabase, getStorageUrl } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { AdminDownloadsToggle } from '@/components/admin/AdminDownloadsToggle';

type DashboardMetric = {
  label: string;
  value: number | null;
  detail: string;
  icon: typeof Users;
};

type AuditEntry = {
  id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_type: string;
  created_at: string;
};

type RecentUser = {
  id: string;
  nombre: string | null;
  google_full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string | null;
  es_vip: boolean | null;
};

const operationalModules = [
  { title: 'Catálogo', description: 'Publica, edita, pausa o retira artículos digitales.', href: '/admin/shop', icon: ShoppingBag, label: 'Tienda' },
  { title: 'Nuevo artículo', description: 'Crea un artículo con precio, categoría y vista previa.', href: '/admin/shop/new', icon: PackagePlus, label: 'Crear' },
  { title: 'Precios y pagos', description: 'Administra los planes VIP y paquetes de monedas.', href: '/admin/store-config', icon: Settings2, label: 'Comercial' },
  { title: 'Categorías', description: 'Ordena la navegación del catálogo sin duplicar productos.', href: '/admin/shop/categories', icon: Tags, label: 'Organización' },
  { title: 'Marco VIP', description: 'Configura el beneficio visual exclusivo de la membresía.', href: '/admin/shop/vip-frame', icon: Boxes, label: 'Beneficios' },
];

const academicModules = [
  { title: 'Accesos excepcionales', description: 'Autoriza correos externos concretos y revoca sus sesiones cuando sea necesario.', href: '/admin/access', icon: UserRoundCheck },
  { title: 'Cursos y profesores', description: 'Gestiona relaciones académicas mediante importación controlada.', href: '/admin/professors-courses', icon: FileSpreadsheet },
  { title: 'Biblioteca', description: 'Modera recursos y mantén la colección confiable y ordenada.', href: '/admin/library', icon: Library },
  { title: 'Malla curricular', description: 'Edita flujos, requisitos y rutas académicas.', href: '/admin/flowcharts/new', icon: LayoutGrid },
  { title: 'Calculadoras', description: 'Administra simuladores y herramientas para estudiantes.', href: '/admin/calculators', icon: Calculator },
  { title: 'Bandeja de reportes', description: 'Revisa y modera reportes enviados por los usuarios.', href: '/admin/reports', icon: Flag },
];

function formatUserDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (isToday) {
    return `Hoy a las ${timeStr}`;
  }
  if (isYesterday) {
    return `Ayer a las ${timeStr}`;
  }
  return `${d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })} · ${timeStr}`;
}

export default function AdminDashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'reports') {
        router.replace('/admin/reports');
      }
    }
  }, [router]);

  const [dataLoading, setDataLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, number | null>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const canManage = profile?.role === 'admin' || profile?.role === 'superadmin';

  const loadOverview = async () => {
    setDataLoading(true);

    const [users, items, categories, products, auditResult, usersListResult] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('shop_items').select('id', { count: 'exact', head: true }),
      supabase.from('shop_categories').select('id', { count: 'exact', head: true }),
      supabase.from('store_products').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('admin_audit_logs').select('id, action, entity_type, created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('profiles').select('id, nombre, google_full_name, email, avatar_url, created_at, role, es_vip').order('created_at', { ascending: false }).limit(40),
    ]);

    setMetrics({
      users: users.count ?? null,
      items: items.count ?? null,
      categories: categories.count ?? null,
      products: products.count ?? null,
    });

    if (!auditResult.error) setAudit((auditResult.data ?? []) as AuditEntry[]);
    if (!usersListResult.error) setRecentUsers((usersListResult.data ?? []) as RecentUser[]);

    setDataLoading(false);
  };

  useEffect(() => {
    if (canManage) void loadOverview();
  }, [canManage]);

  const dashboardMetrics = useMemo<DashboardMetric[]>(() => [
    { label: 'Usuarios', value: metrics.users, detail: 'perfiles registrados', icon: Users },
    { label: 'Artículos', value: metrics.items, detail: 'en el catálogo', icon: ShoppingBag },
    { label: 'Categorías', value: metrics.categories, detail: 'secciones organizadas', icon: BookOpen },
    { label: 'Productos activos', value: metrics.products, detail: 'disponibles para pago', icon: ReceiptText },
  ], [metrics]);

  // Statistics for users
  const { todayCount, weekCount } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let today = 0;
    let week = 0;

    for (const u of recentUsers) {
      if (!u.created_at) continue;
      const d = new Date(u.created_at);
      if (d.toDateString() === todayStr) today++;
      if (d >= sevenDaysAgo) week++;
    }

    return { todayCount: today, weekCount: week };
  }, [recentUsers]);

  // Filtered users by search
  const filteredRecentUsers = useMemo(() => {
    if (!userSearch.trim()) return recentUsers;
    const q = userSearch.toLowerCase().trim();
    return recentUsers.filter((u) => {
      const name = (u.nombre || '').toLowerCase();
      const googleName = (u.google_full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || googleName.includes(q) || email.includes(q);
    });
  }, [recentUsers, userSearch]);

  if (profileLoading) {
    return <main className="grid min-h-[70vh] place-items-center bg-[#0d0f12] text-sm font-bold text-zinc-500">Verificando permisos...</main>;
  }

  if (!canManage) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-[#0d0f12] px-6 text-center text-white">
        <div className="max-w-md">
          <ShieldCheck className="mx-auto h-11 w-11 text-red-400" />
          <h1 className="mt-5 text-2xl font-black">Acceso restringido</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Este espacio está reservado para la administración de CampusLink.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0f12] px-4 py-6 text-zinc-100 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1480px] space-y-10">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-blue-500">
              <ShieldCheck className="h-4 w-4" /> Centro de operaciones
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
              Administración clara, segura y preparada para crecer.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Gestiona catálogo, precios, usuarios y contenido académico desde un solo lugar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={dataLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#17191d] px-5 text-sm font-bold text-white transition-colors hover:bg-[#202329] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`} /> Actualizar datos
          </button>
        </header>

        {/* Resumen operativo */}
        <section aria-label="Resumen operativo" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {dashboardMetrics.map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className="min-h-36 bg-[#14161a] p-5 sm:p-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                <Icon className="h-4 w-4 text-blue-500" /> {label}
              </div>
              <p className="mt-5 text-3xl font-black tabular-nums text-white sm:text-4xl">{dataLoading || value === null ? '—' : value}</p>
              <p className="mt-1 text-xs text-zinc-500 sm:text-sm">{detail}</p>
            </article>
          ))}
        </section>

        {/* Operación comercial */}
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Operación comercial</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Tienda y monetización</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {operationalModules.map(({ title, description, href, icon: Icon, label }) => (
              <Link key={href} href={href} className="group flex min-h-56 flex-col justify-between rounded-2xl border border-white/10 bg-[#17191d] p-5 transition-colors hover:border-blue-500/60 hover:bg-[#1b1e23]">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><Icon className="h-5 w-5" /></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</span>
                  </div>
                  <h3 className="mt-7 text-lg font-black text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-5 text-zinc-400">{description}</p>
                </div>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-400">Abrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        </section>

        {/* Operación Académica + Usuarios (izq) y Resumen Lateral (der) */}
        <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
          <div className="space-y-10">
            {/* Operación académica */}
            <section>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Contenido</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Operación académica</h2>
              <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
                {academicModules.map(({ title, description, href, icon: Icon }) => (
                  <Link key={href} href={href} className="group flex items-start gap-4 bg-[#14161a] p-5 transition-colors hover:bg-[#191c21] sm:p-6">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                    <div>
                      <h3 className="font-black text-white">{title}</h3>
                      <p className="mt-1 text-sm leading-5 text-zinc-500">{description}</p>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-blue-400" />
                  </Link>
                ))}
              </div>
              <AdminDownloadsToggle />
            </section>

            {/* SECCIÓN NUEVA: Usuarios registrados con foto, nombre, correo y fecha de creación */}
            <section>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Comunidad</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Nuevos usuarios registrados</h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    En orden de registro reciente. Revisa foto de perfil, nombre, correo y fecha de creación.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o correo..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#17191d] pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 transition-colors focus:border-blue-500 focus:bg-[#1a1d22] focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#14161a]">
                {dataLoading ? (
                  <div className="flex h-40 items-center justify-center gap-2 text-sm text-zinc-500">
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" /> Cargando usuarios...
                  </div>
                ) : filteredRecentUsers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    {userSearch ? 'No se encontraron usuarios con ese término de búsqueda.' : 'No hay usuarios registrados.'}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 max-h-[580px] overflow-y-auto">
                    {filteredRecentUsers.map((u) => {
                      const avatar = u.avatar_url ? getStorageUrl(u.avatar_url, 'profile-avatars') : null;
                      const displayName = u.nombre || u.google_full_name || 'Usuario sin nombre';
                      const initials = displayName.trim().slice(0, 2).toUpperCase();

                      return (
                        <div
                          key={u.id}
                          className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Avatar */}
                            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/15 bg-zinc-800 flex items-center justify-center shadow-inner">
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={displayName}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="text-xs font-black text-zinc-400">{initials}</span>
                              )}
                              {u.es_vip && (
                                <span
                                  className="absolute -top-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-[9px] font-black text-black shadow"
                                  title="Usuario VIP"
                                >
                                  ★
                                </span>
                              )}
                            </div>

                            {/* Nombre y Correo */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-bold text-white">{displayName}</p>
                                {u.role === 'admin' || u.role === 'superadmin' ? (
                                  <span className="rounded-md border border-blue-500/40 bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-400">
                                    Admin
                                  </span>
                                ) : null}
                                {u.es_vip ? (
                                  <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                                    VIP
                                  </span>
                                ) : null}
                              </div>

                              {u.email ? (
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                                  <Mail className="h-3 w-3 shrink-0 text-zinc-500" />
                                  <span className="truncate">{u.email}</span>
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-zinc-600">Sin correo registrado</p>
                              )}
                            </div>
                          </div>

                          {/* Fecha de Creación */}
                          <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0 self-start pl-14 sm:self-auto sm:pl-0">
                            <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="tabular-nums font-medium">{formatUserDate(u.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Columna Lateral */}
          <aside className="space-y-6">
            {/* Widget de Crecimiento Claro */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Crecimiento</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Comunidad</h2>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <UserPlus className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3 overflow-hidden rounded-2xl border border-white/10 bg-[#14161a] p-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total registrados</span>
                  <span className="text-xl font-black tabular-nums text-white">
                    {dataLoading || metrics.users === null ? '—' : metrics.users}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nuevos hoy</span>
                  <span className="text-base font-black tabular-nums text-emerald-400">
                    +{todayCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Últimos 7 días</span>
                  <span className="text-base font-black tabular-nums text-blue-400">
                    +{weekCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Actividad reciente en tienda / catálogo */}
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Trazabilidad</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Actividad reciente</h2>

              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#14161a]">
                {audit.length === 0 ? (
                  <p className="p-6 text-sm leading-6 text-zinc-500">Los próximos cambios del catálogo aparecerán aquí.</p>
                ) : (
                  audit.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 border-b border-white/10 px-4 py-4 last:border-0">
                      <span className={`h-2 w-2 rounded-full ${entry.action === 'DELETE' ? 'bg-red-500' : entry.action === 'INSERT' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-zinc-200">{entry.entity_type.replace(/_/g, ' ')}</p>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}
                        </p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{entry.action}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
