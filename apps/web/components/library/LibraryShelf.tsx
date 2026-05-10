'use client';

import React from 'react';
import { LibraryBook } from '@/lib/supabase';
import { BookItem } from './BookItem';

interface LibraryShelfProps {
  books: LibraryBook[];
  onBookClick: (book: LibraryBook) => void;
}

export const LibraryShelf: React.FC<LibraryShelfProps> = ({ books, onBookClick }) => {
  // Group books by rows of 6 (standard shelf capacity)
  const rows = [];
  for (let i = 0; i < books.length; i += 6) {
    rows.push(books.slice(i, i + 6));
  }

  return (
    <div className="w-full space-y-16 py-8 px-4">
      {rows.length > 0 ? (
        rows.map((row, rowIndex) => (
          <div key={rowIndex} className="relative group">
            {/* Books Container */}
            <div className="flex flex-wrap justify-center gap-6 sm:gap-12 pb-2 relative z-10">
              {row.map((book) => (
                <BookItem key={book.id} book={book} onClick={onBookClick} />
              ))}
            </div>

            {/* Shelf Structure (The wooden part) */}
            <div className="relative mt-[-20px] h-12 w-full">
              {/* Top Surface */}
              <div className="absolute top-0 left-0 right-0 h-6 bg-[#f5e6d3] border-b border-[#d4c3a3] rounded-t-sm shadow-inner" />
              {/* Front Face */}
              <div className="absolute top-6 left-0 right-0 h-6 bg-[#e0ccae] border-t border-[#f5e6d3] shadow-lg flex items-center justify-center">
                 {/* Optional shadow/texture */}
                 <div className="w-full h-full bg-black/5" />
              </div>
              {/* Side shadows */}
              <div className="absolute -left-2 top-0 bottom-0 w-2 bg-[#d4c3a3] -skew-y-45 origin-right" />
              <div className="absolute -right-2 top-0 bottom-0 w-2 bg-[#d4c3a3] skew-y-45 origin-left" />
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-bb-text-secondary opacity-50">
          <p className="text-xl font-bold">No hay libros disponibles en este momento</p>
          <p className="text-sm">Pronto añadiremos nuevo contenido importante.</p>
        </div>
      )}
    </div>
  );
};
