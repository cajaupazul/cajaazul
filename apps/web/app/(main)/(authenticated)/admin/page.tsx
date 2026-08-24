'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Calculator,
  FileSpreadsheet,
  LayoutGrid,
  Library,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Tags,
  Users,
  UserRoundCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';

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
];

export default function AdminDashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [dataLoading, setDataLoading] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, number | null>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const canManage = profile?.role === 'admin' || profile?.role === 'superadmin';

  const loadOverview = async () => {
    setDataLoading(true);
    const [users, items, categories, products, auditResult] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('shop_items').select('id', { count: 'exact', head: true }),
      supabase.from('shop_categories').select('id', { count: 'exact', head: true }),
      supabase.from('store_products').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('admin_audit_logs').select('id, action, entity_type, created_at').order('created_at', { ascending: false }).limit(6),
    ]);

    setMetrics({
      users: users.count ?? null,
      items: items.count ?? null,
      categories: categories.count ?? null,
      products: products.count ?? null,
    });
    if (!auditResult.error) setAudit((auditResult.data ?? []) as AuditEntry[]);
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
              Gestiona catálogo, precios y contenido académico desde un solo lugar. Cada cambio comercial queda registrado.
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

        <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
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
          </section>

          <aside>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Trazabilidad</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Actividad reciente</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#14161a]">
              {audit.length === 0 ? (
                <p className="p-6 text-sm leading-6 text-zinc-500">Los próximos cambios del catálogo aparecerán aquí.</p>
              ) : audit.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 border-b border-white/10 px-4 py-4 last:border-0">
                  <span className={`h-2 w-2 rounded-full ${entry.action === 'DELETE' ? 'bg-red-500' : entry.action === 'INSERT' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-200">{entry.entity_type.replace(/_/g, ' ')}</p>
                    <p className="mt-0.5 text-xs text-zinc-600">{new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{entry.action}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
