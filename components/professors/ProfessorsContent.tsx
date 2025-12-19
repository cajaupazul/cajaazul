'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Star, Search, Plus, GraduationCap, Trophy } from 'lucide-react';
import { supabase, Professor, Profile } from '@/lib/supabase';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import BouncingBalls from '@/components/BouncingBalls';
import { useRouter } from 'next/navigation';

interface ProfessorsContentProps {
    initialProfessors: any[];
    initialSavedProfessors: string[];
    profile: Profile | null;
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring' as const, stiffness: 100 }
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

const getRandomBackgroundImage = () => {
    const randomId = Math.floor(Math.random() * 100000);
    return `https://picsum.photos/500/200?random=${randomId}`;
};

export default function ProfessorsContent({
    initialProfessors,
    initialSavedProfessors,
    profile
}: ProfessorsContentProps) {
    const router = useRouter();
    const [professors, setProfessors] = useState<any[]>(initialProfessors);
    const [searchQuery, setSearchQuery] = useState('');
    const [savedProfessors, setSavedProfessors] = useState<Set<string>>(new Set(initialSavedProfessors));
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        especialidad: '',
        facultad: '',
        email: '',
        otros_cursos: '',
    });

    const handleCreateProfessor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nombre.trim() || !formData.especialidad.trim()) {
            alert('Por favor completa los campos requeridos');
            return;
        }

        const { data: newProf, error } = await supabase.from('professors').insert({
            nombre: formData.nombre,
            especialidad: formData.especialidad,
            facultad: formData.facultad,
            email: formData.email || null,
            otros_cursos: formData.otros_cursos || null,
            background_image_url: getRandomBackgroundImage(),
        }).select().single();

        if (!error && newProf) {
            setCreateDialogOpen(false);
            setFormData({ nombre: '', especialidad: '', facultad: '', email: '', otros_cursos: '' });
            setProfessors(prev => [{ ...newProf, averageRating: 0, ratingCount: 0 }, ...prev]);
        } else {
            alert('Error al crear el profesor');
        }
    };

    const filteredProfessors = professors.filter((professor) =>
        professor.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        professor.especialidad?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-bb-dark p-8 relative overflow-hidden transition-colors duration-300">
            <BouncingBalls />

            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="max-w-7xl mx-auto relative z-10"
            >
                <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <motion.div variants={itemVariants}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                                <GraduationCap className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-4xl font-black text-bb-text tracking-tight">Profesores</h1>
                        </div>
                        <p className="text-bb-text-secondary font-medium ml-1">Descubre a los mejores mentores de tu facultad</p>
                    </motion.div>

                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <div className="relative group flex-1 md:w-80">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                            </div>
                            <Input
                                placeholder="Buscar por nombre o materia..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-12 bg-bb-card border-bb-border text-bb-text placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-xl transition-all"
                            />
                        </div>

                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 border-0">
                                    <Plus className="h-5 w-5 mr-2" />
                                    Agregar Profesor
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-bb-card border-bb-border text-bb-text sm:max-w-lg max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-bold">Agregar Nuevo Profesor</DialogTitle>
                                    <DialogDescription className="text-bb-text-secondary">
                                        Comparte información sobre un profesor para que otros estudiantes puedan calificarlo.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreateProfessor} className="space-y-5 mt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="nombre" className="text-bb-text text-xs font-semibold uppercase tracking-wide">Nombre *</Label>
                                            <Input id="nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                                placeholder="Ej: Dr. Juan García" required className="bg-bb-darker border-bb-border text-bb-text h-11" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="facultad" className="text-bb-text text-xs font-semibold uppercase tracking-wide">Facultad</Label>
                                            <Input id="facultad" value={formData.facultad} onChange={(e) => setFormData({ ...formData, facultad: e.target.value })}
                                                placeholder="Ej: Ingeniería" className="bg-bb-darker border-bb-border text-bb-text h-11" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="especialidad" className="text-bb-text text-xs font-semibold uppercase tracking-wide">Materia Principal *</Label>
                                            <Input id="especialidad" value={formData.especialidad} onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                                                placeholder="Ej: Cálculo I" required className="bg-bb-darker border-bb-border text-bb-text h-11" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-bb-text text-xs font-semibold uppercase tracking-wide">Correo Electrónico</Label>
                                            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="prof@universidad.edu" className="bg-bb-darker border-bb-border text-bb-text h-11" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="otros_cursos" className="text-bb-text text-xs font-semibold uppercase tracking-wide">Otros Cursos que Dicta</Label>
                                        <Input id="otros_cursos" value={formData.otros_cursos} onChange={(e) => setFormData({ ...formData, otros_cursos: e.target.value })}
                                            placeholder="Ej: Álgebra, Estadística, Física I" className="bg-bb-darker border-bb-border text-bb-text h-11" />
                                    </div>

                                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold h-12 mt-4 text-base">
                                        Guardar Profesor
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </motion.div>
                </div>

                {filteredProfessors.length > 0 ? (
                    <motion.div
                        variants={containerVariants}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        <AnimatePresence>
                            {filteredProfessors.map((professor) => {
                                const isTopRated = (professor.averageRating || 0) >= 4.5;

                                return (
                                    <motion.div
                                        key={professor.id}
                                        variants={itemVariants}
                                        layout
                                        className="group relative"
                                    >
                                        <Card className="h-full overflow-hidden hover:-translate-y-1 transition-all duration-300 bg-bb-card border border-bb-border">
                                            <div className="relative h-24 overflow-hidden">
                                                <div
                                                    className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                                                    style={{ backgroundImage: `url('${professor.background_image_url}')` }}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-bb-card to-transparent" />
                                                {isTopRated && (
                                                    <div className="absolute top-2 right-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                                        <Trophy className="w-3 h-3" /> TOP
                                                    </div>
                                                )}
                                            </div>

                                            <CardContent className="p-0 relative">
                                                <div className="px-5 pt-12 pb-4 relative">
                                                    <div className="absolute -top-10 left-5">
                                                        <div
                                                            className="h-20 w-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl transition-transform group-hover:scale-105 duration-300 ring-4 ring-bb-card"
                                                            style={{ backgroundColor: getColorFromName(professor.nombre) }}
                                                        >
                                                            {professor.nombre.charAt(0).toUpperCase()}
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end mb-2">
                                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${(professor.averageRating || 0) >= 4.5 ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-bb-darker border border-bb-border'}`}>
                                                            <Star className={`w-4 h-4 ${(professor.averageRating || 0) >= 4.5 ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-400 text-gray-400'}`} />
                                                            <span className={`text-sm font-bold ${(professor.averageRating || 0) >= 4.5 ? 'text-yellow-400' : 'text-bb-text'}`}>{((professor.averageRating || 0)).toFixed(1)}</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2">
                                                        <h3 className="text-xl font-bold text-bb-text mb-1 truncate group-hover:text-blue-400 transition-colors">
                                                            {professor.nombre}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">
                                                                {professor.especialidad}
                                                            </span>
                                                            <span className="text-xs text-bb-text-secondary truncate max-w-[120px]">
                                                                {professor.facultad || 'Facultad General'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="h-px w-full bg-bb-border" />

                                                <div className="grid grid-cols-2 p-4 gap-3">
                                                    <Button
                                                        variant="outline"
                                                        className="w-full border-bb-border bg-bb-darker hover:bg-bb-hover text-bb-text-secondary hover:text-bb-text font-medium text-xs h-10 transition-all"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/dashboard/professors/${professor.id}`);
                                                        }}
                                                    >
                                                        <Star className="w-3.5 h-3.5 mr-2" />
                                                        Calificar
                                                    </Button>
                                                    <Button
                                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-10"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/dashboard/professors/${professor.id}`);
                                                        }}
                                                    >
                                                        Ver Perfil
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                ) : (
                    <motion.div variants={itemVariants} className="text-center py-20 bg-bb-card rounded-3xl border border-bb-border">
                        <div className="bg-bb-darker p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4">
                            <Search className="h-10 w-10 text-bb-text-secondary" />
                        </div>
                        <h3 className="text-xl font-bold text-bb-text mb-2">
                            {searchQuery ? 'No encontramos coincidencias' : 'Aún no hay profesores'}
                        </h3>
                        <p className="text-bb-text-secondary max-w-md mx-auto">
                            {searchQuery
                                ? 'Intenta con otro nombre o especialidad.'
                                : 'Sé el primero en agregar a un profesor y ayuda a la comunidad.'}
                        </p>
                        {!searchQuery && (
                            <Button
                                onClick={() => setCreateDialogOpen(true)}
                                className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold"
                            >
                                Agregar Profesor
                            </Button>
                        )}
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
