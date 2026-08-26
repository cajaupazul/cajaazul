'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, LoaderCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { BookDetailModal } from '@/components/library/BookDetailModal';
import { LibraryBook, supabase } from '@/lib/supabase';

export default function LibraryBookPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bookId = typeof params?.id === 'string' ? decodeURIComponent(params.id) : '';
  const [book, setBook] = useState<LibraryBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const goToLibrary = useCallback(() => {
    router.push('/dashboard/library');
  }, [router]);

  useEffect(() => {
    let ignore = false;

    const fetchBook = async () => {
      if (!bookId) {
        setError('No se pudo identificar este libro.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('library_books')
        .select('*')
        .eq('id', bookId)
        .maybeSingle();

      if (ignore) return;

      if (queryError) {
        console.error('Error fetching library book:', queryError);
        setError('No pudimos cargar la ficha del libro. Intenta nuevamente.');
      } else if (!data) {
        setError('Este libro ya no está disponible en la biblioteca.');
      } else {
        setBook(data as LibraryBook);
      }

      setLoading(false);
    };

    fetchBook();
    return () => {
      ignore = true;
    };
  }, [bookId]);

  if (loading) {
    return (
      <div className="min-h-[calc(100dvh-94px)] bg-bb-dark text-bb-text grid place-items-center px-5">
        <div className="flex flex-col items-center gap-4 text-center">
          <LoaderCircle className="h-9 w-9 animate-spin text-faculty-primary" aria-hidden="true" />
          <div>
            <p className="font-bold">Preparando la ficha del libro</p>
            <p className="mt-1 text-sm text-bb-text-secondary">Un momento, por favor.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-[calc(100dvh-94px)] bg-bb-dark text-bb-text grid place-items-center px-5">
        <section className="w-full max-w-md border border-bb-border bg-bb-card p-7 text-center rounded-xl">
          <BookOpen className="mx-auto h-9 w-9 text-bb-text-secondary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-black">Libro no disponible</h1>
          <p className="mt-2 text-sm leading-6 text-bb-text-secondary">{error}</p>
          <button
            type="button"
            onClick={goToLibrary}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-bb-border bg-bb-dark px-5 text-sm font-bold text-bb-text transition-colors hover:bg-bb-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a la biblioteca
          </button>
        </section>
      </div>
    );
  }

  return <BookDetailModal book={book} isOpen onClose={goToLibrary} />;
}
