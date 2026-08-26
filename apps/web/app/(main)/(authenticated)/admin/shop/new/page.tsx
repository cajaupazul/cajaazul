'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  PackagePlus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { supabase, ShopCategory } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { resizeImage } from '@/lib/image-utils';
import { FrameEditor } from '@/components/admin/FrameEditor';
import { apiFetch } from '@/lib/api';
import { cleanupStoreItemAsset, StoreAssetInput, uploadStoreItemAsset } from '@/lib/store-assets';

type ItemType = 'profile_frame' | 'background' | 'badge' | 'sticker' | 'other';
type Notice = { type: 'error' | 'success' | 'warning'; text: string } | null;

const fieldClass = 'h-12 w-full rounded-xl border border-white/10 bg-[#0d0f12] px-4 text-sm font-semibold text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-blue-500';
const itemTypes: { value: ItemType; label: string; help: string }[] = [
  { value: 'profile_frame', label: 'Marco de perfil', help: 'Se ajusta alrededor del avatar.' },
  { value: 'background', label: 'Fondo', help: 'Personaliza la cabecera del perfil.' },
  { value: 'badge', label: 'Insignia', help: 'Reconocimiento visual permanente.' },
  { value: 'sticker', label: 'Sticker', help: 'Decoración con usos opcionales.' },
  { value: 'other', label: 'Pack', help: 'Agrupa varios artículos existentes.' },
];

