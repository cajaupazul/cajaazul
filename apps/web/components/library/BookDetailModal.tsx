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

export const BookDetailModal: React.FC<BookDetailModalProps> = ({ book, isOpen, onClose }) => {
  const { colors } = useTheme();

  if (!book) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-bb-card border-bb-border p-0 overflow-hidden rounded-3xl shadow-2xl">
        <div className="flex flex-col md:flex-row min-h-[500px]">
          {/* Left Column - Cover & Stats */}
          <div className="w-full md:w-[35%] bg-faculty-primary/5 p-8 flex flex-col items-center border-r border-bb-border">
            <div className="w-48 h-72 rounded-xl shadow-2xl overflow-hidden mb-8 transform hover:scale-105 transition-transform duration-500">
              <img 
                src={book.cover_url || ''} 
                alt={book.title} 
                className="w-full h-full object-cover"
              />
            </div>

            <div className="w-full space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-faculty-primary uppercase tracking-widest">Fecha Publicación:</p>
                <p className="text-sm text-bb-text">{book.year || 'xx/xx/xxxx'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-faculty-primary uppercase tracking-widest">Páginas:</p>
                <p className="text-sm text-bb-text">{book.metadata?.pages || 'xxxx'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-faculty-primary uppercase tracking-widest">Colección:</p>
                <p className="text-sm text-bb-text">{book.metadata?.collection || 'Un título genial'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-faculty-primary uppercase tracking-widest">Género/Temática:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(book.metadata?.genres || ['General']).map((g: string) => (
                    <span key={g} className="px-2 py-0.5 rounded-md bg-faculty-primary/10 text-[9px] text-faculty-primary border border-faculty-primary/20">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Info & Actions */}
          <div className="flex-1 p-8 md:p-12 flex flex-col">
            <div className="space-y-6 flex-1">
              <div className="space-y-2 border-b border-bb-border pb-6">
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-bb-text tracking-tight uppercase">
                  {book.title}
                </h2>
                <p className="text-xl md:text-2xl text-bb-text-secondary font-medium italic">
                  {book.author}
                </p>
                <div className="pt-2 flex items-center gap-4">
                  <span className="text-xs font-bold text-bb-text-secondary uppercase tracking-widest">Editorial: {book.editorial || 'Desconocida'}</span>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${i < Math.floor(book.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-bb-border'}`} 
                      />
                    ))}
                    <span className="ml-2 text-sm font-bold text-faculty-primary">{book.rating}/5</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black text-faculty-primary uppercase tracking-[0.2em]">Sinopsis</h3>
                <p className="text-bb-text-secondary leading-relaxed text-sm md:text-base font-medium">
                  {book.synopsis || 'Con las plantillas de Genially podrás incluir recursos visuales para enganchar a la clase desde el minuto 1. También destacar contenidos clave para facilitar su asimilación e incluso embeber contenido externo que sorprenda y dé más contexto al tema o unidad, así como a simplificar la información para hacerla más comprensible. Somos seres visuales y nos resulta más sencillo \'leer\' imágenes, que leer un texto escrito.'}
                </p>
              </div>

              {/* Official Stores */}
              {book.buy_links && book.buy_links.length > 0 && (
                <div className="space-y-3 pt-6">
                  <h3 className="text-xs font-black text-faculty-primary uppercase tracking-[0.2em]">Comprar Oficialmente</h3>
                  <div className="flex flex-wrap gap-3">
                    {book.buy_links.map((link, i) => (
                      <a 
                        key={i} 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bb-sidebar hover:bg-bb-hover border border-bb-border transition-all text-xs font-bold text-bb-text"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-faculty-primary" />
                        {link.store}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="mt-12 flex flex-col sm:flex-row gap-4">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-xl border-2 border-faculty-primary/20 hover:bg-faculty-primary/5 text-faculty-primary font-bold"
              >
                <User className="w-4 h-4 mr-2" />
                Sobre el autor/a
              </Button>
              <Button 
                onClick={() => book.pdf_url && window.open(book.pdf_url, '_blank')}
                className="flex-1 h-12 rounded-xl bg-faculty-primary hover:opacity-90 text-white font-black shadow-lg shadow-faculty-primary/20"
                style={{ backgroundColor: colors?.primary }}
              >
                <Download className="w-4 h-4 mr-2" />
                Solicítalo (PDF)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
