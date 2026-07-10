'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { UploadFolderModal } from '@/components/materials/UploadFolderModal';
import { FolderTree } from '@/components/materials/FolderTree';
import {
  FolderOpen, Upload, Search, Trash2, ChevronDown,
  BookOpen, Users, Calendar, Loader2
} from 'lucide-react';

interface BBSet {
  id: string;
  course_name: string;
  ciclo: string;
  created_at: string;
  professor: { id: string; nombre: string; facultad: string };
  uploader: { nombre_completo: string } | null;
  _fileCount?: number;
  _totalSize?: number;
}

interface BBFolder {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  children: BBFolder[];
  files: any[];
}

function buildTree(folders: any[], files: any[]): BBFolder[] {
  const map: Record<string, BBFolder> = {};
  for (const f of folders) map[f.id] = { ...f, children: [], files: [] };
  for (const file of files) {
    if (file.folder_id && map[file.folder_id]) map[file.folder_id].files.push(file);
  }
  const roots: BBFolder[] = [];
  for (const f of folders) {
    if (f.parent_id && map[f.parent_id]) map[f.parent_id].children.push(map[f.id]);
    else roots.push(map[f.id]);
  }
  return roots;
}

export default function MaterialesPage() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const [sets, setSets] = useState<BBSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState<BBSet | null>(null);
  const [treeData, setTreeData] = useState<BBFolder[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCiclo, setFilterCiclo] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);

  const fetchSets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bb_material_sets')
      .select(`id, course_name, ciclo, created_at,
        professor:professor_id (id, nombre, facultad),
        uploader:uploaded_by (nombre_completo)`)
      .order('created_at', { ascending: false });

    if (data) {
      const enriched = await Promise.all(data.map(async (s: any) => {
        const { count: fileCount } = await supabase.from('bb_files').select('id', { count: 'exact', head: true }).eq('set_id', s.id);
        const { data: sizeData } = await supabase.from('bb_files').select('size_bytes').eq('set_id', s.id);
        const totalSize = (sizeData || []).reduce((acc: number, f: any) => acc + (f.size_bytes || 0), 0);
        return { ...s, _fileCount: fileCount || 0, _totalSize: totalSize };
      }));
      setSets(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSets(); }, [fetchSets]);

  const loadTree = async (set: BBSet) => {
    setSelectedSet(set);
    setTreeLoading(true);
    const [{ data: folders }, { data: files }] = await Promise.all([
      supabase.from('bb_folders').select('*').eq('set_id', set.id).order('path'),
      supabase.from('bb_files').select('*').eq('set_id', set.id),
    ]);
    setTreeData(buildTree(folders || [], files || []));
    setTreeLoading(false);
  };

  const handleDeleteSet = async (set: BBSet) => {
    if (!confirm(`¿Eliminar todos los materiales de "${set.course_name} (${set.ciclo})"? Esta acción no se puede deshacer.`)) return;
    setDeletingSetId(set.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.huaman.workers.dev';
      const { data: allFiles } = await supabase.from('bb_files').select('storage_path').eq('set_id', set.id);
      for (const f of allFiles || []) {
        await fetch(`${apiBase}/storage/delete?bucket=course-materials&path=${encodeURIComponent(f.storage_path)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      }
      await supabase.from('bb_material_sets').delete().eq('id', set.id);
      if (selectedSet?.id === set.id) { setSelectedSet(null); setTreeData([]); }
      fetchSets();
    } finally { setDeletingSetId(null); }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const ciclos = [...new Set(sets.map(s => s.ciclo))].sort().reverse();
  const filtered = sets.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.course_name.toLowerCase().includes(q) || s.professor?.nombre.toLowerCase().includes(q);
    const matchCiclo = !filterCiclo || s.ciclo === filterCiclo;
    return matchSearch && matchCiclo;
  });

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden">
      {/* Left panel: list of sets */}
      <div className="w-full md:w-80 lg:w-96 border-r border-bb-border flex flex-col shrink-0 bg-bb-sidebar/20">
        {/* Header */}
        <div className="p-4 border-b border-bb-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" style={{ color: colors?.primary }} />
              <h1 className="font-black text-bb-text text-sm uppercase tracking-widest">Materiales</h1>
            </div>
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: colors?.primary || '#3b82f6' }}>
              <Upload className="w-3.5 h-3.5" />
              Subir
            </button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-bb-text-secondary" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar curso o profesor..."
              className="w-full pl-8 pr-3 py-2 bg-white/5 border border-bb-border rounded-lg text-xs text-bb-text placeholder-bb-text-secondary/50 focus:outline-none focus:border-faculty-primary/40 transition-colors" />
          </div>
          {ciclos.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterCiclo('')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${!filterCiclo ? 'text-white' : 'border-bb-border text-bb-text-secondary'}`}
                style={!filterCiclo ? { backgroundColor: colors?.primary, borderColor: colors?.primary } : {}}>
                Todos
              </button>
              {ciclos.map(c => (
                <button key={c} onClick={() => setFilterCiclo(c === filterCiclo ? '' : c)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${filterCiclo === c ? 'text-white' : 'border-bb-border text-bb-text-secondary'}`}
                  style={filterCiclo === c ? { backgroundColor: colors?.primary, borderColor: colors?.primary } : {}}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-bb-text-secondary" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <FolderOpen className="w-12 h-12 text-bb-text-secondary/30 mb-3" />
              <p className="text-sm font-bold text-bb-text-secondary">Sin materiales</p>
              <p className="text-xs text-bb-text-secondary/60 mt-1">Sube la primera carpeta con el botón de arriba</p>
            </div>
          ) : (
            filtered.map(set => (
              <div key={set.id}
                onClick={() => loadTree(set)}
                className={`p-4 border-b border-bb-border/50 cursor-pointer transition-colors group ${selectedSet?.id === set.id ? 'bg-faculty-primary/5 border-l-2' : 'hover:bg-white/3'}`}
                style={selectedSet?.id === set.id ? { borderLeftColor: colors?.primary } : {}}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-bb-text truncate leading-tight">{set.course_name}</p>
                    <p className="text-[10px] text-bb-text-secondary mt-0.5 truncate">{set.professor?.nombre}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: `${colors?.primary}20`, color: colors?.primary }}>{set.ciclo}</span>
                      <span className="text-[9px] text-bb-text-secondary">{set._fileCount} archivos · {formatBytes(set._totalSize || 0)}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); handleDeleteSet(set); }}
                      disabled={deletingSetId === set.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-all shrink-0 mt-0.5">
                      {deletingSetId === set.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: folder tree */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSet ? (
          <>
            <div className="px-6 py-4 border-b border-bb-border bg-bb-sidebar/10 shrink-0">
              <p className="text-xs font-black text-bb-text uppercase tracking-widest truncate">{selectedSet.course_name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-bb-text-secondary">{selectedSet.professor?.nombre}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: `${colors?.primary}20`, color: colors?.primary }}>{selectedSet.ciclo}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
              {treeLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-bb-text-secondary" /></div>
              ) : (
                <FolderTree folders={treeData} setId={selectedSet.id} onDeleted={() => loadTree(selectedSet)} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <FolderOpen className="w-16 h-16 text-bb-text-secondary/20 mb-4" />
            <p className="text-sm font-bold text-bb-text-secondary">Selecciona un curso</p>
            <p className="text-xs text-bb-text-secondary/60 mt-1">Elige un conjunto de materiales de la lista para ver su contenido</p>
          </div>
        )}
      </div>

      <UploadFolderModal isOpen={showUpload} onClose={() => setShowUpload(false)} onSuccess={fetchSets} />
    </div>
  );
}
