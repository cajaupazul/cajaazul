'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Download,
  FileImage,
  Files,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import {
  CLOSED_DOWNLOAD_SETTINGS,
  DOWNLOAD_SETTINGS_SELECT,
  type DownloadSettingKey,
  type PlatformDownloadSettings,
} from '@/lib/download-settings';

const DOWNLOAD_CONTROLS: ReadonlyArray<{
  key: DownloadSettingKey;
  title: string;
  extensions: string;
  icon: typeof FileText;
}> = [
  { key: 'pdf_downloads_enabled', title: 'PDF', extensions: '.pdf', icon: FileText },
  { key: 'excel_downloads_enabled', title: 'Excel y hojas de cálculo', extensions: '.xls, .xlsx, .xlsm, .xlsb, .csv, .ods y variantes', icon: FileSpreadsheet },
  { key: 'powerpoint_downloads_enabled', title: 'PowerPoint y presentaciones', extensions: '.ppt, .pptx, .pptm, .ppsx, .odp y variantes', icon: Presentation },
  { key: 'word_downloads_enabled', title: 'Word y documentos', extensions: '.doc, .docx, .docm, .odt, .rtf, .txt y variantes', icon: Files },
  { key: 'image_downloads_enabled', title: 'Imágenes', extensions: '.jpg, .png, .webp, .gif, .svg, .heic y variantes', icon: FileImage },
  { key: 'archive_downloads_enabled', title: 'Archivos comprimidos', extensions: '.zip, .rar, .7z, .tar, .gz y variantes', icon: Archive },
  { key: 'other_downloads_enabled', title: 'Otros archivos', extensions: 'Cualquier extensión no incluida arriba', icon: Download },
];

export function AdminDownloadsToggle() {
  const { profile } = useProfile();
  const [settings, setSettings] = useState<PlatformDownloadSettings | null>(null);
  const [savingKey, setSavingKey] = useState<DownloadSettingKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase
      .from('platform_settings')
      .select(DOWNLOAD_SETTINGS_SELECT)
      .eq('id', true)
      .single();

    if (error) {
      console.error('[DOWNLOAD_SETTINGS_LOAD]', error.code, error.message);
      setErrorMessage('No se pudo cargar la configuración de descargas.');
    } else if (data) {
      setSettings(data as PlatformDownloadSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const toggle = async (key: DownloadSettingKey) => {
    if (!settings || savingKey) return;
    setSavingKey(key);
    setErrorMessage('');
    const next = !settings[key];
    const { data, error } = await supabase
      .from('platform_settings')
      .update({ [key]: next })
      .eq('id', true)
      .select(DOWNLOAD_SETTINGS_SELECT)
      .single();

    if (error) {
      console.error('[DOWNLOAD_SETTINGS_UPDATE]', key, error.code, error.message);
      setErrorMessage('No se pudo guardar el cambio. Inténtalo nuevamente.');
    } else if (data) {
      setSettings(data as PlatformDownloadSettings);
    }
    setSavingKey(null);
  };

  if (!isAdmin) return null;

  const values = settings || {
    ...CLOSED_DOWNLOAD_SETTINGS,
    updated_at: '',
    updated_by: null,
  };

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#14161a]">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">Permisos de descarga</p>
        <h3 className="mt-2 text-lg font-black text-white">Descargas por tipo de archivo</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
          Cada interruptor controla únicamente su familia para usuarios normales. Los administradores y miembros VIP activos siempre conservan la descarga.
        </p>
      </div>

      <div className="grid gap-px bg-white/10 sm:grid-cols-2">
        {DOWNLOAD_CONTROLS.map(({ key, title, extensions, icon: Icon }) => {
          const enabled = values[key];
          const saving = savingKey === key;
          return (
            <div key={key} className="flex min-h-28 items-center justify-between gap-4 bg-[#14161a] p-5 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-zinc-500">{extensions}</p>
                  <p className={`mt-1 text-[10px] font-bold ${enabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {enabled ? 'Habilitada para todos' : 'Sólo VIP y administradores'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void toggle(key)}
                disabled={loading || savingKey !== null}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-50 ${
                  enabled ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600 bg-zinc-700'
                }`}
                role="switch"
                aria-checked={enabled}
                aria-label={`${enabled ? 'Desactivar' : 'Activar'} descargas de ${title} para usuarios normales`}
              >
                {saving ? (
                  <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" />
                ) : (
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 px-5 py-3 text-[10px] text-zinc-600 sm:px-6">
        {loading
          ? 'Cargando configuración…'
          : values.updated_at
            ? `Última actualización: ${new Date(values.updated_at).toLocaleString('es-PE')}`
            : 'Sin información de actualización.'}
      </div>

      {errorMessage && (
        <p className="border-t border-red-500/20 px-5 py-3 text-xs font-semibold text-red-400" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
