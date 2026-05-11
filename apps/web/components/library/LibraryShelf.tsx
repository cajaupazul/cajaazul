'use client';

import React from 'react';
import { LibraryBook } from '@/lib/supabase';
import { BookItem } from './BookItem';

interface LibraryShelfProps {
  books: LibraryBook[];
  onBookClick: (book: LibraryBook) => void;
}

export const LibraryShelf: React.FC<LibraryShelfProps> = ({ books, onBookClick }) => {
  const [itemsPerRow, setItemsPerRow] = React.useState(6);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) setItemsPerRow(2);
      else if (window.innerWidth < 1024) setItemsPerRow(4);
      else setItemsPerRow(6);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Group books by rows based on itemsPerRow
  const rows = [];
  for (let i = 0; i < books.length; i += itemsPerRow) {
    rows.push(books.slice(i, i + itemsPerRow));
  }

  return (
    <div className="w-full space-y-16 md:space-y-24 py-8 px-4 md:px-8">
      {rows.length > 0 ? (
        rows.map((row, rowIndex) => (
          <div key={rowIndex} className="relative group max-w-6xl mx-auto">
            {/* Books Container */}
            <div 
              className="grid gap-6 md:gap-12 pb-2 relative z-10"
              style={{ 
                gridTemplateColumns: `repeat(${itemsPerRow}, minmax(0, 1fr))`,
                justifyItems: 'center'
              }}
            >
              {row.map((book) => (
                <div key={book.id} className="w-full flex justify-center">
                  <BookItem book={book} onClick={onBookClick} />
                </div>
              ))}
            </div>

            {/* Shelf Structure (The wooden part) */}
            <div className="relative mt-[-15px] md:mt-[-20px] h-10 md:h-12 w-full px-2">
              {/* Top Surface */}
              <div className="absolute top-0 left-0 right-0 h-5 md:h-6 bg-[#f5e6d3] border-b border-[#d4c3a3] rounded-t-sm shadow-inner" />
              {/* Front Face */}
              <div className="absolute top-5 md:top-6 left-0 right-0 h-5 md:h-6 bg-[#e0ccae] border-t border-[#f5e6d3] shadow-lg flex items-center justify-center">
                 <div className="w-full h-full bg-black/5" />
              </div>
              {/* Side shadows */}
              <div className="absolute -left-1 md:-left-2 top-0 bottom-0 w-1 md:w-2 bg-[#d4c3a3] -skew-y-45 origin-right" />
              <div className="absolute -right-1 md:-right-2 top-0 bottom-0 w-1 md:w-2 bg-[#d4c3a3] skew-y-45 origin-left" />
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
