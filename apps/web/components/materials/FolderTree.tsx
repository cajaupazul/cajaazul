'use client';

import React, { useState } from 'react';
import { Folder, FolderOpen, FileText, FileImage, Film, File, ChevronRight, Trash2 } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';

interface BBFile {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

interface BBFolder {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  children: BBFolder[];
  files: BBFile[];
}

interface FolderTreeProps {
  folders: BBFolder[];
  setId: string;
  onDeleted: () => void;
}

function getFileIcon(mime: string) {
  if (mime?.startsWith('image/')) return <FileImage className="w-3.5 h-3.5 text-blue-400" />;
  if (mime?.startsWith('video/')) return <Film className="w-3.5 h-3.5 text-purple-400" />;
  if (mime === 'application/pdf') return <FileText className="w-3.5 h-3.5 text-red-400" />;
  return <File className="w-3.5 h-3.5 text-bb-text-secondary" />;
}

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FolderNode({ folder, setId, onDeleted, depth = 0 }: { folder: BBFolder; setId: string; onDeleted: () => void; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { colors } = useTheme();
  const { profile } = useProfile();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.cajaupazul.workers.dev';

  const handleDeleteFile = async (file: BBFile) => {
    if (!confirm(`¿Eliminar "${file.name}"?`)) return;
    setDeleting(file.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${apiBase}/storage/delete?bucket=course-materials&path=${encodeURIComponent(file.storage_path)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      await supabase.from('bb_files').delete().eq('id', file.id);
      onDeleted();
    } finally { setDeleting(null); }
  };

  const handleDeleteFolder = async () => {
    if (!confirm(`¿Eliminar la carpeta "${folder.name}" y todo su contenido?`)) return;
    setDeleting(folder.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: allFiles } = await supabase.from('bb_files').select('storage_path').eq('set_id', setId);
      const toDelete = (allFiles || []).filter(f => f.storage_path.includes(`/${folder.path}/`) || f.storage_path.includes(`/${folder.path}`));
      for (const f of toDelete) {
        await fetch(`${apiBase}/storage/delete?bucket=course-materials&path=${encodeURIComponent(f.storage_path)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      }
      await supabase.from('bb_folders').delete().eq('id', folder.id);
      onDeleted();
    } finally { setDeleting(null); }
  };

  const hasContent = folder.children.length > 0 || folder.files.length > 0;

  return (
    <div className={depth > 0 ? 'ml-4 border-l border-bb-border/30 pl-3' : ''}>
      <div className="flex items-center gap-2 py-1.5 group cursor-pointer rounded-lg hover:bg-white/3 px-2 transition-colors"
        onClick={() => hasContent && setOpen(o => !o)}>
        <ChevronRight className={`w-3.5 h-3.5 text-bb-text-secondary/50 shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${!hasContent ? 'opacity-0' : ''}`} />
        {open ? <FolderOpen className="w-4 h-4 shrink-0" style={{ color: colors?.primary }} /> : <Folder className="w-4 h-4 shrink-0 text-yellow-500/70" />}
        <span className="text-sm font-semibold text-bb-text flex-1 truncate">{folder.name}</span>
        <span className="text-[10px] text-bb-text-secondary opacity-0 group-hover:opacity-60 transition-opacity">
          {folder.files.length} arch. · {folder.children.length} carpetas
        </span>
        {isAdmin && (
          <button onClick={e => { e.stopPropagation(); handleDeleteFolder(); }}
            disabled={!!deleting}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all ml-1">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div>
          {folder.children.map(child => (
            <FolderNode key={child.id} folder={child} setId={setId} onDeleted={onDeleted} depth={depth + 1} />
          ))}
          {folder.files.map(file => (
            <div key={file.id} className="flex items-center gap-2 py-1.5 px-2 ml-4 rounded-lg hover:bg-white/3 group transition-colors">
              <div className="w-3.5 shrink-0" />
              {getFileIcon(file.mime_type)}
              <span className="text-xs text-bb-text flex-1 truncate">{file.name}</span>
              <span className="text-[10px] text-bb-text-secondary opacity-60 shrink-0">{formatBytes(file.size_bytes)}</span>
              {isAdmin && (
                <button onClick={() => handleDeleteFile(file)} disabled={deleting === file.id}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({ folders, setId, onDeleted }: FolderTreeProps) {
  const rootFolders = folders.filter(f => !f.parent_id);
  if (rootFolders.length === 0) return <p className="text-xs text-bb-text-secondary italic p-4">Sin carpetas</p>;
  return (
    <div className="space-y-0.5">
      {rootFolders.map(folder => (
        <FolderNode key={folder.id} folder={folder} setId={setId} onDeleted={onDeleted} />
      ))}
    </div>
  );
}
