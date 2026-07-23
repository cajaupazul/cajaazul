'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, Download, ExternalLink, Trash2, ArrowLeft, BookOpen, Calendar, FileText, Building2, CheckCircle2, Bookmark } from 'lucide-react';
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
  const [showViewer, setShowViewer] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  if (!book || !mounted || !isOpen) return null;

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
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.cajaupazul.workers.dev'}/storage/delete?bucket=${file.bucket}&path=${encodeURIComponent(file.path!)}`, {
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

  const primaryBgColor = colors?.primary || '#10b981';

  const pageContent = (
    <div className="fixed inset-0 z-[200] bg-[#0b1120] text-slate-100 overflow-y-auto animate-in fade-in duration-200">
      
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#0b1120]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-4 flex items-center justify-between">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-slate-200 hover:text-white transition-all group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Volver a la Biblioteca</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
          <span>Biblioteca Digital</span>
          <span>/</span>
          <span className="text-white font-bold truncate max-w-xs">{book.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all border border-red-500/20 text-xs font-bold"
              title="Eliminar libro de la biblioteca"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Eliminar</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
            title="Cerrar"
          >
            <span className="sr-only">Cerrar</span>
            ✕
          </button>
        </div>
      </header>

      {/* Main Full Page Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-12">
        
        {/* Top Hero Layout: Cover + Information */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
          
          {/* Left Column: Book Cover with Ribbon badge & Shadow */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="relative group w-56 sm:w-64 md:w-72 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/10 border border-white/15 bg-slate-900 transition-transform duration-500 hover:scale-[1.02]">
              <img
                src={book.cover_url || ''}
                alt={book.title}
                className="w-full h-full object-cover"
              />

              {/* Bookmark Ribbon */}
              <div className="absolute top-4 right-4 bg-emerald-500 text-white p-2 rounded-xl shadow-lg flex items-center justify-center">
                <Bookmark className="w-5 h-5 fill-current" />
              </div>
            </div>

            {/* Quick Badges below cover */}
            <div className="mt-6 flex flex-wrap justify-center gap-2 w-full max-w-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>{book.year || '2023'}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>{book.metadata?.pages || 'N/A'} págs.</span>
              </div>
            </div>
          </div>

          {/* Right Column: Title, Rating, Badges & CTA */}
          <div className="md:col-span-7 space-y-6">
            
            {/* Category / Collection Tag */}
            {book.metadata?.collection && (
              <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-extrabold uppercase tracking-widest border border-emerald-500/20">
                {book.metadata.collection}
              </span>
            )}

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white font-serif tracking-tight leading-tight">
              {book.title}
            </h1>

            {/* Author */}
            <p className="text-lg sm:text-xl text-slate-300 font-medium">
              por <span className="text-white font-semibold">{book.author}</span>
            </p>

            {/* Rating & Availability Status Pill */}
            <div className="flex flex-wrap items-center gap-4 py-2 border-y border-white/10">
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < Math.floor(parseFloat(String(book.rating ?? 5))) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`}
                  />
                ))}
                <span className="ml-1.5 text-sm font-bold text-amber-400">{book.rating ?? '5.0'}</span>
              </div>

              <div className="h-4 w-px bg-white/10 hidden sm:block" />

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Disponible para lectura</span>
              </div>
            </div>

            {/* Tags / Genres */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Áreas Temáticas</span>
              <div className="flex flex-wrap gap-2">
                {(book.metadata?.genres || ['General']).map((g: string) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 font-semibold"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* CTA Main Action Button (Inspired by Image 1 "Take it" green button style) */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Button
                onClick={() => setShowViewer(true)}
                className="h-14 px-8 rounded-2xl text-white font-extrabold text-sm uppercase tracking-wider shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                style={{ backgroundColor: primaryBgColor }}
              >
                <BookOpen className="w-5 h-5" />
                <span>Visualizar Documento / Leer PDF</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-white/10" />

        {/* Book Synopsis Section (Spacious layout) */}
        <section className="space-y-4 max-w-4xl">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span>Resumen del Libro</span>
          </h2>
          <p className="text-slate-300 leading-relaxed text-base sm:text-lg font-normal text-justify">
            {book.synopsis || 'No hay sinopsis disponible para este libro.'}
          </p>
        </section>

        {/* Metadata Details Cards Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Año de Publicación</span>
            </div>
            <p className="text-lg font-bold text-white">{book.year || '2023'}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Extensión</span>
            </div>
            <p className="text-lg font-bold text-white">{book.metadata?.pages ? `${book.metadata.pages} páginas` : 'N/A'}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-purple-400" />
              <span>Sello Editorial</span>
            </div>
            <p className="text-base font-bold text-white truncate">{book.editorial || 'Editorial Universidad del Pacífico'}</p>
          </div>
        </section>

        {/* Buy / External Links (if available) */}
        {book.buy_links && book.buy_links.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Adquirir Copia Externa</h3>
            <div className="flex flex-wrap gap-3">
              {book.buy_links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-white transition-all"
                >
                  {getFavicon(link.url) && (
                    <img src={getFavicon(link.url)!} alt="" className="w-4 h-4 object-contain" />
                  )}
                  <span>{link.store}</span>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* PDF Viewer */}
      <SecureFileModal
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        filePath={book.pdf_url}
        fileName={book.title}
        bucket="library"
      />
    </div>
  );

  return createPortal(pageContent, document.body);
};
