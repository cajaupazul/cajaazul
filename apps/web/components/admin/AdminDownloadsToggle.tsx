'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, DownloadCloud, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';

type Settings = {
  downloads_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
};

export function AdminDownloadsToggle() {
  const { profile } = useProfile();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings')
      .select('downloads_enabled, updated_at, updated_by')
      .single();
    if (data) setSettings(data as Settings);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const toggle = async () => {
    if (!settings || saving) return;
    setSaving(true);
    const next = !settings.downloads_enabled;
    const { error } = await supabase
      .from('platform_settings')
      .update({ downloads_enabled: next })
      .eq('id', true);
    if (!error) {
      setSettings(prev => prev ? { ...prev, downloads_enabled: next, updated_at: new Date().toISOString() } : prev);
    }
    setSaving(false);
  };

  if (!isAdmin) return null;

  return (
    <div className="rounded-2xl border border-bb-border bg-bb-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${settings?.downloads_enabled ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
            {settings?.downloads_enabled ? <DownloadCloud size={20} /> : <Download size={20} />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bb-text-secondary">Plataforma</p>
            <p className="text-sm font-bold text-bb-text">Descargas de materiales</p>
            <p className="text-xs text-bb-text-secondary mt-0.5">
              {loading ? 'Cargando...' : settings?.downloads_enabled
                ? 'Todos los usuarios pueden descargar archivos.'
                : 'Descargas desactivadas. Solo VIP puede descargar.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={loading || saving}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
            settings?.downloads_enabled
              ? 'border-green-500 bg-green-500'
              : 'border-zinc-600 bg-zinc-700'
          }`}
          role="switch"
          aria-checked={settings?.downloads_enabled ?? true}
          aria-label="Activar o desactivar descargas"
        >
          {saving ? (
            <Loader2 size={12} className="absolute inset-0 m-auto animate-spin text-white" />
          ) : (
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                settings?.downloads_enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          )}
        </button>
      </div>

      {settings && (
        <p className="mt-3 text-[10px] text-bb-text-secondary/60 border-t border-bb-border/50 pt-3">
          Última actualización: {new Date(settings.updated_at).toLocaleString('es-PE')}
        </p>
      )}
    </div>
  );
}
