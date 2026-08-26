'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  Image as ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { resizeImage } from '@/lib/image-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { deleteFileFromR2WithRetry, getSecureFileUrl, uploadFileToR2 } from '@/lib/r2-storage';

interface ScheduledFrame {
  id: string;
  image_url: string;
  label: string;
  description: string | null;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  scale_factor: number;
  offset_x: number;
  offset_y: number;
  asset_bucket: string | null;
  asset_object_key: string | null;
}

interface MonthSlot {
  key: string;
  label: string;
  shortLabel: string;
  monthStart: Date;
  monthEnd: Date;
  frame: ScheduledFrame | null;
}

const FIELD_CLASS =
  'h-11 border-white/10 !bg-[#0e1117] !text-zinc-100 caret-amber-300 placeholder:!text-zinc-600 focus-visible:border-amber-400 focus-visible:ring-amber-400/20';

const pad = (value: number) => String(value).padStart(2, '0');

function toLocalInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getMonthWindow(offset: number) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1, 0, 0, 0, 0);
  const startsAt = offset === 0 && now > monthStart ? now : monthStart;
  startsAt.setSeconds(0, 0);
  return { monthStart, monthEnd, startsAt };
}

function frameOverlapsMonth(frame: ScheduledFrame, monthStart: Date, monthEnd: Date) {
  const start = new Date(frame.starts_at).getTime();
  const end = frame.expires_at ? new Date(frame.expires_at).getTime() : Number.POSITIVE_INFINITY;
  return start < monthEnd.getTime() && end > monthStart.getTime();
}

