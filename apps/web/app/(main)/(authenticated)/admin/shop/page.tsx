'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Edit3,
  Image as ImageIcon,
  LayoutGrid,
  PackagePlus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { supabase, ShopItem } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { useProfile } from '@/lib/profile-context';
import { PLACEHOLDERS } from '@/lib/constants';

type Notice = { type: 'success' | 'error'; text: string } | null;
type AdminShopItem = ShopItem & {
  owner_count: number;
  catalog_status: 'active' | 'retired' | 'revoked' | 'deletion_pending';
  shop_item_assets?: Array<{ id: string; status: string; is_current: boolean }>;
};

const typeLabels: Record<string, string> = {
  profile_frame: 'Marco',
  background: 'Fondo',
  badge: 'Insignia',
  sticker: 'Sticker',
  other: 'Pack',
};

export default function AdminShopPage() {
  const { profile } = useProfile();
  const [items, setItems] = useState<AdminShopItem[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminShopItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeConfirmation, setRevokeConfirmation] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const canManage = profile?.role === 'admin' || profile?.role === 'superadmin';

  const loadItems = async () => {
    setLoading(true);
    const [categoryResult, itemResult] = await Promise.all([
      supabase.from('shop_categories').select('id, name').order('display_order'),
      apiFetch<{ items: AdminShopItem[] }>('/admin/catalog/items').then(result => ({ data: result.items, error: null })),
    ]);

    if (categoryResult.data) setCategories(Object.fromEntries(categoryResult.data.map((category) => [category.id, category.name])));
    if (itemResult.error) setNotice({ type: 'error', text: 'No pudimos cargar el catálogo.' });
    else setItems((itemResult.data ?? []) as AdminShopItem[]);
    setLoading(false);
  };

  useEffect(() => {
    if (canManage) void loadItems();
  }, [canManage]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    return items.filter((item) => {
      const matchesText = !normalized || `${item.name} ${item.description ?? ''} ${item.frame_key ?? ''}`.toLocaleLowerCase('es').includes(normalized);
      const matchesStatus = status === 'all' || (status === 'active' ? item.is_active : !item.is_active);
      return matchesText && matchesStatus;
    });
  }, [items, query, status]);

  const toggleStatus = async (item: AdminShopItem) => {
    setBusyId(item.id);
    setNotice(null);
    try {
      const { item: updated } = await apiFetch<{ item: AdminShopItem }>(
        `/admin/catalog/items/${item.id}/${item.is_active ? 'retire' : 'activate'}`,
        { method: 'POST' }
      );
      setItems(current => current.map(currentItem => currentItem.id === item.id ? { ...currentItem, ...updated } : currentItem));
      setNotice({ type: 'success', text: `${item.name} ahora esta ${updated.is_active ? 'visible' : 'retirado'}. Las compras existentes se conservan.` });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo cambiar el estado.' });
    } finally {
      setBusyId(null);
    }
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setNotice(null);
    try {
      await apiFetch(`/admin/catalog/items/${deleteTarget.id}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      setNotice({ type: 'success', text: `${deleteTarget.name} y su archivo se eliminaron. No tenía propietarios.` });
      setDeleteTarget(null);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo eliminar el artículo.' });
    } finally {
      setBusyId(null);
    }
  };

  const revokeItem = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setNotice(null);
    try {
      const response = await apiFetch<{ cleanupPending: boolean }>(`/admin/catalog/items/${deleteTarget.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: revokeReason, confirmation: revokeConfirmation }),
      });
      setDeleteTarget(null);
      setRevokeReason('');
      setRevokeConfirmation('');
      await loadItems();
      setNotice({
        type: response.cleanupPending ? 'error' : 'success',
        text: response.cleanupPending
          ? 'La revocación terminó, pero el archivo requiere limpieza manual.'
          : 'Revocación de emergencia completada y auditada.',
      });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo revocar el artículo.' });
    } finally {
      setBusyId(null);
    }
  };

  const migrateAssets = async () => {
    setBusyId('migration');
    setNotice(null);
    try {
      const result = await apiFetch<{ migrated: number; cleanupPending: number; failed: number }>('/admin/catalog/migrate-assets', { method: 'POST' });
      await loadItems();
      setNotice({
        type: result.failed ? 'error' : 'success',
        text: `${result.migrated} archivo(s) migrados a R2${result.cleanupPending ? `; ${result.cleanupPending} con limpieza anterior pendiente` : ''}${result.failed ? `; ${result.failed} fallaron.` : '.'}`,
      });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo ejecutar la migración.' });
    } finally {
      setBusyId(null);
    }
  };

  if (!canManage) {
    return <main className="grid min-h-[70vh] place-items-center bg-[#0d0f12] text-center text-white"><div><ShieldCheck className="mx-auto h-10 w-10 text-red-400" /><h1 className="mt-4 text-2xl font-black">Acceso restringido</h1></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#0d0f12] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1480px]">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="h-4 w-4" /> Volver al panel</Link>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-blue-500">Catálogo digital</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Artículos de la tienda</h1>
            <p className="mt-3 text-sm text-zinc-400">{items.length} artículos registrados · {items.filter((item) => item.is_active).length} visibles</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => void migrateAssets()} disabled={busyId === 'migration'} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 text-sm font-bold text-amber-300 hover:bg-amber-500/15 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busyId === 'migration' ? 'animate-spin' : ''}`} /> Migrar archivos a R2</button>
            <Link href="/admin/shop/categories" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#17191d] px-5 text-sm font-bold hover:bg-[#202329]"><LayoutGrid className="h-4 w-4" /> Categorías</Link>
            <Link href="/admin/shop/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black hover:bg-blue-500"><PackagePlus className="h-4 w-4" /> Nuevo artículo</Link>
          </div>
        </header>

        {notice && (
          <div className={`mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm font-semibold ${notice.type === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
            {notice.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}{notice.text}
          </div>
        )}

        <section className="mt-7 rounded-2xl border border-white/10 bg-[#14161a]">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center">
            <label className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, clave o descripción" className="h-12 w-full rounded-xl border border-white/10 bg-[#0d0f12] pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-500" /></label>
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-12 rounded-xl border border-white/10 bg-[#0d0f12] px-4 text-sm font-bold outline-none focus:border-blue-500">
              <option value="all">Todos los estados</option><option value="active">Visibles</option><option value="paused">Pausados</option>
            </select>
            <button onClick={() => void loadItems()} disabled={loading} aria-label="Actualizar catálogo" className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-[#0d0f12] hover:bg-[#202329]"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>

          <div className="hidden grid-cols-[minmax(280px,2fr)_1fr_120px_120px_120px] border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600 lg:grid">
            <span>Artículo</span><span>Categoría</span><span>Precio</span><span>Estado</span><span className="text-right">Acciones</span>
          </div>

          {loading ? (
            <div className="grid min-h-72 place-items-center text-zinc-500"><RefreshCw className="h-6 w-6 animate-spin" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 text-center"><div><Boxes className="mx-auto h-9 w-9 text-zinc-700" /><p className="mt-4 font-bold text-zinc-300">No encontramos artículos</p><p className="mt-1 text-sm text-zinc-600">Prueba otro filtro o crea un artículo nuevo.</p></div></div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredItems.map((item) => (
                <article key={item.id} className="grid gap-4 p-4 transition-colors hover:bg-white/[0.02] lg:grid-cols-[minmax(280px,2fr)_1fr_120px_120px_120px] lg:items-center lg:px-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-[#0d0f12]">
                      {item.image_url ? <img src={item.image_url || PLACEHOLDERS.ITEM} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-5 w-5 text-zinc-700" />}
                    </div>
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-black text-white">{item.name}</h2><span className="rounded-md bg-[#25282e] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-400">{typeLabels[item.type] ?? item.type}</span></div><p className="mt-1 line-clamp-1 text-xs text-zinc-500">{item.description || 'Sin descripción'}</p><p className="mt-1 truncate font-mono text-[10px] text-zinc-700">{item.frame_key || item.id} · {item.owner_count} propietario(s) · {item.shop_item_assets?.some(asset => asset.is_current && asset.status === 'active') ? 'R2' : 'archivo heredado'}</p></div>
                  </div>
                  <div className="flex items-center justify-between gap-3 lg:block"><span className="text-[10px] font-black uppercase text-zinc-600 lg:hidden">Categoría</span><span className="text-sm font-semibold text-zinc-300">{item.category_id ? categories[item.category_id] || 'Sin categoría' : 'Sin categoría'}</span></div>
                  <div className="flex items-center justify-between lg:justify-start"><span className="text-[10px] font-black uppercase text-zinc-600 lg:hidden">Precio</span><span className="inline-flex items-center gap-2 text-sm font-black"><img src="/icons/moneda.png" alt="Moneda" className="h-4 w-4" /> {item.price_coins}</span></div>
                  <button onClick={() => void toggleStatus(item)} disabled={busyId === item.id} className={`h-9 rounded-lg border px-3 text-xs font-black ${item.is_active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-[#202329] text-zinc-500'}`}>{busyId === item.id ? 'Guardando' : item.is_active ? 'Visible' : 'Pausado'}</button>
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/shop/edit?id=${item.id}`} aria-label={`Editar ${item.name}`} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-[#0d0f12] text-zinc-400 hover:border-blue-500 hover:text-blue-400"><Edit3 className="h-4 w-4" /></Link>
                    <button onClick={() => setDeleteTarget(item)} aria-label={`Eliminar ${item.name}`} className="grid h-10 w-10 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {deleteTarget && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17191d] p-6">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-red-500/15 text-red-400"><Trash2 className="h-5 w-5" /></div>
            <h2 id="delete-title" className="mt-5 text-xl font-black">Administrar “{deleteTarget.name}”</h2>
            {deleteTarget.owner_count === 0 ? (
              <p className="mt-3 text-sm leading-6 text-zinc-400">Nadie posee este artículo. Puedes eliminar de forma definitiva sus metadatos y su archivo de R2.</p>
            ) : (
              <div className="mt-3 space-y-4">
                <p className="text-sm leading-6 text-zinc-400"><strong className="text-white">{deleteTarget.owner_count} usuario(s)</strong> lo conservan. El borrado normal está bloqueado; usa “Retirar” en la lista para ocultarlo sin afectar sus compras.</p>
                <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-red-300">Solo para una emergencia real</p>
                  <textarea value={revokeReason} onChange={event => setRevokeReason(event.target.value)} placeholder="Motivo detallado de la revocación" className="mt-3 min-h-20 w-full rounded-lg border border-white/10 bg-[#0d0f12] p-3 text-sm outline-none focus:border-red-500" />
                  <input value={revokeConfirmation} onChange={event => setRevokeConfirmation(event.target.value)} placeholder={`Escribe: ${deleteTarget.name}`} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0d0f12] px-3 text-sm outline-none focus:border-red-500" />
                  <button onClick={() => void revokeItem()} disabled={busyId === deleteTarget.id || revokeReason.trim().length < 10 || revokeConfirmation !== deleteTarget.name} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg bg-red-700 px-4 text-sm font-black hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40">Revocar a todos y borrar el archivo</button>
                </div>
              </div>
            )}
            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setDeleteTarget(null)} className="h-11 rounded-xl border border-white/10 px-5 text-sm font-bold hover:bg-white/5">Cancelar</button>
              {deleteTarget.owner_count === 0 && <button onClick={() => void deleteItem()} disabled={busyId === deleteTarget.id} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black hover:bg-red-500 disabled:opacity-50">{busyId === deleteTarget.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Eliminar archivo y registro</button>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
