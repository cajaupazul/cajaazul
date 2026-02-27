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
  Zap,
  Pencil,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
// Dynamically import CreateEventModal to reduce initial bundle size and avoid SSR issues
const CreateEventModal = dynamic(() => import('@/components/events/create-event-modal'), {
  ssr: false,
  loading: () => null,
});
import { supabase } from '@/lib/supabase';

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

  // Admin / Event Management State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [dbEvents, setDbEvents] = useState<any[]>([]);

  const filters = ['Todos', 'Académicos', 'Culturales', 'Deportivos'];

  // Fetch events from DB + fallback to hardcoded pixel art if missing
  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('fecha_inicio', { ascending: true });

    if (data) {
      setDbEvents(data);
    }
  };

  const handleToggleVisibility = async (event: any) => {
    const newStatus = !event.is_active;
    const { error } = await supabase
      .from('events')
      .update({ is_active: newStatus })
      .eq('id', event.id);

    if (!error) {
      setDbEvents(prev => prev.map(e => e.id === event.id ? { ...e, is_active: newStatus } : e));
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleEditEvent = (event: any) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  // Combine DB events with fallback if DB is empty or doesn't have pixel art
  // Ideally, migration should have inserted it.
  const displayEvents = dbEvents.length > 0 ? dbEvents : [{
    id: 'a0000000-0000-0000-0000-000000002025',
    nombre: 'Pixel Art Event 2025', // Fallback display name logic needs to match DB column 'titulo'
    titulo: 'Pixel Art Event 2025',
    tipo: 'Cultural',
    descripcion: '¡Únete al lienzo infinito! Pinta, colabora y crea arte en tiempo real con toda la universidad. Calidad "wplace".',
    fecha_inicio: new Date(2025, 11, 15).toISOString(),
    lugar: 'Online - CampusLink',
    participantes: 1240,
    imagen_url: null,
    metadata: { is_pixel_art: true }
  }];

  const filteredEventos = displayEvents.filter(evento => {
    // Non-admins only see active events
    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
    if (!isAdmin && evento.is_active === false) return false;

    const matchesFilter = activeFilter === 'Todos' || evento.tipo === activeFilter;
    const matchesSearch = (evento.titulo || evento.nombre).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pixelArtId = displayEvents.find(e => e.metadata?.is_pixel_art)?.id || 'a0000000-0000-0000-0000-000000002025';

  return (
    <div className="min-h-screen bg-bb-dark p-4 md:p-8 relative overflow-hidden">

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
              eventId={pixelArtId}
              onClose={() => setIsPixelArtOpen(false)}
              userProfile={profile}
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
            <h1 className="text-3xl md:text-5xl font-black text-bb-text mb-2 tracking-tight flex items-center gap-2 md:gap-3 leading-tight">
              Eventos <span className="text-blue-400">Universitarios</span>
            </h1>
            <p className="text-bb-text-secondary text-sm md:text-lg">Descubre y participa en experiencias únicas.</p>
          </motion.div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold transition-all text-white bg-blue-600 hover:bg-blue-500 w-full md:w-auto justify-center"
          >
            <Plus className="w-5 h-5 md:w-6 md:h-6" />
            Crear Evento
          </motion.button>
        </div>

        <div className="mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-6 md:mb-8 text-base md:text-lg"
          >
            <Search className="absolute left-4 top-3.5 md:top-4 w-5 h-5 md:w-6 md:h-6 text-bb-text-secondary" />
            <input
              type="text"
              placeholder="Buscar eventos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 md:pl-14 pr-4 py-3 md:py-4 rounded-xl bg-bb-card border border-bb-border text-bb-text placeholder-bb-text-secondary focus:outline-none focus:border-blue-500/50 transition-all"
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
          <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center">
            <div className="bg-bb-darker p-6 md:p-8 rounded-full mb-4 md:mb-6">
              <Calendar className="w-12 h-12 md:w-16 md:h-16 text-bb-text-secondary" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">No hay eventos por ahora</h3>
            <p className="text-gray-400 text-sm md:text-lg">¡Sé el primero en crear uno!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
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
                    className={cn(
                      "h-32 md:h-56 relative overflow-hidden flex items-center justify-center bg-blue-600",
                      evento.is_active === false && "grayscale opacity-60"
                    )}
                  >
                    <div className="absolute inset-0 opacity-20"
                      style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                    />

                    {/* Visibility Badge for Admin */}
                    {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                      <div className="absolute top-3 left-3 z-10">
                        {evento.is_active === false ? (
                          <Badge className="bg-red-500/20 text-red-100 border border-red-500/30 backdrop-blur-md">
                            <EyeOff className="w-3 h-3 mr-1" /> OCULTO
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-100 border border-green-500/30 backdrop-blur-md">
                            <Eye className="w-3 h-3 mr-1" /> VISIBLE
                          </Badge>
                        )}
                      </div>
                    )}

                    {evento.imagen_url ? (
                      <img src={supabase.storage.from('r2-images').getPublicUrl(evento.imagen_url).data.publicUrl} alt={evento.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center z-10 p-2">
                        <div className="bg-white/10 p-2 md:p-4 rounded-xl md:rounded-2xl mb-2 md:mb-4 inline-block border border-white/10">
                          <Palette className="w-8 h-8 md:w-14 md:h-14 text-white" />
                        </div>
                        <div>
                          {evento.metadata?.is_pixel_art && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 mb-1 md:mb-2 text-[8px] md:text-xs">
                              <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" /> EN VIVO
                            </Badge>
                          )}
                          <p className="text-white font-black text-sm md:text-2xl tracking-tight">{evento.titulo}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 md:p-6 relative">
                    <div className="absolute -top-6 md:-top-8 right-3 md:right-6">
                      <button className="bg-bb-text text-bb-darker p-2 md:p-3 rounded-full hover:scale-110 transition-transform flex items-center justify-center shadow-lg">
                        <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>

                    <div className="mb-4 md:mb-6 pt-1 md:pt-2">
                      <div className="flex items-start justify-between mb-2 md:mb-3">
                        <h3 className="text-sm md:text-2xl font-bold text-white group-hover:text-blue-400 transition-colors flex-1 leading-tight line-clamp-2">
                          {evento.titulo}
                        </h3>
                      </div>
                      <p className="text-gray-400 leading-relaxed font-medium text-xs md:text-base line-clamp-2">{evento.descripcion}</p>
                    </div>

                    <div className="space-y-2 md:space-y-3 mb-4 md:mb-8">
                      <div className="flex items-center gap-2 md:gap-3 text-gray-300 text-[10px] md:text-sm font-medium">
                        <div className="p-1.5 md:p-2 rounded-lg bg-blue-500/10 text-blue-400"><Calendar className="w-4 h-4 md:w-5 md:h-5" /></div>
                        <span className="truncate">{new Date(evento.fecha_inicio).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 text-gray-300 text-[10px] md:text-sm font-medium">
                        <div className="p-1.5 md:p-2 rounded-lg bg-green-500/10 text-green-400"><Users className="w-4 h-4 md:w-5 md:h-5" /></div>
                        <span>{(evento.participantes || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex z-20 gap-2 items-center">
                      <span
                        className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/5"
                      >
                        {evento.tipo}
                      </span>
                      {/* Admin Edit Trigger */}
                      {(profile?.role === 'admin' || profile?.role === 'superadmin') && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Avoid triggering card click
                              handleEditEvent(evento);
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg backdrop-blur-sm transition-all border border-white/10"
                            title="Editar Evento (Admin)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Avoid triggering card click
                              handleToggleVisibility(evento);
                            }}
                            className={cn(
                              "p-2 rounded-lg backdrop-blur-sm transition-all border",
                              evento.is_active === false
                                ? "bg-red-500/20 text-red-400 border-red-500/20 hover:bg-red-500/30"
                                : "bg-blue-500/20 text-blue-400 border-blue-500/20 hover:bg-blue-500/30"
                            )}
                            title={evento.is_active === false ? "Mostrar Evento" : "Ocultar Evento"}
                          >
                            {evento.is_active === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Modal for Creating/Editing Events */}
        <CreateEventModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onEventCreated={fetchEvents}
          initialData={selectedEvent}
        />
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center ${className}`}>{children}</span>;
}
