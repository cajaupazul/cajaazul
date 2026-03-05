'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Star, Search, Plus, GraduationCap, Trophy, Trash2, RefreshCw } from 'lucide-react';
import { supabase, Professor, Profile, getStorageUrl } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDashboardData } from '@/lib/dashboard-data-context';
import { PLACEHOLDERS, getDiversifiedProfessorBackground } from '@/lib/constants';
import SyncProfessorsModal from './SyncProfessorsModal';

interface ProfessorsContentProps {
    initialProfessors: any[];
    initialSavedProfessors: string[];
    profile: Profile | null;
}


const getColorFromName = (nombre: string) => {
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const ProfessorBackground = ({ url, name, specialty }: { url: string | null; name: string; specialty?: string | null }) => {
    const [currentUrl, setCurrentUrl] = useState(() => getDiversifiedProfessorBackground(name, specialty, url));
    const [isLoaded, setIsLoaded] = useState(false);

    const handleError = () => {
        // Fallback to LoremFlickr for guaranteed uniqueness on error
        const seed = `${name}-${specialty || ''}-fallback`;
        setCurrentUrl(`https://loremflickr.com/1600/900/nature,landscape,forest,mountain/all?lock=${Math.abs(hashString(seed))}`);
    };

    // Helper for secondary fallback hash if needed
    function hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    return (
        <>
            <img
                src={currentUrl}
                alt=""
                className="hidden"
                onLoad={() => setIsLoaded(true)}
                onError={handleError}
            />
            <div
                className={`absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-all duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0 scale-110'}`}
                style={{ backgroundImage: `url("${currentUrl}")` }}
            />
        </>
    );
};

export default function ProfessorsContent({
    initialProfessors,
    initialSavedProfessors,
    profile
}: ProfessorsContentProps) {
    const router = useRouter();
    const { removeProfessor } = useDashboardData();
    const [professors, setProfessors] = useState<any[]>(initialProfessors);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('all');
    const [sortBy, setSortBy] = useState('best');
    const [savedProfessors, setSavedProfessors] = useState<Set<string>>(new Set(initialSavedProfessors));
    const [syncModalOpen, setSyncModalOpen] = useState(false);

    // Extract unique courses across all professors
    const uniqueCourses = useMemo(() => {
        const coursesSet = new Set<string>();
        initialProfessors.forEach(prof => {
            if (prof.courses && Array.isArray(prof.courses)) {
                prof.courses.forEach((c: string) => coursesSet.add(c));
            } else if (prof.especialidad) {
                coursesSet.add(prof.especialidad);
            }
        });
        return Array.from(coursesSet).sort();
    }, [initialProfessors]);

    // Sync local state when global state changes (e.g. from props)
    useEffect(() => {
        setProfessors(initialProfessors);
    }, [initialProfessors]);

    const filteredAndSortedProfessors = useMemo(() => {
        let result = professors.filter((professor) => {
            const query = searchQuery.toLowerCase().trim();
            const nameMatch = !query || professor.nombre.toLowerCase().includes(query);
            const specialtyMatch = !query || professor.especialidad?.toLowerCase().includes(query);
            const otherCoursesMatch = !query || (professor.courses || []).some((course: string) => course.toLowerCase().includes(query));

            const courseMatch = selectedCourse === 'all' ||
                (professor.courses || []).includes(selectedCourse) ||
                professor.especialidad === selectedCourse;

            return (nameMatch || specialtyMatch || otherCoursesMatch) && courseMatch;
        });

        // Sorting
        return result.sort((a, b) => {
            const ratingA = a.averageRating || 0;
            const ratingB = b.averageRating || 0;

            if (sortBy === 'best') return ratingB - ratingA;
            if (sortBy === 'worst') return ratingA - ratingB;
            return 0;
        });
    }, [professors, searchQuery, selectedCourse, sortBy]);

    return (
        <div className="min-h-screen bg-bb-dark p-4 md:p-8 relative transition-colors duration-300">
            <div className="max-w-7xl mx-auto relative z-10">
                <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 md:p-3 bg-blue-600 rounded-xl">
                                <GraduationCap className="h-6 w-6 md:h-8 md:w-8 text-white" />
                            </div>
                            <h1 className="text-2xl md:text-4xl font-black text-bb-text tracking-tight">Profesores</h1>
                        </div>
                        <p className="text-sm md:text-base text-bb-text-secondary font-medium ml-1">Descubre a los mejores mentores de tu facultad</p>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-row gap-3 w-full lg:w-auto">
                        <div className="relative group w-full lg:w-72">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-500" />
                            </div>
                            <Input
                                placeholder="Buscar profesor..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-bb-card border-bb-border text-bb-text placeholder:text-gray-500 rounded-xl"
                            />
                        </div>

                        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                            <SelectTrigger className="h-11 bg-bb-card border-bb-border text-bb-text rounded-xl w-full lg:w-48">
                                <SelectValue placeholder="Curso" />
                            </SelectTrigger>
                            <SelectContent className="bg-bb-card border-bb-border">
                                <SelectItem value="all">Todos los cursos</SelectItem>
                                {uniqueCourses.map(course => (
                                    <SelectItem key={course} value={course}>{course}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="h-11 bg-bb-card border-bb-border text-bb-text rounded-xl w-full lg:w-48">
                                <SelectValue placeholder="Ordenar por" />
                            </SelectTrigger>
                            <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                                <SelectItem value="best">Mejor Calificados</SelectItem>
                                <SelectItem value="worst">Menor Calificados</SelectItem>
                            </SelectContent>
                        </Select>

                        {profile?.role === 'admin' && (
                            <Button
                                onClick={() => setSyncModalOpen(true)}
                                className="h-11 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl w-full lg:w-auto"
                            >
                                <RefreshCw className="h-5 w-5 mr-1" />
                                <span className="hidden lg:inline">Sincronizar</span>
                                <span className="inline lg:hidden">Sincronizar Excel</span>
                            </Button>
                        )}

                        <Button
                            onClick={() => router.push('/dashboard/professors/nuevo')}
                            className="h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl w-full lg:w-auto"
                        >
                            <Plus className="h-5 w-5 mr-1" />
                            Agregar
                        </Button>
                    </div>
                </div>

                {filteredAndSortedProfessors.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                        {filteredAndSortedProfessors.map((professor) => {
                            const isTopRated = (professor.averageRating || 0) >= 4.5;

                            return (
                                <div
                                    key={professor.id}
                                    className="group relative"
                                >
                                    <Card className="h-full overflow-hidden transition-all duration-300 bg-bb-card border border-bb-border flex flex-col rounded-xl hover:border-blue-500/30">
                                        <div className="relative h-20 md:h-24 overflow-hidden flex-shrink-0 bg-gradient-to-br from-bb-sidebar to-bb-dark">
                                            <ProfessorBackground url={professor.background_image_url} name={professor.nombre} specialty={professor.especialidad} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                                            {isTopRated && (
                                                <div className="absolute top-2 right-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                                    <Trophy className="w-3 h-3" /> TOP
                                                </div>
                                            )}
                                            {profile?.role === 'admin' && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (confirm('¿Estás seguro de que quieres eliminar este profesor?')) {
                                                            const { error } = await supabase.from('professors').delete().eq('id', professor.id);
                                                            if (!error) {
                                                                setProfessors(prev => prev.filter(p => p.id !== professor.id));
                                                                removeProfessor(professor.id);
                                                            } else {
                                                                alert('Error al eliminar profesor');
                                                            }
                                                        }
                                                    }}
                                                    className="absolute top-2 left-2 bg-red-500/20 border border-red-500/30 text-red-400 p-1.5 rounded-lg hover:bg-red-500/40 transition-colors z-20"
                                                    title="Eliminar profesor"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <CardContent className="p-0 relative flex-1 flex flex-col">
                                            <div className="px-3 md:px-5 pt-8 md:pt-12 pb-3 md:pb-4 relative flex-1">
                                                <div className="absolute -top-8 md:-top-10 left-3 md:left-5">
                                                    <div
                                                        className="h-14 w-14 md:h-20 md:w-20 rounded-xl md:rounded-2xl flex items-center justify-center bg-bb-sidebar border-2 border-bb-card shadow-xl overflow-hidden"
                                                    >
                                                        <img
                                                            src={getStorageUrl(professor.avatar_url || '/profes/tl.webp', 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                                            alt={professor.nombre}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/profes/tl.webp';
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex justify-end mb-2">
                                                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${isTopRated ? 'bg-yellow-500/10 text-yellow-400' : 'bg-bb-darker border border-bb-border text-bb-text-secondary'}`}>
                                                        <Star className={`w-3.5 h-3.5 ${isTopRated ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-400 text-gray-400'}`} />
                                                        <span className="text-xs font-bold">{((professor.averageRating || 0)).toFixed(1)}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-1 md:mt-2">
                                                    <h3 className="text-sm md:text-lg font-bold text-bb-text mb-1 truncate group-hover:text-blue-400 transition-colors">
                                                        {professor.nombre}
                                                    </h3>
                                                    <div className="flex items-center gap-1 md:gap-1.5 mb-2 md:mb-3 flex-wrap overflow-hidden">
                                                        {(professor.courses || [professor.especialidad]).slice(0, 6).map((course: string, idx: number) => (
                                                            <span key={idx} className="text-[9px] md:text-[10px] font-bold uppercase tracking-tight text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/5 whitespace-nowrap">
                                                                {course}
                                                            </span>
                                                        ))}
                                                        <span className="hidden md:inline text-[10px] md:text-xs text-bb-text-secondary truncate">
                                                            {professor.facultad || 'General'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px w-full bg-bb-border" />

                                            <div className="grid grid-cols-2 p-2 md:p-4 gap-2 md:gap-3 mt-auto">
                                                <Button
                                                    variant="outline"
                                                    className="w-full border-bb-border bg-bb-darker hover:bg-bb-hover text-bb-text-secondary hover:text-bb-text text-[10px] md:text-xs h-8 md:h-10 transition-all px-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/dashboard/professors/view?id=${professor.id}`);
                                                    }}
                                                >
                                                    Calificar
                                                </Button>
                                                <Button
                                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] md:text-xs h-8 md:h-10 px-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/dashboard/professors/view?id=${professor.id}`);
                                                    }}
                                                >
                                                    Ver Perfil
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-bb-card rounded-3xl border border-bb-border">
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
                                onClick={() => router.push('/dashboard/professors/nuevo')}
                                className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus className="h-5 w-5 mr-2" />
                                Agregar Profesor
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {profile?.role === 'admin' && (
                <SyncProfessorsModal
                    open={syncModalOpen}
                    onOpenChange={setSyncModalOpen}
                    onSuccess={() => {
                        router.refresh();
                        setTimeout(() => window.location.reload(), 1000);
                    }}
                />
            )}
        </div>
    );
}
