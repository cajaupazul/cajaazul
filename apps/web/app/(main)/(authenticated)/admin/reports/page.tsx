'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Flag, ExternalLink, ChevronDown, RefreshCw, Image as ImageIcon, X, Check, Loader2, ZoomIn } from 'lucide-react';
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

function AdminReportsContent() {
  const { profile, loading: profileLoading } = useProfile();
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');

  const [reports, setReports] = useState<Report[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [evidenceModalUrl, setEvidenceModalUrl] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  // Helper to load image URL for a given evidence path
  const fetchEvidenceUrl = useCallback(async (path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('report-evidence')
        .createSignedUrl(path, 3600);

      if (data?.signedUrl) return data.signedUrl;

      // Fallback: direct download blob
      const { data: blobData } = await supabase.storage
        .from('report-evidence')
        .download(path);

      if (blobData) {
        return URL.createObjectURL(blobData);
      }
    } catch (e) {
      console.error('Error fetching evidence:', e);
    }
    return null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('content_reports')
      .select('id, source_type, source_id, context_label, message, evidence_path, status, created_at, reporter_id, profiles(nombre, avatar_url)')
      .order('created_at', { ascending: false });

    if (data) {
      const list = data as unknown as Report[];
      setReports(list);

      // Pre-load all evidence images so they are visible right away
      const urls: Record<string, string> = {};
      await Promise.all(
        list.filter(r => r.evidence_path).map(async r => {
          const url = await fetchEvidenceUrl(r.evidence_path!);
          if (url) urls[r.id] = url;
        })
      );
      setEvidenceUrls(urls);
    }
    setLoading(false);
  }, [fetchEvidenceUrl]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  // Auto-open evidence if URL has target ?id=...
  useEffect(() => {
    if (targetId && evidenceUrls[targetId]) {
      setEvidenceModalUrl(evidenceUrls[targetId]);
    }
  }, [targetId, evidenceUrls]);

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

  const handleOpenEvidence = async (report: Report) => {
    if (evidenceUrls[report.id]) {
      setEvidenceModalUrl(evidenceUrls[report.id]);
      return;
    }
    if (report.evidence_path) {
      const url = await fetchEvidenceUrl(report.evidence_path);
      if (url) {
        setEvidenceUrls(prev => ({ ...prev, [report.id]: url }));
        setEvidenceModalUrl(url);
      }
    }
  };

  if (profileLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Flag size={32} className="text-bb-text-secondary/40" />
        <p className="text-sm font-bold text-bb-text-secondary">Acceso restringido a administradores</p>
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
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Moderación y Seguridad</p>
          <h1 className="text-2xl sm:text-3xl font-black text-bb-text">Bandeja de reportes</h1>
          <p className="text-xs text-bb-text-secondary mt-1">Revisa las alertas de contenido e imágenes de evidencia enviadas por los usuarios.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-bb-border bg-bb-card px-4 py-2 text-xs font-bold text-bb-text transition-colors hover:bg-white/5 disabled:opacity-50"
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
                ? 'border-blue-500/50 bg-blue-500/15 text-blue-400'
                : 'border-bb-border bg-bb-card text-bb-text-secondary hover:bg-white/5'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${filter === t.key ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-bb-text-secondary'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-bb-border bg-bb-card py-16 text-center">
          <Flag size={36} className="mb-3 text-bb-text-secondary/40" />
          <p className="text-sm font-bold text-bb-text">Sin reportes</p>
          <p className="mt-1 text-xs text-bb-text-secondary/60">No hay reportes en este estado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(report => {
            const isTargeted = targetId === report.id;
            const evidenceImg = evidenceUrls[report.id];

            return (
              <div
                key={report.id}
                className={`rounded-2xl border bg-bb-card p-5 transition-all shadow-sm ${
                  isTargeted ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-bb-border'
                }`}
              >
                <div className="flex flex-col gap-4">
                  {/* Top line: Source type, Status, Date, Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bb-border/50 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border border-bb-border bg-bb-dark px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-bb-text-secondary">
                        {SOURCE_LABELS[report.source_type] ?? report.source_type}
                      </span>
                      <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[report.status]}`}>
                        {STATUS_LABELS[report.status]}
                      </span>
                      <span className="text-xs text-bb-text-secondary">
                        {new Date(report.created_at).toLocaleString('es-PE')}
                      </span>
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-bb-text-secondary">Estado:</span>
                      <div className="relative">
                        <select
                          value={report.status}
                          onChange={e => void changeStatus(report.id, e.target.value as ReportStatus)}
                          disabled={updatingId === report.id}
                          className="appearance-none rounded-xl border border-bb-border bg-bb-dark py-1.5 pl-3 pr-8 text-xs font-bold text-bb-text focus:outline-none focus:ring-1 focus:ring-blue-500/40 cursor-pointer disabled:opacity-50"
                          aria-label="Cambiar estado"
                        >
                          <option value="open">Abierto</option>
                          <option value="reviewing">En revisión</option>
                          <option value="resolved">Resuelto</option>
                          <option value="dismissed">Descartado</option>
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-bb-text-secondary" />
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-start">
                    <div>
                      <p className="text-sm font-black text-bb-text mb-1">
                        {report.context_label}
                      </p>
                      <div className="rounded-xl bg-bb-dark/60 border border-bb-border/60 p-3.5 mt-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-bb-text-secondary mb-1">Motivo del reporte:</p>
                        <p className="text-sm text-bb-text leading-relaxed whitespace-pre-wrap">
                          {report.message}
                        </p>
                      </div>
                      {report.profiles && (
                        <p className="mt-2.5 text-xs text-bb-text-secondary">
                          Reportado por: <span className="font-bold text-bb-text">{report.profiles.nombre}</span>
                        </p>
                      )}
                    </div>

                    {/* Evidence Image Card (Visible right on the card!) */}
                    {report.evidence_path && (
                      <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                        <p className="text-xs font-bold text-bb-text-secondary flex items-center gap-1.5">
                          <ImageIcon size={13} /> Evidencia adjunta:
                        </p>
                        {evidenceImg ? (
                          <div
                            onClick={() => handleOpenEvidence(report)}
                            className="group relative cursor-pointer overflow-hidden rounded-xl border border-bb-border bg-bb-dark aspect-video flex items-center justify-center hover:border-blue-500/50 transition-all shadow-md"
                          >
                            <img
                              src={evidenceImg}
                              alt="Evidencia"
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                              <ZoomIn size={14} /> Ampliar
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleOpenEvidence(report)}
                            className="flex items-center justify-center gap-2 rounded-xl border border-bb-border bg-bb-dark py-4 text-xs font-bold text-blue-400 hover:bg-white/5 transition-colors"
                          >
                            <ImageIcon size={14} /> Cargar imagen
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para ver imagen de evidencia ampliada */}
      {evidenceModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          onClick={() => setEvidenceModalUrl(null)}
          role="presentation"
        >
          <div className="relative max-w-3xl w-full bg-bb-card border border-bb-border rounded-2xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-bb-border mb-3">
              <h3 className="text-sm font-bold text-bb-text flex items-center gap-2">
                <ImageIcon size={16} className="text-blue-400" /> Evidencia fotográfica del reporte
              </h3>
              <button
                type="button"
                onClick={() => setEvidenceModalUrl(null)}
                className="rounded-lg p-1.5 text-bb-text-secondary hover:bg-white/10 hover:text-bb-text transition-colors"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-hidden rounded-xl bg-black/40 flex items-center justify-center">
              <img
                src={evidenceModalUrl}
                alt="Evidencia ampliada"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <a
                href={evidenceModalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-bb-border bg-bb-dark px-4 py-2 text-xs font-bold text-bb-text hover:bg-white/5 transition-colors"
              >
                <ExternalLink size={13} /> Abrir en nueva pestaña
              </a>
              <button
                type="button"
                onClick={() => setEvidenceModalUrl(null)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></main>}>
      <AdminReportsContent />
    </Suspense>
  );
}
