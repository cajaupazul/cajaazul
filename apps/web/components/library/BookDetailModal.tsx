'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Star, Download, User, ExternalLink, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme-context';
import { PDFViewerModal } from './PDFViewerModal';
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

  if (!book) return null;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  // Helper to get domain favicon
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl bg-bb-card border-bb-border p-0 overflow-hidden rounded-2xl md:rounded-3xl shadow-2xl h-[90vh] md:h-auto md:max-h-[85vh] flex flex-col">
          {/* Admin Header Actions */}
          <div className="absolute top-4 right-12 z-50 flex items-center gap-2">
            {isAdmin && (
              <Button 
                onClick={handleDelete}
                disabled={isDeleting}
                variant="ghost"
                size="icon"
                className="w-9 h-9 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all border border-red-500/20"
                title="Eliminar Libro"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            {/* Left Column - Cover & Meta */}
            <div className="w-full md:w-[35%] bg-bb-sidebar/40 p-6 md:p-8 flex flex-col items-center border-b md:border-b-0 md:border-r border-bb-border shrink-0 overflow-y-auto md:overflow-visible">
              <div className="w-32 h-44 md:w-56 md:h-80 rounded-xl shadow-2xl overflow-hidden mb-6 md:mb-8 transform hover:scale-[1.02] transition-transform duration-500 ring-1 ring-white/10 shrink-0">
                <img 
                  src={book.cover_url || ''} 
                  alt={book.title} 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-full space-y-4 md:space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-faculty-primary uppercase tracking-widest opacity-70">Fecha:</p>
                    <p className="text-sm text-bb-text font-bold">{book.year || '2023'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-faculty-primary uppercase tracking-widest opacity-70">Páginas:</p>
                    <p className="text-sm text-bb-text font-bold">{book.metadata?.pages || 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-faculty-primary uppercase tracking-widest opacity-70">Temática:</p>
                  <div className="flex flex-wrap gap-2">
                    {(book.metadata?.genres || ['General']).map((g: string) => (
                      <span key={g} className="px-2.5 py-1 rounded-lg bg-faculty-primary/10 text-[10px] text-faculty-primary border border-faculty-primary/20 font-bold">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-bb-border/50">
                  <p className="text-[10px] font-black text-faculty-primary uppercase tracking-widest opacity-70 mb-2">Editorial:</p>
                  <p className="text-xs text-bb-text-secondary font-bold uppercase">{book.editorial || 'Editorial Universidad del Pacífico'}</p>
                </div>
              </div>
            </div>

            {/* Right Column - Main Info */}
            <div className="flex-1 flex flex-col min-w-0 bg-bb-card">
              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scrollbar-hide">
                {/* Header Info */}
                <div className="space-y-3">
                  {book.metadata?.collection && (
                    <span className="inline-block px-3 py-1 rounded-full bg-faculty-primary text-[10px] font-black text-white uppercase tracking-widest">
                      {book.metadata.collection}
                    </span>
                  )}
                  <h2 className="text-2xl md:text-4xl font-serif font-black text-bb-text leading-[1.1] uppercase tracking-tight">
                    {book.title}
                  </h2>
                  <div className="flex items-center gap-4">
                    <p className="text-lg md:text-xl text-bb-text-secondary font-serif italic opacity-80">
                      {book.author}
                    </p>
                    <div className="h-4 w-px bg-bb-border" />
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-xs font-black text-faculty-primary ml-1">{book.rating || '5.0'}/5</span>
                    </div>
                  </div>
                </div>

                {/* Synopsis */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-faculty-primary uppercase tracking-[0.3em] flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" />
                    Sinopsis
                  </h3>
                  <p className="text-bb-text-secondary leading-relaxed text-sm md:text-base font-medium opacity-90 text-justify">
                    {book.synopsis || 'No hay sinopsis disponible.'}
                  </p>
                </div>

                {/* Buy Links */}
                {(book.buy_links && book.buy_links.length > 0) ? (
                  <div className="space-y-4 pt-4">
                    <h3 className="text-[10px] font-black text-faculty-primary uppercase tracking-[0.3em]">Adquirir Copia Física / Digital</h3>
                    <div className="flex flex-wrap gap-3">
                      {book.buy_links.map((link, i) => (
                        <a 
                          key={i} 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-bb-sidebar hover:bg-bb-hover border border-bb-border transition-all text-xs font-bold text-bb-text group/link shadow-sm"
                        >
                          <div className="w-6 h-6 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center p-1">
                            <img 
                              src={getFavicon(link.url) || ''} 
                              alt={link.store}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] text-faculty-primary uppercase font-black opacity-60">Tienda Oficial</span>
                            <span className="text-xs">{link.store}</span>
                          </div>
                          <ExternalLink className="w-3 h-3 text-bb-text-secondary group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Fallback if links are empty but we want to show something */
                  <div className="p-4 rounded-xl bg-bb-sidebar/30 border border-dashed border-bb-border">
                    <p className="text-[10px] text-bb-text-secondary font-bold uppercase tracking-widest text-center">Información de compra no disponible</p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="p-6 md:p-8 bg-bb-sidebar/30 border-t border-bb-border flex flex-col sm:flex-row gap-4 shrink-0">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 md:h-14 rounded-xl border-bb-border hover:bg-bb-hover text-bb-text-secondary font-bold text-xs md:text-sm uppercase tracking-widest"
                >
                  <User className="w-4 h-4 mr-2" />
                  Biografía Autor
                </Button>
                <Button 
                  onClick={() => setShowViewer(true)}
                  className="flex-[1.5] h-12 md:h-14 rounded-xl bg-faculty-primary hover:opacity-90 text-white font-black shadow-lg shadow-faculty-primary/20 text-xs md:text-sm uppercase tracking-widest"
                  style={{ backgroundColor: colors?.primary }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Leer Libro Online / PDF
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PDFViewerModal 
        isOpen={showViewer} 
        onClose={() => setShowViewer(false)} 
        url={book.pdf_url} 
        title={book.title} 
      />
    </>
  );
};
