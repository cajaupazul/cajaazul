'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Clock3, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRoundCheck } from 'lucide-react';
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

function formatDate(value: string | null) {
  if (!value) return 'Sin vencimiento';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function getState(entry: AccessEntry) {
  if (!entry.enabled) return { label: 'Revocado', styles: 'border-red-500/30 bg-red-500/10 text-red-300', Icon: Ban };
  if (entry.expires_at && new Date(entry.expires_at).getTime() <= Date.now()) {
    return { label: 'Expirado', styles: 'border-amber-500/30 bg-amber-500/10 text-amber-200', Icon: Clock3 };
  }
  return { label: entry.claimed_by ? 'En uso' : 'Autorizado', styles: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', Icon: CheckCircle2 };
}

export default function AdminAccessPage() {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
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
    return normalized
      ? entries.filter((entry) => entry.email.includes(normalized) || entry.reason?.toLowerCase().includes(normalized))
      : entries;
  }, [entries, query]);

  const activeCount = entries.filter((entry) => entry.enabled && (!entry.expires_at || new Date(entry.expires_at).getTime() > Date.now())).length;

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await apiFetch<{ entry: AccessEntry }>('/admin/auth/allowlist', {
        method: 'POST',
        body: JSON.stringify({ email, reason, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }),
      });
      setEntries((current) => [response.entry, ...current]);
      setEmail(''); setReason(''); setExpiresAt('');
      setFeedback({ text: 'Correo autorizado. Ya puede ingresar con Google.', error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudo autorizar el correo.', error: true });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleEntry(entry: AccessEntry) {
    setBusyId(entry.id); setFeedback(null);
    try {
      const response = await apiFetch<{ entry: AccessEntry }>(`/admin/auth/allowlist/${entry.id}`, {
        method: 'PATCH', body: JSON.stringify({ enabled: !entry.enabled }),
      });
      setEntries((current) => current.map((item) => item.id === entry.id ? response.entry : item));
      setFeedback({ text: response.entry.enabled ? 'Acceso reactivado.' : 'Acceso revocado y sesiones cerradas.', error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudo cambiar el acceso.', error: true });
    } finally { setBusyId(null); }
  }

  async function removeEntry(entry: AccessEntry) {
    if (!window.confirm(`¿Eliminar la autorización de ${entry.email}?`)) return;
    setBusyId(entry.id); setFeedback(null);
    try {
      await apiFetch(`/admin/auth/allowlist/${entry.id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setFeedback({ text: 'Autorización eliminada y sesiones cerradas.', error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'No se pudo eliminar el acceso.', error: true });
    } finally { setBusyId(null); }
  }

  return (
    <main className="min-h-screen bg-[#0d0f12] px-4 py-6 text-zinc-100 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1380px] space-y-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-blue-500"><ShieldCheck className="h-4 w-4" /> Seguridad de acceso</p>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Cuentas autorizadas</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Aprueba correos externos concretos. Los estudiantes con <strong className="text-zinc-200">@alum.up.edu.pe</strong> siguen entrando automáticamente.
            </p>
          </div>
          <div className="flex gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10">
            <Metric value={activeCount} label="Activos" /><Metric value={entries.length} label="Registrados" />
          </div>
        </header>

        {feedback && <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{feedback.text}</div>}

        <div className="grid gap-7 xl:grid-cols-[390px_1fr]">
          <section className="h-fit rounded-2xl border border-white/10 bg-[#15171b] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600"><UserRoundCheck className="h-5 w-5" /></div>
              <div><h2 className="font-black text-white">Nueva excepción</h2><p className="text-xs text-zinc-500">Un correo exacto por autorización.</p></div>
            </div>
            <form className="mt-7 space-y-5" onSubmit={addEntry}>
              <Field label="Correo de Google">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="off" placeholder="persona@gmail.com" className="field" />
              </Field>
              <Field label="Motivo">
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} rows={3} placeholder="Ej.: colaborador autorizado" className="field resize-none py-3" />
                <span className="mt-1 block text-right text-[10px] tabular-nums text-zinc-600">{reason.length}/240</span>
              </Field>
              <Field label="Vencimiento opcional">
                <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} className="field [color-scheme:dark]" />
              </Field>
              <button type="submit" disabled={submitting} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black hover:bg-blue-500 disabled:opacity-50">
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Autorizar cuenta
              </button>
            </form>
          </section>

          <section>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar correo o motivo" className="field pl-11" /></div>
              <button type="button" onClick={() => void loadEntries()} disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#17191d] px-5 text-sm font-bold hover:bg-[#202329] disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar</button>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#15171b]">
              {loading ? <Empty text="Cargando accesos..." /> : visibleEntries.length === 0 ? <Empty text="No hay autorizaciones para mostrar." /> : visibleEntries.map((entry) => {
                const state = getState(entry); const StateIcon = state.Icon;
                return (
                  <article key={entry.id} className="border-b border-white/10 p-4 last:border-0 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-white">{entry.email}</p><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${state.styles}`}><StateIcon className="h-3 w-3" />{state.label}</span></div>
                        <p className="mt-1 truncate text-sm text-zinc-500">{entry.reason || 'Sin motivo registrado'}</p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-600"><span>Vence: {formatDate(entry.expires_at)}</span><span>Último acceso: {entry.last_used_at ? formatDate(entry.last_used_at) : 'Aún no ingresó'}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={busyId === entry.id} onClick={() => void toggleEntry(entry)} className="h-10 flex-1 rounded-lg border border-white/10 bg-[#0d0f12] px-4 text-xs font-black hover:border-blue-500/60 disabled:opacity-50 lg:flex-none">{entry.enabled ? 'Revocar' : 'Reactivar'}</button>
                        <button type="button" disabled={busyId === entry.id} onClick={() => void removeEntry(entry)} aria-label={`Eliminar acceso de ${entry.email}`} className="grid h-10 w-10 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      <style jsx>{`.field{height:3rem;width:100%;border-radius:.75rem;border:1px solid rgb(255 255 255/.1);background:#0d0f12;padding-left:1rem;padding-right:1rem;font-size:.875rem;color:white;outline:none}.field:focus{border-color:#3b82f6}.field::placeholder{color:#52525b}`}</style>
    </main>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="bg-[#17191d] px-5 py-3"><p className="text-2xl font-black tabular-nums">{value}</p><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{label}</span><div className="mt-2">{children}</div></label>;
}

function Empty({ text }: { text: string }) {
  return <div className="grid min-h-52 place-items-center px-6 text-center text-sm font-semibold text-zinc-500">{text}</div>;
}
