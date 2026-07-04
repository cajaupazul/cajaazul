'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Star, Download, User, ExternalLink, Trash2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme-context';
import SecureFileModal from '@/components/secure/SecureFileModal';
import { useProfile } from '@/lib/profile-context';
import { supabase, LibraryBook } from '@/lib/supabase';

interface BookDetailModalProps {
  book: LibraryBook | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({ book, isOpen, onClose, onDeleted }) => {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const [showViewer, setShowViewer] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!book || !mounted) return null;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const getFavicon = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const extractPath = (url: string | null) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('path');
    } catch {
      return null;
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este libro? Esta acción no se puede deshacer.')) return;
    setIsDeleting(true);
    try {
      const filesToDelete = [
        { path: extractPath(book.cover_url), bucket: 'library' },
        { path: extractPath(book.pdf_url), bucket: 'library' }
      ].filter(f => f.path);

      for (const file of filesToDelete) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.huaman.workers.dev'}/storage/delete?bucket=${file.bucket}&path=${encodeURIComponent(file.path!)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
        });
      }

      const { error } = await supabase
        .from('library_books')
        .delete()
        .eq('id', book.id);

      if (error) throw error;

      alert('Libro eliminado correctamente');
      onDeleted?.();
      onClose();
    } catch (err: any) {
      console.error('Error deleting book:', err);
      alert('Error al eliminar el libro: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const modal = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
        style={{
          animation: isOpen ? 'bdmFadeIn 200ms ease forwards' : 'bdmFadeOut 200ms ease forwards',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-5xl bg-bb-card border border-bb-border rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            maxHeight: '90dvh',
            animation: isOpen ? 'bdmSlideIn 250ms cubic-bezier(0.16,1,0.3,1) forwards' : 'bdmSlideOut 200ms ease forwards',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close + Admin buttons — absolute inside panel */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all border border-red-500/20"
                title="Eliminar libro"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-bb-text-secondary hover:text-bb-text transition-all border border-bb-border"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Mobile Header */}
            <div className="md:hidden pt-6 px-6 pb-2 shrink-0 border-b border-bb-border/30 bg-bb-sidebar/20">
              <div className="space-y-1 pr-20">
                {book.metadata?.collection && (
                  <span className="text-[8px] font-black text-faculty-primary uppercase tracking-[0.2em]">
                    {book.metadata.collection}
                  </span>
                )}
                <h2 className="text-lg font-serif font-black text-bb-text leading-tight uppercase">
                  {book.title}
                </h2>
                <p className="text-xs text-bb-text-secondary font-medium italic opacity-80">
                  {book.author}
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row relative">
              {/* Left Sidebar */}
              <div className="w-full md:w-[35%] bg-bb-sidebar/30 p-6 md:p-8 flex flex-col items-center border-b md:border-b-0 md:border-r border-bb-border shrink-0">
                {/* Cover */}
                <div className="w-28 h-40 md:w-56 md:h-80 rounded-2xl shadow-2xl overflow-hidden mb-6 md:mb-8 transform hover:scale-[1.02] transition-transform duration-500 ring-1 ring-white/10 shrink-0">
                  <img
                    src={book.cover_url || ''}
                    alt={book.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {/* Stats */}
                <div className="w-full space-y-5 md:space-y-6">
                  <div className="grid grid-cols-2 gap-4 pb-4 border-b border-bb-border/50">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-faculty-primary uppercase tracking-[0.2em] opacity-60">Publicación</p>
                      <p className="text-xs text-bb-text font-bold">{book.year || '2023'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-faculty-primary uppercase tracking-[0.2em] opacity-60">Extensión</p>
                      <p className="text-xs text-bb-text font-bold">{book.metadata?.pages || 'N/A'} pág.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-faculty-primary uppercase tracking-[0.2em] opacity-60">Áreas Temáticas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(book.metadata?.genres || ['General']).map((g: string) => (
                        <span key={g} className="px-2 py-0.5 rounded-md bg-faculty-primary/10 text-[9px] text-faculty-primary border border-faculty-primary/20 font-bold uppercase tracking-wider">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <p className="text-[9px] font-black text-faculty-primary uppercase tracking-[0.2em] opacity-60 mb-1">Sello Editorial</p>
                    <p className="text-[10px] text-bb-text-secondary font-bold uppercase leading-tight">{book.editorial || 'Editorial Universidad del Pacífico'}</p>
                  </div>

                  {/* Acquisition */}
                  <div className="pt-6 border-t border-bb-border/50 space-y-4">
                    <p className="text-[9px] font-black text-faculty-primary uppercase tracking-[0.2em]">Adquirir Copia</p>
                    <div className="space-y-2">
                      {book.buy_links && book.buy_links.length > 0 ? (
                        book.buy_links.map((link, i) => (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-bb-border transition-all group/link"
                          >
                            <img
                              src={getFavicon(link.url) || ''}
                              alt={link.store}
                              className="w-4 h-4 object-contain"
                            />
                            <span className="text-[10px] font-bold text-bb-text flex-1 truncate">{link.store}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-bb-text-secondary opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </a>
                        ))
                      ) : (
                        <p className="text-[9px] text-bb-text-secondary font-bold italic">No disponible para compra externa</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Main */}
              <div className="flex-1 min-w-0 bg-bb-card p-6 md:p-10 space-y-8">
                {/* Desktop Header */}
                <div className="hidden md:block space-y-3 pr-24">
                  {book.metadata?.collection && (
                    <span className="inline-block px-3 py-1 rounded-full bg-faculty-primary/10 text-[10px] font-black text-faculty-primary uppercase tracking-widest border border-faculty-primary/20">
                      {book.metadata.collection}
                    </span>
                  )}
                  <h2 className="text-2xl md:text-4xl font-serif font-black text-bb-text leading-none uppercase tracking-tighter">
                    {book.title}
                  </h2>
                  <div className="flex items-center gap-4">
                    <p className="text-xl text-bb-text-secondary font-serif italic opacity-80">
                      {book.author}
                    </p>
                    <div className="h-4 w-px bg-bb-border" />
                    <div className="flex items-center gap-1.5 text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-xs font-black text-faculty-primary tracking-widest uppercase">{book.rating || '5.0'} / 5.0</span>
                    </div>
                  </div>
                </div>

                {/* Stars for Mobile */}
                <div className="md:hidden flex items-center justify-between py-3 border-y border-bb-border/30">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < 5 ? 'fill-yellow-400 text-yellow-400' : 'text-bb-border'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-faculty-primary uppercase tracking-widest">Valoración 5/5</span>
                </div>

                {/* Synopsis */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-faculty-primary uppercase tracking-[0.3em] flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" />
                    Resumen del Libro
                  </h3>
                  <p className="text-bb-text-secondary leading-relaxed text-sm md:text-base font-medium opacity-90 text-justify">
                    {book.synopsis || 'No hay sinopsis disponible.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 md:p-8 bg-bb-sidebar border-t border-bb-border shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
            <Button
              onClick={() => setShowViewer(true)}
              className="w-full h-12 md:h-14 rounded-2xl bg-faculty-primary hover:opacity-90 text-white font-black shadow-xl shadow-faculty-primary/30 text-[10px] md:text-xs uppercase tracking-[0.2em]"
              style={{ backgroundColor: colors?.primary }}
            >
              <Download className="w-4 h-4 mr-2" />
              Visualizar Documento / PDF
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bdmFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bdmFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes bdmSlideIn { from { opacity: 0; transform: scale(0.95) translateY(12px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes bdmSlideOut{ from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.95) translateY(12px) } }
      `}</style>
    </>
  );

  return (
    <>
      {createPortal(modal, document.body)}

      <SecureFileModal
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        filePath={book.pdf_url}
        fileName={book.title}
        bucket="library"
      />
    </>
  );
};
