'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LibraryBook } from '@/lib/supabase';

interface BookItemProps {
  book: LibraryBook;
  onClick: (book: LibraryBook) => void;
}

export const BookItem: React.FC<BookItemProps> = ({ book, onClick }) => {
  return (
    <motion.div
      whileHover={{ 
        y: -20, 
        rotateY: -15,
        scale: 1.05,
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      onClick={() => onClick(book)}
      className="relative cursor-pointer group"
      style={{ perspective: '1000px' }}
    >
      {/* Book Shadow */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-black/40 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Book Cover */}
      <div className="relative w-32 h-48 sm:w-40 sm:h-60 rounded-r-lg shadow-2xl overflow-hidden border-l-4 border-black/20 bg-bb-card">
        {book.cover_url ? (
          <img 
            src={book.cover_url} 
            alt={book.title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bb-card to-bb-hover p-4 text-center">
            <span className="text-[10px] font-bold text-bb-text-secondary uppercase">{book.title}</span>
          </div>
        )}
        
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      {/* Book Spine Detail (Visual only) */}
      <div className="absolute top-0 left-0 bottom-0 w-1 bg-white/10" />
    </motion.div>
  );
};
