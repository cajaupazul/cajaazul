'use client';

import { useRef, useState } from 'react';
import { Flag, X, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type SourceType = 'course' | 'comment' | 'library' | 'tool';

interface ReportButtonProps {
  sourceType: SourceType;
  sourceId: string;
  contextLabel: string;
}

export function ReportButton({ sourceType, sourceId, contextLabel }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMessage('');
    setImageFile(null);
    setImagePreview(null);
    setError('');
    setDone(false);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5 MB.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 10) {
      setError('El mensaje debe tener al menos 10 caracteres.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      let evidencePath: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('report-evidence')
          .upload(path, imageFile, { upsert: false });
        if (uploadError) throw uploadError;
        evidencePath = path;
      }

      const { error: insertError } = await supabase
        .from('content_reports')
        .insert({
          reporter_id: user.id,
          source_type: sourceType,
          source_id: sourceId,
          context_label: contextLabel,
          message: message.trim(),
          evidence_path: evidencePath,
        });

      if (insertError) throw insertError;

      setDone(true);
      setTimeout(() => handleClose(), 2200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar el reporte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-bb-border bg-bb-card px-3 py-1.5 text-xs font-medium text-bb-text-secondary transition-all hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 active:scale-95"
        title="Reportar contenido"
        aria-label="Reportar este contenido"
      >
        <Flag size={13} />
        <span className="hidden sm:inline">Reportar</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className="w-full max-w-md rounded-2xl border border-bb-border bg-bb-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-bb-border px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bb-text-secondary">Moderación</p>
                <h2 id="report-dialog-title" className="text-sm font-bold text-bb-text">Reportar contenido</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1.5 text-bb-text-secondary transition-colors hover:bg-white/5 hover:text-bb-text"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <CheckCircle2 size={40} className="mb-3 text-green-400" />
                <p className="text-sm font-bold text-bb-text">¡Reporte enviado!</p>
                <p className="mt-1 text-xs text-bb-text-secondary">Nuestro equipo lo revisará pronto.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                <div>
                  <p className="mb-1 text-xs text-bb-text-secondary">
                    Contenido: <span className="font-semibold text-bb-text">{contextLabel}</span>
                  </p>
                </div>

                <div>
                  <label htmlFor="report-message" className="mb-1.5 block text-xs font-bold text-bb-text">
                    Describe el problema <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    id="report-message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Explica brevemente qué está mal con este contenido..."
                    rows={4}
                    maxLength={2000}
                    className="w-full resize-none rounded-xl border border-bb-border bg-bb-dark px-3 py-2.5 text-sm text-bb-text placeholder:text-bb-text-secondary/50 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                    required
                  />
                  <p className="mt-1 text-right text-[10px] text-bb-text-secondary/60">{message.length}/2000</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-bb-text">
                    Imagen de evidencia <span className="text-bb-text-secondary/60 font-normal">(opcional)</span>
                  </label>
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Vista previa" className="h-32 w-full rounded-xl object-cover" />
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                        aria-label="Quitar imagen"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-bb-border bg-bb-dark py-4 text-xs text-bb-text-secondary transition-colors hover:border-blue-500/40 hover:text-blue-400"
                    >
                      <Upload size={14} />
                      Subir imagen (JPG, PNG, WEBP — máx 5 MB)
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400 border border-red-500/20">{error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-xl border border-bb-border bg-transparent py-2.5 text-sm font-semibold text-bb-text-secondary transition-colors hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || message.trim().length < 10}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                    {submitting ? 'Enviando...' : 'Enviar reporte'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