export default function VipFrameSchedulePage() {
  const { profile } = useProfile();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduledFrame[]>([]);
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [skipResize, setSkipResize] = useState(false);
  const initialWindow = getMonthWindow(0);
  const [form, setForm] = useState({
    label: 'Marco exclusivo',
    description: '',
    starts_at: toLocalInputValue(initialWindow.startsAt),
    expires_at: toLocalInputValue(initialWindow.monthEnd),
    scale_factor: 1.4,
    offset_x: 0,
    offset_y: 0,
  });

  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'superadmin') {
      router.replace('/dashboard/store');
    }
  }, [profile, router]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchSchedule = useCallback(async () => {
    setIsLoadingSchedule(true);
    const { data, error } = await supabase
      .from('vip_exclusive_frames')
      .select('id,image_url,label,description,starts_at,expires_at,is_active,scale_factor,offset_x,offset_y,asset_bucket,asset_object_key')
      .eq('is_active', true)
      .order('starts_at', { ascending: true });

    if (error) {
      console.error('[VIP frames] No se pudo cargar el cronograma:', error);
    } else {
      setSchedule((data || []) as ScheduledFrame[]);
    }
    setIsLoadingSchedule(false);
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'superadmin') void fetchSchedule();
  }, [fetchSchedule, profile?.role]);

  const monthSlots = useMemo<MonthSlot[]>(() => {
    return Array.from({ length: 12 }, (_, offset) => {
      const { monthStart, monthEnd } = getMonthWindow(offset);
      return {
        key: `${monthStart.getFullYear()}-${pad(monthStart.getMonth() + 1)}`,
        label: new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(monthStart),
        shortLabel: new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(monthStart).replace('.', ''),
        monthStart,
        monthEnd,
        frame: schedule.find((item) => frameOverlapsMonth(item, monthStart, monthEnd)) || null,
      };
    });
  }, [schedule]);

  const selectedSlot = monthSlots[selectedMonthOffset];

  const selectMonth = (offset: number) => {
    const slot = monthSlots[offset];
    if (!slot || slot.frame) return;
    const window = getMonthWindow(offset);
    setSelectedMonthOffset(offset);
    setForm((current) => ({
      ...current,
      label: `Marco ${slot.label}`,
      starts_at: toLocalInputValue(window.startsAt),
      expires_at: toLocalInputValue(window.monthEnd),
    }));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecciona una imagen PNG, WebP o GIF.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen no puede superar 8 MB. Para una carga rápida, recomendamos menos de 2 MB.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setSkipResize(file.type === 'image/gif' || file.type === 'image/webp');
  };

  const clearSelectedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setSkipResize(false);
  };

  const handleSave = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selectedFile) {
      alert('Selecciona la imagen del marco.');
      return;
    }
    if (!form.label.trim()) {
      alert('Escribe una etiqueta para identificar el marco.');
      return;
    }

    const startsAt = new Date(form.starts_at);
    const expiresAt = new Date(form.expires_at);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || startsAt >= expiresAt) {
      alert('La fecha de fin debe ser posterior a la fecha de inicio.');
      return;
    }

    setIsSaving(true);
    let uploadedPath: string | null = null;
    try {
      const imageBlob = await resizeImage(selectedFile, 512, skipResize);
      const sourceExtension = selectedFile.name.split('.').pop()?.toLowerCase() || 'webp';
      const extension = skipResize ? sourceExtension : 'webp';
      const frameId = crypto.randomUUID();
      const mimeType = skipResize ? selectedFile.type : 'image/webp';
      uploadedPath = `scheduled/${frameId}/v1/original.${extension}`;
      const uploadFile = new File([imageBlob], `original.${extension}`, { type: mimeType });
      await uploadFileToR2('profile-frames', uploadedPath, uploadFile);
      const digest = await crypto.subtle.digest('SHA-256', await uploadFile.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      const { error: dbError } = await supabase.from('vip_exclusive_frames').insert({
        id: frameId,
        image_url: getSecureFileUrl('profile-frames', uploadedPath),
        label: form.label.trim(),
        description: form.description.trim() || null,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        scale_factor: form.scale_factor,
        offset_x: form.offset_x,
        offset_y: form.offset_y,
        is_active: true,
        asset_bucket: 'profile-frames',
        asset_object_key: uploadedPath,
        asset_mime_type: mimeType,
        asset_size_bytes: uploadFile.size,
        asset_checksum_sha256: checksum,
      });
      if (dbError) throw dbError;

      clearSelectedFile();
      setForm((current) => ({ ...current, description: '' }));
      await fetchSchedule();
      alert('Marco programado. Se activará automáticamente en la fecha indicada.');
    } catch (error: any) {
      if (uploadedPath) await deleteFileFromR2WithRetry('profile-frames', uploadedPath).catch(console.error);
      console.error('[VIP frames] Error al programar:', error);
      const overlap = error?.code === '23P01';
      alert(overlap ? 'Ese periodo ya tiene un marco programado. Cancélalo o elige otro mes.' : `No se pudo guardar: ${error?.message || 'error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelFrame = async (frame: ScheduledFrame) => {
    if (!confirm(`¿Cancelar “${frame.label}”? Dejará de mostrarse en su periodo.`)) return;
    setRemovingId(frame.id);
    const { error } = await supabase.from('vip_exclusive_frames').update({ is_active: false }).eq('id', frame.id);
    if (error) alert(`No se pudo cancelar: ${error.message}`);
    else {
      if (frame.asset_object_key) await deleteFileFromR2WithRetry('profile-frames', frame.asset_object_key).catch(console.error);
      await fetchSchedule();
    }
    setRemovingId(null);
  };

  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) return null;

  const now = Date.now();

  return (
    <main className="min-h-screen bg-[#070809] px-4 py-6 text-zinc-100 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px] space-y-7">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <Link href="/admin/shop">
              <Button variant="outline" size="icon" className="mt-1 border-white/10 bg-[#111318] text-zinc-200 hover:bg-[#1a1d23] hover:text-white">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-400">Tienda · Colección VIP</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Cronograma de marcos</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Programa los próximos doce meses. Al terminar un periodo, el siguiente marco se publica automáticamente.</p>
            </div>
          </div>
          <Button onClick={() => handleSave()} disabled={isSaving || Boolean(selectedSlot?.frame)} className="h-11 bg-blue-600 px-6 font-black text-white hover:bg-blue-500 disabled:opacity-40">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Guardando…' : 'Programar marco'}
          </Button>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#101214] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black"><CalendarDays className="h-5 w-5 text-amber-400" /> Próximos 12 meses</h2>
              <p className="mt-1 text-xs text-zinc-500">Selecciona una casilla vacía para cargar su marco.</p>
            </div>
            <div className="hidden items-center gap-4 text-[11px] font-bold text-zinc-500 sm:flex"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />Activo</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-500" />Programado</span></div>
          </div>

          {isLoadingSchedule ? (
            <div className="grid h-28 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-500" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12">
              {monthSlots.map((slot, index) => {
                const isCurrent = slot.monthStart.getMonth() === new Date().getMonth() && slot.monthStart.getFullYear() === new Date().getFullYear();
                const isLive = Boolean(slot.frame && new Date(slot.frame.starts_at).getTime() <= now && (!slot.frame.expires_at || new Date(slot.frame.expires_at).getTime() > now));
                const isSelected = selectedMonthOffset === index && !slot.frame;
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => selectMonth(index)}
                    disabled={Boolean(slot.frame)}
                    className={`relative min-h-28 rounded-xl border p-3 text-left transition-colors ${isSelected ? 'border-amber-400 bg-amber-400/10' : slot.frame ? 'border-white/10 bg-[#17191c]' : 'border-white/10 bg-[#0b0d0f] hover:border-white/30 hover:bg-[#141619]'}`}
                  >
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{slot.monthStart.getFullYear()}</span>
                    <span className="mt-1 block text-sm font-black capitalize text-zinc-100">{slot.shortLabel}</span>
                    {slot.frame ? (
                      <>
                        <img src={slot.frame.image_url} alt="" className="absolute right-2 top-2 h-10 w-10 rounded-full object-contain" />
                        <span className={`mt-4 inline-flex items-center gap-1 text-[10px] font-black uppercase ${isLive ? 'text-emerald-400' : 'text-blue-400'}`}><i className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-blue-400'}`} />{isLive ? 'Activo' : 'Listo'}</span>
                      </>
                    ) : (
                      <span className="mt-5 inline-flex items-center gap-1 text-[10px] font-bold text-zinc-600">{isSelected ? <Check className="h-3 w-3 text-amber-400" /> : <Upload className="h-3 w-3" />}{isCurrent ? 'Este mes' : 'Vacío'}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)]">
          <form onSubmit={handleSave} className="space-y-5">
            <section className="rounded-2xl border border-white/10 bg-[#101214] p-5 sm:p-6">
              <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Periodo seleccionado</p><h2 className="mt-1 text-xl font-black capitalize">{selectedSlot?.label}</h2></div>
                {selectedSlot?.frame && <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase text-blue-400">Ya programado</span>}
              </div>

              {selectedSlot?.frame ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#0b0d0f] p-4">
                    <img src={selectedSlot.frame.image_url} alt={selectedSlot.frame.label} className="h-20 w-20 shrink-0 rounded-full object-contain" />
                    <div className="min-w-0 flex-1"><p className="truncate font-black">{selectedSlot.frame.label}</p><p className="mt-1 text-xs text-zinc-500">{new Date(selectedSlot.frame.starts_at).toLocaleString('es-PE')} — {selectedSlot.frame.expires_at ? new Date(selectedSlot.frame.expires_at).toLocaleString('es-PE') : 'sin límite'}</p></div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => cancelFrame(selectedSlot.frame!)} disabled={removingId === selectedSlot.frame.id} className="w-full border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300">
                    {removingId === selectedSlot.frame.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Cancelar programación
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <label className="block"><Label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Etiqueta</Label><Input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} className={FIELD_CLASS} placeholder="Ej. Marco de septiembre" /></label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label><Label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Se publica</Label><Input type="datetime-local" required value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} className={`${FIELD_CLASS} [color-scheme:dark]`} /></label>
                    <label><Label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Se retira</Label><Input type="datetime-local" required value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} className={`${FIELD_CLASS} [color-scheme:dark]`} /></label>
                  </div>
                  <label className="block"><Label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Descripción opcional</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-24 border-white/10 !bg-[#0e1117] !text-zinc-100 caret-amber-300 placeholder:!text-zinc-600 focus-visible:border-amber-400 focus-visible:ring-amber-400/20" placeholder="Describe brevemente esta edición…" /></label>
                </div>
              )}
            </section>

            {!selectedSlot?.frame && (
              <section className="rounded-2xl border border-white/10 bg-[#101214] p-5 sm:p-6">
                <h2 className="text-base font-black">Imagen y ajuste</h2>
                <label className="mt-4 flex min-h-48 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#0b0d0f] p-5 transition-colors hover:border-amber-400/50">
                  {previewUrl ? <img src={previewUrl} alt="Vista previa" className="h-40 w-40 object-contain" /> : <div className="text-center"><ImageIcon className="mx-auto h-8 w-8 text-zinc-600" /><p className="mt-3 text-sm font-black">Subir marco</p><p className="mt-1 text-xs text-zinc-600">PNG, WebP o GIF · máximo 8 MB</p></div>}
                  <input type="file" accept="image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
                </label>
                {previewUrl && <button type="button" onClick={clearSelectedFile} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-400"><X className="h-3.5 w-3.5" />Quitar imagen</button>}

                <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
                  <label className="block"><span className="flex justify-between text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500"><span>Escala</span><b className="text-amber-400">{form.scale_factor.toFixed(2)}×</b></span><input type="range" min="0.5" max="3" step="0.05" value={form.scale_factor} onChange={(event) => setForm({ ...form, scale_factor: Number(event.target.value) })} className="mt-2 w-full accent-amber-400" /></label>
                  <div className="grid grid-cols-2 gap-4">
                    <label><span className="flex justify-between text-[10px] font-black uppercase text-zinc-500"><span>Posición X</span><b>{form.offset_x}</b></span><input type="range" min="-100" max="100" value={form.offset_x} onChange={(event) => setForm({ ...form, offset_x: Number(event.target.value) })} className="mt-2 w-full accent-amber-400" /></label>
                    <label><span className="flex justify-between text-[10px] font-black uppercase text-zinc-500"><span>Posición Y</span><b>{form.offset_y}</b></span><input type="range" min="-100" max="100" value={form.offset_y} onChange={(event) => setForm({ ...form, offset_y: Number(event.target.value) })} className="mt-2 w-full accent-amber-400" /></label>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0b0d0f] p-3"><input type="checkbox" checked={skipResize} onChange={(event) => setSkipResize(event.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-400" /><span className="text-xs leading-5 text-zinc-400"><b className="block text-zinc-200">Preservar animación</b>Úsalo para GIF o WebP animado. Para mejor rendimiento, mantén el archivo por debajo de 2 MB.</span></label>
                </div>
              </section>
            )}
          </form>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-white/10 bg-[#101214] p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Vista previa</p><h2 className="mt-1 text-xl font-black">Perfil con marco</h2></div><Sparkles className="h-5 w-5 text-amber-400" /></div>
              <div className="mt-5 grid min-h-[330px] place-items-center rounded-xl bg-[#08090a] p-8">
                {previewUrl ? (
                  <div className="relative h-36 w-36">
                    <div className="absolute inset-3 rounded-full border border-white/10 bg-[#22262c]" />
                    <ImageIcon className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-zinc-700" />
                    <img src={previewUrl} alt="Marco" className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] object-contain" style={{ transform: `translate(calc(-50% + ${form.offset_x}px), calc(-50% + ${form.offset_y}px)) scale(${form.scale_factor})`, transformOrigin: 'center' }} />
                  </div>
                ) : selectedSlot?.frame ? (
                  <img src={selectedSlot.frame.image_url} alt={selectedSlot.frame.label} className="h-44 w-44 object-contain" />
                ) : (
                  <div className="max-w-xs text-center"><ImageIcon className="mx-auto h-10 w-10 text-zinc-700" /><p className="mt-3 font-black text-zinc-400">Esperando imagen</p><p className="mt-1 text-xs leading-5 text-zinc-600">La previsualización aparecerá aquí antes de programar.</p></div>
                )}
              </div>
            </section>
            <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /><p className="text-xs leading-5 text-zinc-400"><b className="text-zinc-200">Cambio automático.</b> El sistema revisa el cronograma cada minuto y publica el marco vigente sin intervención manual.</p></div>
            <div className="flex gap-3 rounded-xl border border-white/10 bg-[#101214] p-4"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" /><p className="text-xs leading-5 text-zinc-400">Los periodos no pueden superponerse. Puedes cancelar una programación y volver a cargarla antes de que empiece.</p></div>
          </aside>
        </div>

        <div className="sticky bottom-3 z-20 md:hidden"><Button onClick={() => handleSave()} disabled={isSaving || Boolean(selectedSlot?.frame)} className="h-12 w-full bg-blue-600 font-black text-white"><Save className="mr-2 h-4 w-4" />Programar marco</Button></div>
      </div>
    </main>
  );
}