export default function NewShopItemPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [allItems, setAllItems] = useState<{ id: string; name: string; type: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preserveAnimation, setPreserveAnimation] = useState(false);
  const [frameSettings, setFrameSettings] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [form, setForm] = useState({
    name: '', description: '', type: 'profile_frame' as ItemType, category_id: '',
    price_coins: 0, frame_key: '', is_active: true, max_uses: null as number | null,
    bundle_items: [] as string[],
  });

  const canManage = profile?.role === 'admin' || profile?.role === 'superadmin';
  const selectedType = itemTypes.find((item) => item.value === form.type)!;

  useEffect(() => {
    if (profile && !canManage) router.replace('/dashboard');
  }, [profile, canManage, router]);

  useEffect(() => {
    if (!canManage) return;
    void Promise.all([
      supabase.from('shop_categories').select('*').order('display_order'),
      supabase.from('shop_items').select('id, name, type').eq('is_active', true).order('name'),
    ]).then(([categoryResult, itemResult]) => {
      if (categoryResult.data) setCategories(categoryResult.data as ShopCategory[]);
      if (itemResult.data) setAllItems(itemResult.data);
    });
  }, [canManage]);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const completion = useMemo(() => {
    const checks = [form.name.trim().length >= 2, form.frame_key.trim().length >= 3, form.price_coins >= 0, !!selectedFile];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form.name, form.frame_key, form.price_coins, selectedFile]);

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setNotice({ type: 'error', text: 'Usa una imagen PNG, JPG, WebP o GIF.' });
      return;
    }
    const maxBytes = file.type === 'image/gif' ? 6 * 1024 * 1024 : 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      setNotice({ type: 'error', text: file.type === 'image/gif' ? 'El GIF no puede superar 6 MB.' : 'La imagen no puede superar 12 MB.' });
      return;
    }
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPreserveAnimation(file.type === 'image/gif');
    setNotice(file.type === 'image/gif' ? {
      type: 'warning',
      text: 'El GIF conservará su animación. Para que la tienda siga rápida, procura que pese menos de 3 MB; para animaciones largas conviene WebP animado.'
    } : null);
  };

  const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 80);

  const save = async () => {
    setNotice(null);
    const cleanName = form.name.trim();
    const cleanKey = normalizeKey(form.frame_key.trim());
    if (cleanName.length < 2) return setNotice({ type: 'error', text: 'Escribe un nombre de al menos 2 caracteres.' });
    if (cleanKey.length < 3) return setNotice({ type: 'error', text: 'El identificador necesita al menos 3 caracteres.' });
    if (!Number.isInteger(form.price_coins) || form.price_coins < 0 || form.price_coins > 10000000) return setNotice({ type: 'error', text: 'El precio en monedas no es válido.' });
    if (!selectedFile) return setNotice({ type: 'error', text: 'Selecciona la imagen del artículo.' });
    if (form.description.length > 1600) return setNotice({ type: 'error', text: 'La descripción no puede superar 1600 caracteres.' });

    setSaving(true);
    let uploadedAsset: StoreAssetInput | null = null;
    try {
      const blob = await resizeImage(selectedFile, 512, preserveAnimation);
      const itemId = crypto.randomUUID();
      uploadedAsset = await uploadStoreItemAsset(itemId, 1, blob, preserveAnimation ? selectedFile.type : 'image/webp');
      await apiFetch('/admin/catalog/items', { method: 'POST', body: JSON.stringify({
        id: itemId,
        name: cleanName,
        description: form.description.trim() || null,
        type: form.type,
        category_id: form.category_id || null,
        price_coins: form.price_coins,
        frame_key: cleanKey,
        max_uses: form.max_uses,
        bundle_items: form.type === 'other' ? form.bundle_items : [],
        frame_settings: form.type === 'profile_frame' ? frameSettings : null,
        asset: uploadedAsset,
      }) });

      setNotice({ type: 'success', text: 'Artículo creado correctamente.' });
      router.push('/admin/shop');
      router.refresh();
    } catch (error) {
      if (uploadedAsset) await cleanupStoreItemAsset(uploadedAsset).catch(console.error);
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'No se pudo crear el artículo.' });
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <main className="min-h-screen bg-[#0d0f12] px-4 py-6 text-white sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1380px]">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="h-4 w-4" /> Volver al catálogo</Link>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-blue-500">Publicación</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Crear un artículo</h1>
            <p className="mt-3 text-sm text-zinc-400">Completa la información, revisa la vista previa y publícalo cuando esté listo.</p>
          </div>
          <button onClick={() => void save()} disabled={saving} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black hover:bg-blue-500 disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'Publicando' : 'Publicar artículo'}
          </button>
        </header>

        <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/10 bg-[#14161a] p-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#25282e]"><div className="h-full bg-blue-600 transition-all" style={{ width: `${completion}%` }} /></div>
          <span className="text-xs font-black tabular-nums text-zinc-400">{completion}% listo</span>
        </div>

        {notice && <div className={`mt-5 flex gap-3 rounded-xl border p-4 text-sm font-semibold ${notice.type === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-300' : notice.type === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>{notice.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{notice.text}</div>}

        <div className="mt-7 grid gap-5 xl:grid-cols-[460px_1fr]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#17191d] p-5 sm:p-6">
              <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600"><PackagePlus className="h-4 w-4" /></div><div><h2 className="font-black">Información comercial</h2><p className="text-xs text-zinc-500">Lo que verá el estudiante.</p></div></div>
              <div className="mt-6 space-y-5">
                <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-500">Nombre</span><input value={form.name} maxLength={120} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej. Marco Clásico Azul" className={fieldClass} /></label>
                <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-500">Tipo</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ItemType })} className={fieldClass}>{itemTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span className="mt-2 block text-xs text-zinc-600">{selectedType.help}</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-500">Categoría</span><select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} className={fieldClass}><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                  <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-500">Precio</span><div className="relative"><img src="/icons/moneda.png" alt="" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" /><input type="number" min="0" step="1" value={form.price_coins} onChange={(event) => setForm({ ...form, price_coins: Math.max(0, Number(event.target.value)) })} className={`${fieldClass} pl-11`} /></div></label>
                </div>
                <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-500">Identificador único</span><input value={form.frame_key} maxLength={80} onChange={(event) => setForm({ ...form, frame_key: normalizeKey(event.target.value) })} placeholder="marco_clasico_azul" className={`${fieldClass} font-mono`} /><span className="mt-2 block text-xs text-zinc-600">Solo letras minúsculas, números, guiones y guiones bajos.</span></label>
                <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-500">Descripción</span><textarea value={form.description} maxLength={1600} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="Explica qué incluye y cómo se utiliza." className={`${fieldClass} h-auto min-h-28 resize-y py-3`} /><span className="mt-2 block text-right text-[10px] text-zinc-700">{form.description.length}/1600</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <label><span className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-500">Usos</span><select value={form.max_uses ?? 'unlimited'} onChange={(event) => setForm({ ...form, max_uses: event.target.value === 'unlimited' ? null : Number(event.target.value) })} className={fieldClass}><option value="unlimited">Ilimitado</option>{[1, 2, 3, 5, 10].map((uses) => <option key={uses} value={uses}>{uses} uso{uses === 1 ? '' : 's'}</option>)}</select></label>
                  <label className="flex items-end"><span className="flex h-12 w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-[#0d0f12] px-4 text-sm font-bold"><span>Visible al publicar</span><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="h-4 w-4 accent-blue-600" /></span></label>
                </div>
              </div>
            </div>

            {form.type === 'other' && (
              <div className="rounded-2xl border border-white/10 bg-[#17191d] p-5 sm:p-6"><h2 className="font-black">Contenido del pack</h2><p className="mt-1 text-xs text-zinc-500">Selecciona los artículos que se entregarán juntos.</p><div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">{allItems.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#0d0f12] p-3"><input type="checkbox" checked={form.bundle_items.includes(item.id)} onChange={(event) => setForm({ ...form, bundle_items: event.target.checked ? [...form.bundle_items, item.id] : form.bundle_items.filter((id) => id !== item.id) })} className="h-4 w-4 accent-blue-600" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.name}</span><span className="text-[10px] uppercase text-zinc-600">{item.type.replace('_', ' ')}</span></label>)}</div></div>
            )}
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#17191d] p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><h2 className="font-black">Archivo y vista previa</h2><p className="mt-1 text-xs text-zinc-500">PNG, JPG o WebP hasta 12 MB; GIF hasta 6 MB.</p></div>{previewUrl && <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>}</div>
              <label className="mt-5 grid min-h-80 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-[#0d0f12] p-6 transition-colors hover:border-blue-500/70">
                {previewUrl ? <img src={previewUrl} alt="Vista previa" decoding="async" className="max-h-[420px] w-full object-contain" /> : <div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-blue-600"><ImageIcon className="h-6 w-6" /></div><p className="mt-5 font-black">Seleccionar imagen</p><p className="mt-1 text-xs text-zinc-600">GIF recomendado: menos de 3 MB. Límite: 6 MB.</p></div>}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => handleFile(event.target.files?.[0])} className="sr-only" />
              </label>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#0d0f12] p-4"><input type="checkbox" checked={preserveAnimation} onChange={(event) => setPreserveAnimation(event.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" /><span><span className="block text-sm font-bold">Conservar animación original</span><span className="mt-1 block text-xs leading-5 text-zinc-600">Actívalo para GIF o WebP animado. Las imágenes estáticas se optimizan automáticamente.</span></span></label>
            </div>

            {previewUrl && form.type === 'profile_frame' ? (
              <div className="rounded-2xl border border-white/10 bg-[#17191d] p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-white/10 pb-5"><Sparkles className="h-5 w-5 text-blue-500" /><div><h2 className="font-black">Ajuste del marco</h2><p className="text-xs text-zinc-500">Alinea el recurso en los tres contextos de uso.</p></div></div><div className="mt-5"><FrameEditor frameImageUrl={previewUrl} onSave={setFrameSettings} /></div></div>
            ) : (
              <div className="flex min-h-32 items-center gap-4 rounded-2xl border border-white/10 bg-[#14161a] p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#24272d] text-zinc-400"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-bold">Validación automática</p><p className="mt-1 text-xs leading-5 text-zinc-500">El backend confirmará rol, formato, precio y consistencia antes de publicar.</p></div></div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
