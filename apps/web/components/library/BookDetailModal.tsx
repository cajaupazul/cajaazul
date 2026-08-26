'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  ExternalLink,
  FileText,
  Library,
  ShoppingBag,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import SecureFileModal from '@/components/secure/SecureFileModal';
import { useProfile } from '@/lib/profile-context';
import { supabase, LibraryBook } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import styles from './BookDetailModal.module.css';

interface BookDetailModalProps {
  book: LibraryBook | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  onDeleted,
}) => {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const [showViewer, setShowViewer] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showViewer) onClose();
    };

    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, showViewer]);

  if (!book || !isOpen) return null;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const accentColor = colors?.primary || '#2563eb';
  const rating = Math.min(5, Math.max(0, Number(book.rating) || 0));
  const pages = book.metadata?.pages;
  const genres = Array.isArray(book.metadata?.genres)
    ? book.metadata.genres.filter((genre: unknown): genre is string => typeof genre === 'string' && genre.trim().length > 0)
    : [];

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
      const urlObject = new URL(url);
      return urlObject.searchParams.get('path');
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
        { path: extractPath(book.pdf_url), bucket: 'library' },
      ].filter((file) => file.path);

      for (const file of filesToDelete) {
        const session = await supabase.auth.getSession();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.cajaupazul.workers.dev'}/storage/delete?bucket=${file.bucket}&path=${encodeURIComponent(file.path!)}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${session.data.session?.access_token}`,
            },
          },
        );
        if (!response.ok && response.status !== 404) {
          throw new Error(`No se pudo eliminar un archivo del libro (${response.status}).`);
        }
      }

      const { error } = await supabase.from('library_books').delete().eq('id', book.id);
      if (error) throw error;

      alert('Libro eliminado correctamente');
      onDeleted?.();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado';
      console.error('Error deleting book:', error);
      alert(`Error al eliminar el libro: ${message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const pageContent = (
    <div
      className={styles.dialog}
      role="region"
      aria-labelledby="book-detail-title"
      style={{ '--book-accent': accentColor } as React.CSSProperties}
    >
      <header className={styles.header}>
        <button type="button" onClick={onClose} className={styles.backButton}>
          <ArrowLeft aria-hidden="true" />
          <span className={styles.backLong}>Volver a la biblioteca</span>
          <span className={styles.backShort}>Biblioteca</span>
        </button>

        <div className={styles.breadcrumb} aria-hidden="true">
          <span>Biblioteca digital</span>
          <span className={styles.breadcrumbSeparator}>/</span>
          <strong>{book.title}</strong>
        </div>

        <div className={styles.headerActions}>
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className={styles.deleteButton}
              title="Eliminar libro de la biblioteca"
            >
              <Trash2 aria-hidden="true" />
              <span>{isDeleting ? 'Eliminando…' : 'Eliminar'}</span>
            </button>
          )}
          <button type="button" onClick={onClose} className={styles.closeButton} title="Cerrar">
            <span className="sr-only">Cerrar</span>
            <X aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.ambientCover} aria-hidden="true">
          {book.cover_url && <img src={book.cover_url} alt="" />}
          <span />
        </div>

        <section className={styles.bookLayout}>
          <aside className={styles.sidebar} aria-label="Portada y ficha del libro">
            <div className={styles.cover}>
              {book.cover_url ? (
                <img src={book.cover_url} alt={`Portada de ${book.title}`} />
              ) : (
                <div className={styles.coverFallback}>
                  <BookOpen aria-hidden="true" />
                  <span>Sin portada</span>
                </div>
              )}
            </div>

            <section className={styles.authorCard} aria-labelledby="book-author-heading">
              <span className={styles.sideLabel}>Autor</span>
              <div className={styles.authorIdentity}>
                <span className={styles.authorIcon}><UserRound aria-hidden="true" /></span>
                <div>
                  <h2 id="book-author-heading">{book.author || 'Autor no especificado'}</h2>
                  <p>{book.editorial || 'Editorial no indicada'}</p>
                </div>
              </div>
            </section>

            {book.buy_links && book.buy_links.length > 0 && (
              <section className={styles.purchaseCard} aria-labelledby="purchase-heading">
                <span className={styles.sideLabel}>Leer o comprar</span>
                <h2 id="purchase-heading">Ediciones oficiales</h2>
                <div className={styles.externalLinks}>
                  {book.buy_links.map((link, index) => {
                    const favicon = getFavicon(link.url);
                    return (
                      <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer">
                        <span className={styles.storeIdentity}>
                          {favicon ? <img src={favicon} alt="" /> : <ShoppingBag aria-hidden="true" />}
                          <span>{link.store}</span>
                        </span>
                        <ExternalLink aria-hidden="true" />
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            <dl className={styles.quickFacts}>
              <div>
                <Calendar aria-hidden="true" />
                <dt>Año</dt>
                <dd>{book.year || 'Sin fecha'}</dd>
              </div>
              <div>
                <FileText aria-hidden="true" />
                <dt>Extensión</dt>
                <dd>{pages ? `${pages} págs.` : 'No indicada'}</dd>
              </div>
            </dl>
          </aside>

          <div className={styles.contentColumn}>
            <section className={styles.heroInformation}>
              <div className={styles.kickerRow}>
                <span className={styles.kicker}><Library aria-hidden="true" /> {book.metadata?.collection || 'Biblioteca CampusLink'}</span>
                <span className={styles.availability}>
                  <span aria-hidden="true" />
                  Disponible para lectura
                </span>
              </div>

              <h1 id="book-detail-title" className={styles.title}>{book.title}</h1>
              <p className={styles.heroAuthor}>por <strong>{book.author || 'Autor no especificado'}</strong></p>
            </section>

            <section className={styles.informationBar} aria-label="Acciones y calificación">
              <div className={styles.heroActions}>
                <button
                  type="button"
                  onClick={() => setShowViewer(true)}
                  disabled={!book.pdf_url}
                  className={styles.readButton}
                >
                  <BookOpen aria-hidden="true" />
                  <span>{book.pdf_url ? 'Comenzar a leer' : 'Documento no disponible'}</span>
                </button>

                <div className={styles.rating} aria-label={`Calificación: ${rating} de 5`}>
                  <div className={styles.stars} aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} className={index < Math.floor(rating) ? styles.starActive : styles.starInactive} />
                    ))}
                  </div>
                  <strong>{rating.toFixed(1)}</strong>
                  <span>/ 5</span>
                </div>
              </div>

              {genres.length > 0 && (
                <div className={styles.topics}>
                  {genres.map((genre) => <span key={genre}>{genre}</span>)}
                </div>
              )}
            </section>

            <section className={styles.synopsis} aria-labelledby="book-summary-heading">
              <span className={styles.sectionLabel}>Sobre esta publicación</span>
              <h2 id="book-summary-heading">De qué trata</h2>
              <p>{book.synopsis || 'Este libro todavía no tiene una descripción disponible.'}</p>
            </section>

            <section className={styles.publicationDetails} aria-labelledby="publication-details-heading">
              <div className={styles.detailsHeading}>
                <span className={styles.sectionLabel}>Ficha bibliográfica</span>
                <h2 id="publication-details-heading">Información de la edición</h2>
              </div>
              <dl>
                <div>
                  <dt><Calendar aria-hidden="true" /> Publicación</dt>
                  <dd>{book.year || 'No indicada'}</dd>
                </div>
                <div>
                  <dt><FileText aria-hidden="true" /> Extensión</dt>
                  <dd>{pages ? `${pages} páginas` : 'No indicada'}</dd>
                </div>
                <div>
                  <dt><Building2 aria-hidden="true" /> Editorial</dt>
                  <dd>{book.editorial || 'No indicada'}</dd>
                </div>
              </dl>
            </section>
          </div>
        </section>
      </main>

      <SecureFileModal
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        filePath={book.pdf_url}
        fileName={book.title}
        bucket="library"
      />
    </div>
  );

  return pageContent;
};
