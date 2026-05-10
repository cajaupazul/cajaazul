'use client';

import React, { useState, useEffect } from 'react';
import { supabase, LibraryBook } from '@/lib/supabase';
import { LibraryShelf } from '@/components/library/LibraryShelf';
import { BookDetailModal } from '@/components/library/BookDetailModal';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function LibraryPage() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('library_books')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBooks(data);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-full bg-bb-dark">
      {/* Hero Header */}
      <div className="relative h-64 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-faculty-primary/20 to-transparent" />
        <div className="relative z-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter uppercase mb-2"
          >
            Biblioteca Digital
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-bb-text-secondary text-sm md:text-base tracking-[0.3em] uppercase font-bold"
          >
            Recursos académicos y lectura esencial
          </motion.p>
          
          {/* Admin Action */}
          {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-8"
            >
              <Link href="/admin/library">
                <button 
                  className="px-8 py-3 rounded-2xl bg-white text-bb-dark font-black uppercase text-xs tracking-widest shadow-xl shadow-white/10 hover:scale-105 transition-all flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Añadir nuevo libro
                </button>
              </Link>
            </motion.div>
          )}
        </div>
      </div>

      {/* Library Content */}
      <div className="max-w-7xl mx-auto pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-white/10 border-t-faculty-primary rounded-full animate-spin" style={{ borderTopColor: colors?.primary }} />
            <p className="text-bb-text-secondary animate-pulse text-sm font-bold tracking-widest uppercase">Ordenando estanterías...</p>
          </div>
        ) : (
          <LibraryShelf books={books} onBookClick={(book) => setSelectedBook(book)} />
        )}
      </div>

      <BookDetailModal 
        book={selectedBook} 
        isOpen={!!selectedBook} 
        onClose={() => setSelectedBook(null)} 
      />
    </div>
  );
}
