'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LibraryBook } from '@/lib/supabase';
import { Star, ExternalLink, Download, User, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme-context';

interface BookDetailModalProps {
  book: LibraryBook | null;
  isOpen: boolean;
  onClose: () => void;
}

import { Star, Download, User, ExternalLink, Trash2 } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { PDFViewerModal } from './PDFViewerModal';
import { useProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

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
    const toastId = toast.loading('Eliminando libro...');

    try {
      // 1. Delete from R2 (Cover and PDF)
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

      // 2. Delete from DB
      const { error } = await supabase
        .from('library_books')
        .delete()
        .eq('id', book.id);

      if (error) throw error;

      toast.success('Libro eliminado correctamente', { id: toastId });
      onDeleted?.();
      onClose();
    } catch (err: any) {
      console.error('Error deleting book:', err);
      toast.error('Error al eliminar el libro: ' + err.message, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl bg-bb-card border-bb-border p-0 overflow-hidden rounded-2xl md:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col">
          <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-visible">
            {/* Left Column - Cover & Stats */}
            <div className="w-full md:w-[35%] bg-faculty-primary/5 p-6 md:p-8 flex flex-col items-center border-b md:border-b-0 md:border-r border-bb-border">
              <div className="w-32 h-48 md:w-48 md:h-72 rounded-xl shadow-2xl overflow-hidden mb-6 md:mb-8 transform hover:scale-105 transition-transform duration-500 shrink-0">
                <img 
                  src={book.cover_url || ''} 
                  alt={book.title} 
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-full space-y-3 md:space-y-4">
                <div className="space-y-0.5 md:space-y-1">
                  <p className="text-[9px] md:text-[10px] font-black text-faculty-primary uppercase tracking-widest">Fecha Publicación:</p>
                  <p className="text-xs md:text-sm text-bb-text">{book.year || 'N/A'}</p>
                </div>
                <div className="space-y-0.5 md:space-y-1">
                  <p className="text-[9px] md:text-[10px] font-black text-faculty-primary uppercase tracking-widest">Páginas:</p>
                  <p className="text-xs md:text-sm text-bb-text">{book.metadata?.pages || 'N/A'}</p>
                </div>
                <div className="space-y-0.5 md:space-y-1">
                  <p className="text-[9px] md:text-[10px] font-black text-faculty-primary uppercase tracking-widest">Género/Temática:</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(book.metadata?.genres || ['General']).map((g: string) => (
                      <span key={g} className="px-2 py-0.5 rounded-md bg-faculty-primary/10 text-[8px] md:text-[9px] text-faculty-primary border border-faculty-primary/20">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Admin Delete Action */}
                {isAdmin && (
                  <div className="pt-6 w-full">
                    <Button 
                      onClick={handleDelete}
                      disabled={isDeleting}
                      variant="destructive"
                      className="w-full h-10 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 text-[10px] font-bold uppercase tracking-widest"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      {isDeleting ? 'Eliminando...' : 'Eliminar Libro'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Info & Actions */}
            <div className="flex-1 p-6 md:p-10 flex flex-col min-h-0">
              <div className="space-y-5 md:space-y-6 flex-1 overflow-y-auto md:overflow-visible pr-1">
                <div className="space-y-1 md:space-y-2 border-b border-bb-border pb-4 md:pb-6">
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-bb-text tracking-tight uppercase leading-tight">
                    {book.title}
                  </h2>
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                    <p className="text-lg md:text-xl text-bb-text-secondary font-medium italic">
                      {book.author}
                    </p>
                    {book.metadata?.collection && (
                      <span className="text-[10px] text-faculty-primary/60 font-bold uppercase tracking-wider">
                        • {book.metadata.collection}
                      </span>
                    )}
                  </div>
                  <div className="pt-2 flex flex-wrap items-center gap-3 md:gap-4">
                    <span className="text-[10px] font-bold text-bb-text-secondary uppercase tracking-widest">Editorial: {book.editorial || 'Desconocida'}</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-3.5 h-3.5 ${i < Math.floor(book.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-bb-border'}`} 
                        />
                      ))}
                      <span className="ml-1.5 text-xs font-bold text-faculty-primary">{book.rating}/5</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 md:space-y-3">
                  <h3 className="text-[10px] font-black text-faculty-primary uppercase tracking-[0.2em]">Sinopsis</h3>
                  <p className="text-bb-text-secondary leading-relaxed text-sm font-medium">
                    {book.synopsis || 'No hay sinopsis disponible.'}
                  </p>
                </div>

                {/* Official Stores */}
                {book.buy_links && book.buy_links.length > 0 && (
                  <div className="space-y-3 pt-4 md:pt-6">
                    <h3 className="text-[10px] font-black text-faculty-primary uppercase tracking-[0.2em]">Donde Comprar</h3>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      {book.buy_links.map((link, i) => (
                        <a 
                          key={i} 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 px-3 md:px-4 py-2 rounded-xl bg-bb-sidebar/50 hover:bg-bb-hover border border-bb-border transition-all text-xs font-bold text-bb-text group/link"
                        >
                          <div className="w-5 h-5 rounded-md overflow-hidden bg-white/10 flex items-center justify-center p-0.5">
                            <img 
                              src={getFavicon(link.url) || ''} 
                              alt={link.store}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?domain=example.com';
                              }}
                            />
                          </div>
                          {link.store}
                          <ExternalLink className="w-3 h-3 text-bb-text-secondary group-hover/link:text-faculty-primary transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 md:gap-4 border-t border-bb-border pt-6 md:pt-8">
                <Button 
                  variant="outline" 
                  className="flex-1 h-11 md:h-12 rounded-xl border-2 border-faculty-primary/20 hover:bg-faculty-primary/5 text-faculty-primary font-bold text-xs md:text-sm"
                >
                  <User className="w-4 h-4 mr-2" />
                  Sobre el autor/a
                </Button>
                <Button 
                  onClick={() => setShowViewer(true)}
                  className="flex-1 h-11 md:h-12 rounded-xl bg-faculty-primary hover:opacity-90 text-white font-black shadow-lg shadow-faculty-primary/20 text-xs md:text-sm"
                  style={{ backgroundColor: colors?.primary }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Leer Libro / PDF
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
