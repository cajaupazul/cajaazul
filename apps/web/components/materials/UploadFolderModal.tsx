'use client';

import React, { useState, useCallback } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { Upload, FolderOpen, Search, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Professor { id: string; nombre: string; facultad: string; }
interface FileEntry { file: File; relativePath: string; }

interface UploadFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CICLOS = ['2024-1','2024-2','2025-1','2025-2','2026-1','2026-2','2027-1','2027-2'];

export function UploadFolderModal({ isOpen, onClose, onSuccess }: UploadFolderModalProps) {
  const { colors } = useTheme();
  const { profile, session } = useProfile();

  const [step, setStep] = useState<'form'|'uploading'|'done'|'complement'>('form');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [rootName, setRootName] = useState('');
  const [professorSearch, setProfessorSearch] = useState('');
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [selectedProf, setSelectedProf] = useState<Professor | null>(null);
  const [showProfList, setShowProfList] = useState(false);
  const [ciclo, setCiclo] = useState('2026-1');
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');

  const searchProfessors = useCallback(async (q: string) => {
    if (q.length < 2) { setProfessors([]); return; }
    const { data } = await supabase
      .from('professors')
      .select('id, nombre, facultad')
      .ilike('nombre', `%${q}%`)
      .limit(8);
    setProfessors(data || []);
    setShowProfList(true);
  }, []);

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const entries: FileEntry[] = picked.map(f => ({
      file: f,
      relativePath: (f as any).webkitRelativePath || f.name,
    }));
    setFiles(entries);
    const root = entries[0]?.relativePath.split('/')[0] || '';
    setRootName(root);
  };

  const uploadFiles = async (setId: string, entries: FileEntry[], isComplement: boolean) => {
    const folderMap: Record<string, string> = {};

    const allFolderPaths = new Set<string>();
    for (const entry of entries) {
      const parts = entry.relativePath.split('/');
      parts.pop();
      for (let i = 1; i < parts.length; i++) {
        allFolderPaths.add(parts.slice(0, i + 1).join('/'));
      }
    }

    setProgressMsg('Creando estructura de carpetas...');
    const sortedPaths = Array.from(allFolderPaths).sort((a, b) => a.split('/').length - b.split('/').length);

    for (const folderPath of sortedPaths) {
      if (isComplement) {
        const { data: existingFolder } = await supabase
          .from('bb_folders').select('id').eq('set_id', setId).eq('path', folderPath).maybeSingle();
        if (existingFolder) { folderMap[folderPath] = existingFolder.id; continue; }
      }
      const parts = folderPath.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');
      const parentId = parentPath ? folderMap[parentPath] : null;
      const { data: folder, error: folderErr } = await supabase
        .from('bb_folders').insert({ set_id: setId, parent_id: parentId, name, path: folderPath }).select('id').single();
      if (folderErr) throw folderErr;
      folderMap[folderPath] = folder.id;
    }

    const token = session?.access_token;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.huaman.workers.dev';

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      setProgress(Math.round(((i + 1) / entries.length) * 100));
      setProgressMsg(`Subiendo ${i + 1} de ${entries.length}: ${entry.file.name}`);

      const storagePath = `${setId}/${entry.relativePath}`;
      const formData = new FormData();
      formData.append('file', entry.file);
      formData.append('path', storagePath);
      formData.append('bucket', 'course-materials');

      await fetch(`${apiBase}/storage/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const fileParts = entry.relativePath.split('/');
      fileParts.pop();
      const folderPath = fileParts.join('/');
      const folderId = folderPath ? folderMap[folderPath] : null;

      await supabase.from('bb_files').insert({
        set_id: setId, folder_id: folderId,
        name: entry.file.name, storage_path: storagePath,
        size_bytes: entry.file.size, mime_type: entry.file.type,
        uploaded_by: profile?.id,
      });
    }
    setProgress(100);
  };

  const handleSubmit = async () => {
    if (!selectedProf || !ciclo || files.length === 0) {
      setError('Selecciona un profesor, ciclo y carpeta.'); return;
    }
    setError('');
    setStep('uploading');
    try {
      const { data: existing } = await supabase.from('bb_material_sets').select('id')
        .eq('professor_id', selectedProf.id).eq('course_name', rootName).eq('ciclo', ciclo).maybeSingle();

      let setId = existing?.id;
      if (existing) {
        const { data: existingFiles } = await supabase.from('bb_files').select('storage_path').eq('set_id', setId);
        const existingPaths = new Set((existingFiles || []).map((f: any) => f.storage_path));
        const newFiles = files.filter(f => !existingPaths.has(`${setId}/${f.relativePath}`));
        if (newFiles.length === 0) { setStep('complement'); return; }
        await uploadFiles(setId!, newFiles, true);
      } else {
        const { data: newSet, error: setErr } = await supabase.from('bb_material_sets')
          .insert({ professor_id: selectedProf.id, course_name: rootName, ciclo, uploaded_by: profile?.id })
          .select('id').single();
        if (setErr) throw setErr;
        await uploadFiles(newSet.id, files, false);
      }
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Error al subir los archivos');
      setStep('form');
    }
  };

  const reset = () => {
    setStep('form'); setFiles([]); setRootName('');
    setSelectedProf(null); setProfessorSearch(''); setCiclo('2026-1');
    setProgress(0); setProgressMsg(''); setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-bb-card border border-bb-border rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-bb-border bg-bb-sidebar/30">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5" style={{ color: colors?.primary }} />
            <h2 className="font-black text-bb-text text-sm uppercase tracking-widest">Subir Carpeta de Materiales</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-bb-text-secondary transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          {step === 'form' && (
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: colors?.primary }}>Carpeta del curso</label>
                <label className="flex items-center gap-3 w-full p-4 border-2 border-dashed border-bb-border rounded-xl cursor-pointer hover:border-faculty-primary/50 transition-colors">
                  <Upload className="w-5 h-5 text-bb-text-secondary" />
                  <div className="flex-1 min-w-0">
                    {files.length > 0 ? (
                      <><p className="text-sm font-bold text-bb-text truncate">{rootName}</p><p className="text-[10px] text-bb-text-secondary">{files.length} archivos</p></>
                    ) : (
                      <><p className="text-sm text-bb-text-secondary">Haz click para seleccionar la carpeta</p><p className="text-[10px] text-bb-text-secondary opacity-60">Carpeta descargada con la extensión de Blackboard</p></>
                    )}
                  </div>
                  <input type="file" className="hidden" onChange={handleFolderSelect} {...{ webkitdirectory: '', multiple: true } as any} />
                </label>
              </div>

              <div className="relative">
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: colors?.primary }}>Profesor</label>
                {selectedProf ? (
                  <div className="flex items-center justify-between p-3 bg-white/5 border border-bb-border rounded-xl">
                    <div><p className="text-sm font-bold text-bb-text">{selectedProf.nombre}</p><p className="text-[10px] text-bb-text-secondary">{selectedProf.facultad}</p></div>
                    <button onClick={() => { setSelectedProf(null); setProfessorSearch(''); }} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X className="w-3.5 h-3.5 text-bb-text-secondary" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bb-text-secondary" />
                    <input type="text" value={professorSearch}
                      onChange={e => { setProfessorSearch(e.target.value); searchProfessors(e.target.value); }}
                      placeholder="Buscar profesor..."
                      className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-bb-border rounded-xl text-sm text-bb-text placeholder-bb-text-secondary/50 focus:outline-none focus:border-faculty-primary/50 transition-colors"
                    />
                    {showProfList && professors.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-bb-card border border-bb-border rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                        {professors.map(p => (
                          <button key={p.id} onClick={() => { setSelectedProf(p); setShowProfList(false); setProfessorSearch(''); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-bb-border/30 last:border-0">
                            <p className="text-xs font-bold text-bb-text">{p.nombre}</p>
                            <p className="text-[10px] text-bb-text-secondary">{p.facultad}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: colors?.primary }}>Ciclo académico</label>
                <div className="flex flex-wrap gap-2">
                  {CICLOS.map(c => (
                    <button key={c} onClick={() => setCiclo(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${ciclo === c ? 'text-white' : 'border-bb-border text-bb-text-secondary hover:border-bb-text/30'}`}
                      style={ciclo === c ? { backgroundColor: colors?.primary, borderColor: colors?.primary } : {}}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button onClick={handleSubmit} disabled={!selectedProf || !files.length}
                className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: colors?.primary || '#3b82f6' }}>
                Subir Materiales
              </button>
            </div>
          )}

          {step === 'uploading' && (
            <div className="py-10 flex flex-col items-center gap-6">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-bb-border" />
                  <circle cx="40" cy="40" r="34" fill="none" strokeWidth="6"
                    stroke={colors?.primary || '#3b82f6'}
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                    strokeLinecap="round" className="transition-all duration-300" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-bb-text">{progress}%</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-bb-text">Subiendo archivos...</p>
                <p className="text-[11px] text-bb-text-secondary mt-1 max-w-xs">{progressMsg}</p>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <CheckCircle2 className="w-16 h-16 text-green-400" />
              <div className="text-center">
                <p className="text-base font-black text-bb-text">¡Materiales subidos!</p>
                <p className="text-xs text-bb-text-secondary mt-1">La carpeta ya está disponible en la plataforma.</p>
              </div>
              <button onClick={() => { reset(); onSuccess(); onClose(); }}
                className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white"
                style={{ backgroundColor: colors?.primary || '#3b82f6' }}>
                Ver Materiales
              </button>
            </div>
          )}

          {step === 'complement' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <AlertCircle className="w-16 h-16 text-yellow-400" />
              <div className="text-center">
                <p className="text-base font-black text-bb-text">Sin archivos nuevos</p>
                <p className="text-xs text-bb-text-secondary mt-1">Todos los archivos ya existen en este ciclo para este profesor.</p>
              </div>
              <button onClick={() => { reset(); onClose(); }}
                className="px-6 py-2.5 rounded-xl bg-white/5 border border-bb-border font-black text-xs uppercase tracking-widest text-bb-text-secondary hover:text-bb-text transition-colors">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
