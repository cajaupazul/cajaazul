'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Star, MessageCircle, TrendingUp, ArrowLeft, Trophy, Sparkles, User, Share2, Instagram } from 'lucide-react';
import Link from 'next/link';
import { supabase, Professor } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import BouncingBalls from '@/components/BouncingBalls';
import { motion, Variants } from 'framer-motion';

interface Rating {
  id: string;
  puntuacion: number;
  comentario: string | null;
  claridad: number | null;
  facilidad: number | null;
  created_at: string;
  profiles?: {
    nombre: string;
    avatar_url: string | null;
    background_url?: string | null;
    bio?: string | null;
    carrera?: string | null;
    link_instagram?: string | null;
  };
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 }
  }
};

export default function ProfessorRatingsPage() {
  const params = useParams();
  const professorId = params.id as string;
  const { colors } = useTheme();

  const [professor, setProfessor] = useState<Professor | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({
    puntuacion: 5,
    comentario: '',
    claridad: 5,
    facilidad: 5,
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: profData } = await supabase
        .from('professors')
        .select('*')
        .eq('id', professorId)
        .single();

      if (profData) setProfessor(profData);

      const { data: ratingsData } = await supabase
        .from('professor_ratings')
        .select('*, profiles(nombre, avatar_url, background_url, bio, carrera, link_instagram)')
        .eq('professor_id', professorId)
        .order('created_at', { ascending: false });

      if (ratingsData) setRatings(ratingsData as Rating[]);
      setLoading(false);
    };

    fetchData();
  }, [professorId]);

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('professor_ratings').insert({
      professor_id: professorId,
      user_id: user.id,
      puntuacion: formData.puntuacion,
      comentario: formData.comentario,
      claridad: formData.claridad,
      facilidad: formData.facilidad,
    });

    if (!error) {
      setCreateDialogOpen(false);
      setFormData({ puntuacion: 5, comentario: '', claridad: 5, facilidad: 5 });
      // Reload ratings
      const { data: ratingsData } = await supabase
        .from('professor_ratings')
        .select('*, profiles(nombre, avatar_url, background_url, bio, carrera, link_instagram)')
        .eq('professor_id', professorId)
        .order('created_at', { ascending: false });
      if (ratingsData) setRatings(ratingsData as Rating[]);
    }
  };

  const getColorFromName = (nombre: string) => {
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bb-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bb-dark text-white">
        <p>Profesor no encontrado</p>
      </div>
    );
  }

  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.puntuacion, 0) / ratings.length).toFixed(1)
    : '0.0';

  const avgClaridad = ratings.filter(r => r.claridad).length > 0
    ? (ratings.filter(r => r.claridad).reduce((sum, r) => sum + (r.claridad || 0), 0) / ratings.filter(r => r.claridad).length).toFixed(1)
    : '0.0';

  const avgFacilidad = ratings.filter(r => r.facilidad).length > 0
    ? (ratings.filter(r => r.facilidad).reduce((sum, r) => sum + (r.facilidad || 0), 0) / ratings.filter(r => r.facilidad).length).toFixed(1)
    : '0.0';

  const handleUserHover = (e: React.MouseEvent, userId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPosition({
      x: rect.right,
      y: rect.top
    });
    setHoveredUser(userId);
  };

  return (
    <div className="min-h-screen bg-bb-dark p-8 relative overflow-hidden transition-colors duration-300">
      <BouncingBalls />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="max-w-4xl mx-auto relative z-10"
      >
        {/* Navigation */}
        <motion.div variants={itemVariants} className="mb-8">
          <Link href="/dashboard/professors">
            <Button variant="ghost" className="text-bb-text-secondary hover:text-bb-text hover:bg-bb-hover group pl-0">
              <ArrowLeft className="h-5 w-5 mr-1 group-hover:-translate-x-1 transition-transform" />
              Volver a Profesores
            </Button>
          </Link>
        </motion.div>

        {/* Hero Card */}
        <motion.div
          variants={itemVariants}
          className="mb-10 relative overflow-hidden rounded-3xl bg-bb-card border border-bb-border"
        >
          {/* Background Image Banner */}
          {professor.background_image_url && (
            <div className="relative h-32 overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${professor.background_image_url}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bb-card/60 to-bb-card" />
            </div>
          )}

          <div className={`relative z-10 p-8 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left ${professor.background_image_url ? '-mt-16' : ''}`}>
            <div className="relative">
              <div
                className="h-32 w-32 rounded-3xl flex items-center justify-center text-white font-bold text-5xl shadow-2xl border-4 border-bb-card"
                style={{ backgroundColor: getColorFromName(professor.nombre) }}
              >
                {professor.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-3 -right-3 bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1 border border-yellow-400/50">
                <Star className="w-3 h-3 fill-white" /> {avgRating}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <h1 className="text-3xl md:text-4xl font-black text-bb-text">{professor.nombre}</h1>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="bg-bb-darker text-bb-text px-3 py-1 rounded-lg text-sm border border-bb-border">
                  {professor.especialidad}
                </span>
                {professor.facultad && (
                  <span className="bg-bb-card text-bb-text-secondary px-3 py-1 rounded-lg text-sm border border-bb-border">
                    {professor.facultad}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[140px]">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-blue-600 hover:bg-blue-500 font-bold h-11 shadow-lg shadow-blue-500/20 text-white">
                    <Star className="h-4 w-4 mr-2" />
                    Calificar
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-bb-card border-bb-border text-bb-text sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Califica a {professor.nombre.split(' ')[0]}</DialogTitle>
                    <DialogDescription className="text-bb-text-secondary">
                      Tu opinión ayuda a futuros estudiantes a elegir mejor.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitRating} className="space-y-6 mt-4">
                    <div className="space-y-4">
                      {([
                        { label: 'Puntuación General', key: 'puntuacion', icon: Trophy, color: 'text-yellow-400' },
                        { label: 'Claridad en Clase', key: 'claridad', icon: Sparkles, color: 'text-blue-400' },
                        { label: 'Facilidad para Aprobar', key: 'facilidad', icon: TrendingUp, color: 'text-green-400' }
                      ] as const).map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label className="flex items-center gap-2 text-bb-text">
                            <field.icon className={`w-4 h-4 ${field.color}`} /> {field.label}
                          </Label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setFormData({ ...formData, [field.key]: star })}
                                className="group p-1 focus:outline-none transition-transform active:scale-95"
                              >
                                <Star className={`w-8 h-8 transition-colors ${star <= (formData as any)[field.key] ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400 fill-gray-200 dark:fill-gray-800'
                                  }`} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="space-y-2">
                        <Label htmlFor="comentario" className="text-bb-text">Comentario (Opcional)</Label>
                        <Textarea
                          id="comentario"
                          value={formData.comentario}
                          onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                          placeholder="¿Qué tal enseña? ¿Toma asistencia?"
                          className="bg-bb-darker border-bb-border text-bb-text min-h-[100px]"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold h-11 text-white">
                      Publicar Reseña
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="w-full border-bb-border bg-bb-darker text-bb-text-secondary hover:bg-bb-hover hover:text-bb-text">
                <Share2 className="h-4 w-4 mr-2" /> Compartir
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 divide-x divide-bb-border border-t border-bb-border bg-bb-darker/50">
            {[
              { label: 'Calificación', value: avgRating, icon: Star },
              { label: 'Claridad', value: avgClaridad, icon: Sparkles },
              { label: 'Facilidad', value: avgFacilidad, icon: TrendingUp },
            ].map((stat, i) => (
              <div key={i} className="p-4 flex flex-col items-center justify-center hover:bg-bb-card transition-colors">
                <span className="text-2xl font-black text-bb-text mb-1">{stat.value}</span>
                <div className="flex items-center gap-1.5 text-xs text-bb-text-secondary uppercase tracking-wide font-bold">
                  <stat.icon className="w-3.5 h-3.5" /> {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Additional Info Section - Two Column Layout */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Left Column - Contact & Courses */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Card */}
            {professor.email && (
              <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                <h3 className="text-lg font-bold text-bb-text mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-400" />
                  Contacto
                </h3>
                <a
                  href={`mailto:${professor.email}`}
                  className="flex items-center gap-3 text-bb-text hover:text-blue-400 transition-colors group"
                >
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-bb-text-secondary">Correo Electrónico</p>
                    <p className="font-medium">{professor.email}</p>
                  </div>
                </a>
              </div>
            )}

            {/* Other Courses Card */}
            {professor.otros_cursos && (
              <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
                <h3 className="text-lg font-bold text-bb-text mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                  Otros Cursos que Dicta
                </h3>
                <div className="flex flex-wrap gap-2">
                  {professor.otros_cursos.split(',').map((curso: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium"
                    >
                      {curso.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Quick Stats */}
          <div className="space-y-6">
            <div className="bg-bb-card border border-bb-border rounded-2xl p-6">
              <h3 className="text-lg font-bold text-bb-text mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Resumen
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-bb-text-secondary text-sm">Total de Reseñas</span>
                  <span className="text-bb-text font-bold text-lg">{ratings.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-bb-text-secondary text-sm">Puntuación Promedio</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-bb-text font-bold text-lg">{avgRating}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-bb-text-secondary text-sm">Claridad Promedio</span>
                  <span className="text-bb-text font-bold text-lg">{avgClaridad}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-bb-text-secondary text-sm">Facilidad Promedio</span>
                  <span className="text-bb-text font-bold text-lg">{avgFacilidad}</span>
                </div>
              </div>
            </div>

            {/* Tip Card */}
            <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-2xl p-6">
              <p className="text-sm text-blue-200 flex items-start gap-2">
                <span className="text-lg">💡</span>
                <span>¿Conoces a este profesor? Deja una reseña para ayudar a otros estudiantes.</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Reviews Section */}
        <motion.div variants={itemVariants} className="space-y-6">
          <h2 className="text-2xl font-bold text-bb-text flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-400" />
            Reseñas de la Comunidad
            <span className="text-sm font-normal text-bb-text-secondary ml-2">({ratings.length})</span>
          </h2>

          {ratings.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {ratings.map((rating) => (
                <motion.div
                  key={rating.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-6 rounded-2xl hover:border-blue-500/30 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4 relative">
                    <div className="flex items-center gap-3">
                      <div
                        className="relative cursor-pointer"
                        onMouseEnter={(e) => handleUserHover(e, rating.id)}
                        onMouseLeave={() => setHoveredUser(null)}
                      >
                        <Avatar className="h-10 w-10 border border-bb-border">
                          <AvatarImage src={rating.profiles?.avatar_url || ''} />
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                            {rating.profiles?.nombre.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div
                        className="cursor-pointer"
                        onMouseEnter={(e) => handleUserHover(e, rating.id)}
                        onMouseLeave={() => setHoveredUser(null)}
                      >
                        <p className="font-bold text-bb-text hover:text-blue-400 transition-colors">{rating.profiles?.nombre}</p>
                        <p className="text-xs text-bb-text-secondary">Estudiante • {new Date(rating.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < rating.puntuacion ? 'fill-yellow-500 text-yellow-500' : 'fill-gray-300 text-gray-300 dark:fill-gray-800 dark:text-gray-700'}`} />
                      ))}
                    </div>
                  </div>

                  {rating.comentario && (
                    <p className="text-bb-text italic mb-4 pl-4 border-l-2 border-blue-500/30">"{rating.comentario}"</p>
                  )}

                  <div className="flex gap-4 text-xs text-bb-text-secondary font-medium">
                    {rating.claridad && <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-blue-400" /> Claridad: {rating.claridad}/5</span>}
                    {rating.facilidad && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" /> Facilidad: {rating.facilidad}/5</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-bb-card rounded-3xl border border-dashed border-bb-border">
              <div className="bg-bb-darker p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4 text-bb-text-secondary">
                <MessageCircle className="w-8 h-8" />
              </div>
              <p className="text-bb-text-secondary text-lg">Sé el primero en calificar a este profesor.</p>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* GLOBAL HOVER CARD */}
      {hoveredUser && (() => {
        const rating = ratings.find(r => r.id === hoveredUser);
        const profile = rating?.profiles;

        if (!profile) return null;

        return (
          <div
            className="fixed bg-bb-card border border-bb-border rounded-xl shadow-2xl z-50 w-64 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{
              left: `${hoverPosition.x + 10}px`,
              top: `${hoverPosition.y}px`,
              transform: 'translateY(-50%)'
            }}
          >
            <div
              className="h-20 bg-cover bg-center relative"
              style={{
                backgroundImage: profile.background_url
                  ? `url('${profile.background_url}')`
                  : `linear-gradient(135deg, ${colors?.primary}40, ${colors?.secondary}40)`,
                backgroundColor: colors?.primary + '20',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-bb-card/80 to-transparent"></div>
            </div>

            <div className="px-4 pb-4 relative">
              <div className="flex flex-col items-center -mt-10">
                <Avatar className="h-20 w-20 ring-4 ring-bb-card shadow-lg">
                  <AvatarImage src={profile.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                    {profile.nombre.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="text-center mt-2 w-full">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-lg font-bold text-bb-text truncate leading-tight">{profile.nombre || 'Usuario'}</h3>
                    {profile.link_instagram && (
                      <a
                        href={profile.link_instagram.startsWith('http') ? profile.link_instagram : `https://instagram.com/${profile.link_instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 hover:scale-110 transition-transform"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Instagram className="w-4 h-4 text-pink-500" />
                      </a>
                    )}
                  </div>
                  {profile.carrera && (
                    <p className="text-xs text-bb-text-secondary mt-0.5 truncate">{profile.carrera}</p>
                  )}
                </div>
              </div>

              {profile.bio && (
                <div className="mt-3 pt-3 border-t border-bb-border">
                  <p className="text-xs text-bb-text-secondary italic line-clamp-2 text-center">
                    "{profile.bio}"
                  </p>
                </div>
              )}

              <div className="mt-3 flex justify-between items-center text-[10px] text-bb-text-secondary opacity-70">
                <span>Publicado</span>
                <span>
                  {new Date(rating!.created_at).toLocaleDateString('es-ES', {
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}