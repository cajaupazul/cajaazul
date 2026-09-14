'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flag, ExternalLink, ChevronDown, RefreshCw, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';

type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

type Report = {
  id: string;
  source_type: string;
  source_id: string | null;
  context_label: string;
  message: string;
  evidence_path: string | null;
  status: ReportStatus;
  created_at: string;
  reporter_id: string;
  profiles: { nombre: string; avatar_url: string | null } | null;
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Abierto',
  reviewing: 'En revisión',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  open: 'bg-red-500/20 text-red-300 border-red-500/30',
  reviewing: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  resolved: 'bg-green-500/20 text-green-300 border-green-500/30',
  dismissed: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const SOURCE_LABELS: Record<string, string> = {
  course: 'Curso',
  comment: 'Comentario',
  library: 'Biblioteca',
  tool: 'Herramienta',
};

type FilterTab = 'all' | ReportStatus;

export default function AdminReportsPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('content_reports')
      .select('id, source_type, source_id, context_label, message, evidence_path, status, created_at, reporter_id, profiles(nombre, avatar_url)')
      .order('created_at', { ascending: false });

    const { data } = await query;
    if (data) setReports(data as unknown as Report[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const changeStatus = async (id: string, newStatus: ReportStatus) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from('content_reports')
      .update({ status: newStatus, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    }
    setUpdatingId(null);
  };

  const openEvidence = async (path: string) => {
    const { data } = await supabase.storage
      .from('report-evidence')
      .createSignedUrl(path, 120);
    if (data?.signedUrl) setEvidenceUrl(data.signedUrl);
  };

  if (profileLoading) {
    return <main className="flex min-h-[60vh] items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" /></main>;
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Flag size={32} className="text-bb-text-secondary/40" />
        <p className="text-sm font-bold text-bb-text-secondary">Sin acceso</p>
      </main>
    );
  }

  const filtered = filter === 'all' ? reports : reports.filter(r => r.status === filter);
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: reports.length },
    { key: 'open', label: 'Abiertos', count: reports.filter(r => r.status === 'open').length },
    { key: 'reviewing', label: 'En revisión', count: reports.filter(r => r.status === 'reviewing').length },
    { key: 'resolved', label: 'Resueltos', count: reports.filter(r => r.status === 'resolved').length },
    { key: 'dismissed', label: 'Descartados', count: reports.filter(r => r.status === 'dismissed').length },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-bb-text-secondary">Administración</p>
          <h1 className="text-2xl font-bold text-bb-text">Bandeja de reportes</h1>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-bb-border bg-bb-card px-4 py-2 text-xs font-bold text-bb-text-secondary transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-colors ${
              filter === t.key
                ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                : 'border-bb-border bg-bb-card text-bb-text-secondary hover:bg-white/5'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${filter === t.key ? 'bg-blue-500/30' : 'bg-white/10'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-bb-border bg-bb-card py-16 text-center">
          <Flag size={32} className="mb-3 text-bb-text-secondary/40" />
          <p className="text-sm font-bold text-bb-text-secondary">Sin reportes</p>
          <p className="mt-1 text-xs text-bb-text-secondary/60">No hay reportes en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(report => (
            <div key={report.id} className="rounded-2xl border border-bb-border bg-bb-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* Left */}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-bb-border bg-bb-dark px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-bb-text-secondary">
                      {SOURCE_LABELS[report.source_type] ?? report.source_type}
                    </span>
                    <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[report.status]}`}>
                      {STATUS_LABELS[report.status]}
                    </span>
                    <span className="text-[10px] text-bb-text-secondary/60">
                      {new Date(report.created_at).toLocaleString('es-PE')}
                    </span>
                  </div>
                  <p className="mb-1 text-sm font-bold text-bb-text">{report.context_label}</p>
                  <p className="text-xs leading-relaxed text-bb-text-secondary line-clamp-3">{report.message}</p>
                  {report.profiles && (
                    <p className="mt-2 text-[11px] text-bb-text-secondary/70">
                      Reportado por: <span className="font-semibold text-bb-text-secondary">{report.profiles.nombre}</span>
                    </p>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex shrink-0 flex-col gap-2">
                  {report.evidence_path && (
                    <button
                      type="button"
                      onClick={() => void openEvidence(report.evidence_path!)}
                      className="flex items-center gap-1.5 rounded-xl border border-bb-border bg-bb-dark px-3 py-1.5 text-xs font-semibold text-bb-text-secondary transition-colors hover:bg-white/5"
                    >
                      <ImageIcon size={12} />
                      Ver evidencia
                    </button>
                  )}
                  <div className="relative">
                    <select
                      value={report.status}
                      onChange={e => void changeStatus(report.id, e.target.value as ReportStatus)}
                      disabled={updatingId === report.id}
                      className="w-full appearance-none rounded-xl border border-bb-border bg-bb-dark py-1.5 pl-3 pr-8 text-xs font-semibold text-bb-text focus:outline-none focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 cursor-pointer"
                      aria-label="Cambiar estado del reporte"
                    >
                      <option value="open">Abierto</option>
                      <option value="reviewing">En revisión</option>
                      <option value="resolved">Resuelto</option>
                      <option value="dismissed">Descartado</option>
                    </select>
                    <ChevronDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-bb-text-secondary" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evidence image modal */}
      {evidenceUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setEvidenceUrl(null)}
          role="presentation"
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setEvidenceUrl(null)}
              className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-bb-card border border-bb-border text-bb-text-secondary hover:text-bb-text"
              aria-label="Cerrar imagen"
            >
              <X size={14} />
            </button>
            <img
              src={evidenceUrl}
              alt="Evidencia del reporte"
              className="w-full rounded-2xl border border-bb-border shadow-2xl"
            />
            <a
              href={evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-bb-border bg-bb-card px-4 py-2 text-xs font-semibold text-bb-text-secondary hover:bg-white/5"
            >
              <ExternalLink size={12} /> Abrir en nueva pestaña
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
