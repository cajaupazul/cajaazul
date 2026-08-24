'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Infinity as InfinityIcon,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type AccessEntry = {
  id: string;
  email: string;
  enabled: boolean;
  reason: string | null;
  expires_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

const inputClass = 'h-12 w-full border border-white/10 bg-[#0d0f12] px-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-45';

function formatDate(value: string | null) {
  if (!value) return 'Sin vencimiento';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getState(entry: AccessEntry) {
  if (!entry.enabled) return { label: 'Revocado', styles: 'border-red-500/25 bg-red-500/10 text-red-300', Icon: Ban };
  if (entry.expires_at && new Date(entry.expires_at).getTime() <= Date.now()) {
    return { label: 'Expirado', styles: 'border-amber-500/25 bg-amber-500/10 text-amber-200', Icon: Clock3 };
  }
  return { label: entry.claimed_by ? 'Cuenta vinculada' : 'Autorizado', styles: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300', Icon: CheckCircle2 };
}

export default function AdminAccessPage() {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [noExpiry, setNoExpiry] = useState(true);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await apiFetch<{ entries: AccessEntry[] }>('/admin/auth/allowlist');
      setEntries(response.entries);
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudieron cargar los accesos.', error: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) => entry.email.includes(normalized) || entry.reason?.toLowerCase().includes(normalized));
  }, [entries, query]);

  const activeCount = entries.filter((entry) => entry.enabled && (!entry.expires_at || new Date(entry.expires_at).getTime() > Date.now())).length;
  const linkedCount = entries.filter((entry) => Boolean(entry.claimed_by)).length;
  const permanentCount = entries.filter((entry) => entry.enabled && !entry.expires_at).length;

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await apiFetch<{ entry: AccessEntry }>('/admin/auth/allowlist', {
        method: 'POST',
        body: JSON.stringify({ email, reason, expiresAt: noExpiry ? null : new Date(expiresAt).toISOString() }),
      });
      setEntries((current) => [response.entry, ...current]);
      setEmail('');
      setReason('');
      setExpiresAt('');
      setNoExpiry(true);
      setFeedback({ text: 'Correo autorizado. Ya puede ingresar con Google.', error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudo autorizar el correo.', error: true });
    } finally {
      setSubmitting(false);
    }
  }

  async function patchEntry(entry: AccessEntry, changes: { enabled?: boolean; expiresAt?: string | null }, successMessage: string) {
    setBusyId(entry.id);
    setFeedback(null);
    try {
      const response = await apiFetch<{ entry: AccessEntry }>(`/admin/auth/allowlist/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      setEntries((current) => current.map((item) => item.id === entry.id ? response.entry : item));
      setFeedback({ text: successMessage, error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudo actualizar el acceso.', error: true });
    } finally {
      setBusyId(null);
    }
  }

  async function removeEntry(entry: AccessEntry) {
    if (!window.confirm(`¿Eliminar la autorización de ${entry.email}?`)) return;
    setBusyId(entry.id);
    setFeedback(null);
    try {
      await apiFetch(`/admin/auth/allowlist/${entry.id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setFeedback({ text: 'Autorización eliminada y sesiones cerradas.', error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudo eliminar el acceso.', error: true });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-full bg-[#0d0f12] px-4 py-6 text-zinc-100 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1400px]">
        <header className="grid gap-7 border-b border-white/10 pb-8 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-blue-500"><ShieldCheck className="h-4 w-4" /> Seguridad de acceso</p>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">Correos autorizados</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Controla excepciones para cuentas de Google externas. Los correos <strong className="text-zinc-200">@alum.up.edu.pe</strong> no necesitan registro previo.
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/10 border border-white/10 bg-[#15171b]">
            <Metric value={activeCount} label="Activos" />
            <Metric value={linkedCount} label="Vinculados" />
            <Metric value={permanentCount} label="Permanentes" />
          </div>
        </header>

        {feedback && <div role="status" className={`mt-6 border px-4 py-3 text-sm font-semibold ${feedback.error ? 'border-red-500/25 bg-red-500/10 text-red-200' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'}`}>{feedback.text}</div>}

        <section className="mt-7 border border-white/10 bg-[#15171b]">
          <div className="grid gap-5 border-b border-white/10 p-5 sm:p-6 lg:grid-cols-[260px_1fr] lg:gap-8">
            <div>
              <div className="grid h-10 w-10 place-items-center bg-blue-600 text-white"><UserRoundCheck className="h-5 w-5" /></div>
              <h2 className="mt-4 font-black text-white">Nueva autorización</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Un correo exacto por registro. La cuenta seguirá usando el inicio de sesión seguro de Google.</p>
            </div>

            <form onSubmit={addEntry} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_auto] xl:items-end">
              <Field label="Correo de Google">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="off" placeholder="persona@gmail.com" className={inputClass} />
              </Field>
              <Field label="Motivo">
                <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} placeholder="Colaborador, invitado…" className={inputClass} />
              </Field>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-400">Vigencia</span>
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-zinc-400">
                    <input type="checkbox" checked={noExpiry} onChange={(event) => setNoExpiry(event.target.checked)} className="h-4 w-4 accent-blue-600" /> Permanente
                  </label>
                </div>
                {noExpiry ? (
                  <div className="flex h-12 items-center gap-2 border border-blue-500/25 bg-blue-500/10 px-4 text-sm font-bold text-blue-200"><InfinityIcon className="h-4 w-4" /> Sin vencimiento</div>
                ) : (
                  <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} className={`${inputClass} [color-scheme:dark]`} />
                )}
              </div>
              <button type="submit" disabled={submitting} className="inline-flex h-12 items-center justify-center gap-2 bg-blue-600 px-6 text-sm font-black text-white transition-colors hover:bg-blue-500 disabled:opacity-50 md:col-span-2 xl:col-span-1">
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Autorizar
              </button>
            </form>
          </div>
          <div className="flex items-start gap-3 bg-[#111317] px-5 py-4 text-xs leading-5 text-zinc-500 sm:px-6">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p><strong className="text-zinc-300">Permanente</strong> significa que la autorización no caduca. La sesión se renueva con tokens seguros y siempre puede cerrarse al revocar el acceso.</p>
          </div>
        </section>

        <section className="mt-7">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por correo o motivo" className={`${inputClass} pl-11`} /></div>
            <button type="button" onClick={() => void loadEntries()} disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 border border-white/10 bg-[#17191d] px-5 text-sm font-bold hover:bg-[#202329] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
          </div>

          <div className="mt-4 border border-white/10 bg-[#15171b]">
            {loading ? <Empty text="Cargando accesos…" /> : visibleEntries.length === 0 ? <Empty text="No hay autorizaciones para mostrar." /> : visibleEntries.map((entry) => {
              const state = getState(entry);
              const StateIcon = state.Icon;
              return (
                <article key={entry.id} className="border-b border-white/10 p-4 last:border-0 sm:p-5">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-all font-black text-white sm:truncate">{entry.email}</p>
                        <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${state.styles}`}><StateIcon className="h-3 w-3" />{state.label}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-zinc-500">{entry.reason || 'Sin motivo registrado'}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> {formatDate(entry.expires_at)}</span>
                        <span className="flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" /> Último acceso: {entry.last_used_at ? formatDate(entry.last_used_at) : 'Aún no ingresó'}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.expires_at && entry.enabled && (
                        <button type="button" disabled={busyId === entry.id} onClick={() => void patchEntry(entry, { expiresAt: null }, 'La autorización ahora no tiene vencimiento.')} className="h-10 flex-1 border border-white/10 bg-[#0d0f12] px-4 text-xs font-black text-zinc-200 hover:border-blue-500/60 disabled:opacity-50 lg:flex-none">Hacer permanente</button>
                      )}
                      <button type="button" disabled={busyId === entry.id} onClick={() => void patchEntry(entry, { enabled: !entry.enabled }, entry.enabled ? 'Acceso revocado y sesiones cerradas.' : 'Acceso reactivado.')} className="h-10 flex-1 border border-white/10 bg-[#0d0f12] px-4 text-xs font-black hover:border-blue-500/60 disabled:opacity-50 lg:flex-none">{entry.enabled ? 'Revocar' : 'Reactivar'}</button>
                      <button type="button" disabled={busyId === entry.id} onClick={() => void removeEntry(entry)} aria-label={`Eliminar acceso de ${entry.email}`} className="grid h-10 w-10 place-items-center border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="min-w-24 px-4 py-3 sm:min-w-28 sm:px-5"><p className="text-xl font-black tabular-nums text-white sm:text-2xl">{value}</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 sm:text-[10px]">{label}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[11px] font-black uppercase tracking-[0.15em] text-zinc-400">{label}</span>{children}</label>;
}

function Empty({ text }: { text: string }) {
  return <div className="grid min-h-52 place-items-center px-6 text-center text-sm font-semibold text-zinc-500">{text}</div>;
}
