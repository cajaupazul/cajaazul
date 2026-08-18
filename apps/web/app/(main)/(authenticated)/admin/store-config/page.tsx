'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Coins,
  Crown,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';

interface StoreProduct {
  id: string;
  name: string;
  type: 'vip' | 'coins';
  price: number;
  amount: number;
  active: boolean;
  updated_at?: string;
}

type Notice = { type: 'success' | 'error'; text: string } | null;

const inputClass = 'h-12 w-full rounded-xl border border-white/10 bg-[#0f1114] px-4 text-sm font-semibold text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-blue-500 disabled:opacity-50';

export default function StoreConfigPage() {
  const { profile } = useProfile();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const canManage = profile?.role === 'admin' || profile?.role === 'superadmin';

  const loadProducts = async () => {
    setLoading(true);
    setNotice(null);
    const { data, error } = await supabase
      .from('store_products')
      .select('id, name, type, price, amount, active, updated_at')
      .order('type', { ascending: false })
      .order('price', { ascending: true });

    if (error) {
      setNotice({ type: 'error', text: 'No pudimos cargar la configuración comercial.' });
    } else {
      const normalized = (data ?? []).map((product) => ({ ...product, price: Number(product.price) })) as StoreProduct[];
      setProducts(normalized);
      setBaseline(Object.fromEntries(normalized.map((product) => [product.id, JSON.stringify(product)])));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (canManage) void loadProducts();
  }, [canManage]);

  const dirtyCount = useMemo(() => products.filter((product) => baseline[product.id] !== JSON.stringify(product)).length, [products, baseline]);

  const updateProduct = <K extends keyof StoreProduct>(id: string, key: K, value: StoreProduct[K]) => {
    setProducts((current) => current.map((product) => product.id === id ? { ...product, [key]: value } : product));
  };

  const validate = (product: StoreProduct) => {
    if (product.name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.';
    if (!Number.isFinite(product.price) || product.price < 0.5 || product.price > 100000) return 'El precio debe estar entre S/ 0.50 y S/ 100,000.';
    if (!Number.isInteger(product.amount) || product.amount < 1 || product.amount > 1000000) return 'La cantidad debe ser un número entero válido.';
    return null;
  };

  const saveProduct = async (product: StoreProduct) => {
    const validationError = validate(product);
    if (validationError) {
      setNotice({ type: 'error', text: validationError });
      return;
    }

    setSaving(product.id);
    setNotice(null);
    const { data, error } = await supabase
      .from('store_products')
      .update({
        name: product.name.trim(),
        price: Number(product.price.toFixed(2)),
        amount: product.amount,
        active: product.active,
      })
      .eq('id', product.id)
      .select('id, name, type, price, amount, active, updated_at')
      .single();

    if (error || !data) {
      setNotice({ type: 'error', text: error?.message || 'No se pudo guardar el producto.' });
    } else {
      const saved = { ...data, price: Number(data.price) } as StoreProduct;
      setProducts((current) => current.map((item) => item.id === saved.id ? saved : item));
      setBaseline((current) => ({ ...current, [saved.id]: JSON.stringify(saved) }));
      setNotice({ type: 'success', text: `${saved.name} se actualizó y ya es la fuente oficial del checkout.` });
    }
    setSaving(null);
  };

  if (!canManage) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-[#0d0f12] px-6 text-center text-white">
        <div><ShieldCheck className="mx-auto h-10 w-10 text-red-400" /><h1 className="mt-4 text-2xl font-black">Acceso restringido</h1></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0f12] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /> Volver al panel</Link>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-blue-500">Configuración comercial</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Precios y productos de pago</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Los cobros toman siempre el precio guardado aquí. Ningún valor enviado desde el navegador se utiliza para calcular un pago.</p>
          </div>
          <button onClick={() => void loadProducts()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#17191d] px-5 text-sm font-bold hover:bg-[#202329] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </header>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Cambios protegidos por rol, validación y auditoría.</div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${dirtyCount ? 'bg-amber-500 text-black' : 'bg-[#1d2025] text-zinc-400'}`}>{dirtyCount ? `${dirtyCount} cambio${dirtyCount === 1 ? '' : 's'} sin guardar` : 'Todo sincronizado'}</span>
        </div>

        {notice && (
          <div role="status" className={`mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm font-semibold ${notice.type === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
            {notice.type === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{notice.text}
          </div>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          {loading ? [0, 1, 2, 3].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl border border-white/10 bg-[#17191d]" />) : products.map((product) => {
            const Icon = product.type === 'vip' ? Crown : Coins;
            const changed = baseline[product.id] !== JSON.stringify(product);
            return (
              <article key={product.id} className={`rounded-2xl border bg-[#17191d] p-5 sm:p-6 ${changed ? 'border-blue-500/70' : 'border-white/10'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600"><Icon className="h-5 w-5" /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{product.type === 'vip' ? 'Membresía' : 'Monedas'}</p><p className="mt-1 text-sm font-bold text-zinc-300">ID {product.id.slice(0, 8)}</p></div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-400">
                    <input type="checkbox" checked={product.active} onChange={(event) => updateProduct(product.id, 'active', event.target.checked)} className="h-4 w-4 accent-blue-600" /> {product.active ? 'Activo' : 'Pausado'}
                  </label>
                </div>

                <div className="mt-7 space-y-5">
                  <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Nombre visible</span><input value={product.name} maxLength={120} onChange={(event) => updateProduct(product.id, 'name', event.target.value)} className={inputClass} /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Precio</span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">S/</span><input type="number" min="0.5" max="100000" step="0.01" value={product.price} onChange={(event) => updateProduct(product.id, 'price', Number(event.target.value))} className={`${inputClass} pl-11`} /></div></label>
                    <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{product.type === 'vip' ? 'Días incluidos' : 'Monedas incluidas'}</span><input type="number" min="1" step="1" value={product.amount} onChange={(event) => updateProduct(product.id, 'amount', Number(event.target.value))} className={inputClass} /></label>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-2 text-xs text-zinc-600"><Clock3 className="h-3.5 w-3.5" /> {product.updated_at ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(product.updated_at)) : 'Sin cambios previos'}</span>
                  <button onClick={() => void saveProduct(product)} disabled={!changed || saving === product.id} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-[#23262c] disabled:text-zinc-600">
                    {saving === product.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
