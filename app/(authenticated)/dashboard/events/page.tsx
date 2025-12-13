'use client';
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Users,
  Palette,
  ArrowRight,
  Sparkles,
  Zap
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// Import PixelCanvas dynamically to avoid SSR issues with Canvas/Window
const PixelCanvas = dynamic(() => import('@/components/pixel-art/pixel-canvas'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-bb-dark flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
});

export default function EventsPage() {
  const { colors } = useTheme();
  const { profile } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isPixelArtOpen, setIsPixelArtOpen] = useState(false);

  const filters = ['Todos', 'Académicos', 'Culturales', 'Deportivos'];

  const pixelArtEvent = {
    id: 'pixel-art-2025',
    nombre: 'Pixel Art Event 2025',
    tipo: 'Cultural',
    descripcion: '¡Únete al lienzo infinito! Pinta, colabora y crea arte en tiempo real con toda la universidad. Calidad "wplace".',
    fecha: new Date(2025, 11, 15),
    lugar: 'Online - CampusLink',
    participantes: 1240,
    imagen: null,
    isSpecial: true,
  };

  const eventos = [pixelArtEvent];

  const filteredEventos = eventos.filter(evento => {
    const matchesFilter = activeFilter === 'Todos' || evento.tipo === activeFilter;
    const matchesSearch = evento.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-bb-dark p-8 relative overflow-hidden">

      {/* Pixel Art Overlay */}
      <AnimatePresence>
        {isPixelArtOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]"
          >
            <PixelCanvas
              eventId={pixelArtEvent.id}
              onClose={() => setIsPixelArtOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-5xl font-black text-bb-text mb-2 tracking-tight flex items-center gap-3">
              Eventos <span className="text-blue-400">Universitarios</span>
            </h1>
            <p className="text-bb-text-secondary text-lg">Descubre y participa en experiencias únicas.</p>
          </motion.div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold transition-all text-white bg-blue-600 hover:bg-blue-500"
          >
            <Plus className="w-6 h-6" />
            Crear Evento
          </motion.button>
        </div>

        <div className="mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-8 text-lg"
          >
            <Search className="absolute left-4 top-4 w-6 h-6 text-bb-text-secondary" />
            <input
              type="text"
              placeholder="Buscar eventos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-4 py-4 rounded-xl bg-bb-card border border-bb-border text-bb-text placeholder-bb-text-secondary focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </motion.div>

          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
            {filters.map((filter, i) => (
              <motion.button
                key={filter}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setActiveFilter(filter)}
                className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap text-sm border`}
                style={{
                  backgroundColor: activeFilter === filter ? (colors?.primary || '#3b82f6') : 'var(--bg-darker)',
                  borderColor: activeFilter === filter ? 'transparent' : 'var(--border)',
                  color: activeFilter === filter ? 'white' : 'var(--text-secondary)'
                }}
              >
                {filter}
              </motion.button>
            ))}
          </div>
        </div>

        {filteredEventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-bb-darker p-8 rounded-full mb-6">
              <Calendar className="w-16 h-16 text-bb-text-secondary" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No hay eventos por ahora</h3>
            <p className="text-gray-400 text-lg">¡Sé el primero en crear uno!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
              {filteredEventos.map((evento, index) => (
                <motion.div
                  key={evento.id}
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setIsPixelArtOpen(true)}
                  className="group block rounded-2xl overflow-hidden bg-bb-card border border-bb-border hover:border-blue-500/30 transition-all cursor-pointer relative"
                >
                  <div
                    className="h-56 relative overflow-hidden flex items-center justify-center bg-blue-600"
                  >
                    <div className="absolute inset-0 opacity-20"
                      style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                    />

                    <div className="text-center z-10">
                      <div className="bg-white/10 p-5 rounded-2xl mb-4 inline-block border border-white/10">
                        <Palette className="w-14 h-14 text-white" />
                      </div>
                      <div>
                        <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 mb-2">
                          <Zap className="w-3 h-3 mr-1" /> EN VIVO
                        </Badge>
                        <p className="text-white font-black text-2xl tracking-tight">Pixel Art Live</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 relative">
                    <div className="absolute -top-8 right-6">
                      <button className="bg-bb-text text-bb-darker p-3 rounded-full hover:scale-110 transition-transform flex items-center justify-center">
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mb-6 pt-2">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors flex-1 leading-tight">
                          {evento.nombre}
                        </h3>
                      </div>
                      <p className="text-gray-400 leading-relaxed font-medium">{evento.descripcion}</p>
                    </div>

                    <div className="space-y-3 mb-8">
                      <div className="flex items-center gap-3 text-gray-300 text-sm font-medium">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Calendar className="w-5 h-5" /></div>
                        <span>{evento.fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-300 text-sm font-medium">
                        <div className="p-2 rounded-lg bg-green-500/10 text-green-400"><Users className="w-5 h-5" /></div>
                        <span>{evento.participantes.toLocaleString()} participantes</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <span
                        className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/5"
                      >
                        {evento.tipo}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center ${className}`}>{children}</span>;
}