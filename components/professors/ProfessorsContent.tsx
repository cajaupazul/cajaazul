'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Star, Search, Plus, GraduationCap, Trophy, Trash2 } from 'lucide-react';
import { supabase, Professor, Profile } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import AddProfessorForm from '@/components/professors/AddProfessorForm';

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

const getRandomBackgroundImage = () => {
    const NATURE_BG_IDS = [
        'photo-1501854140801-50d01698950b',
        'photo-1470074184345-d97a063efcf9',
        'photo-1441974231531-c6227db76b6e',
        'photo-1501785888041-af3ef285b470',
        'photo-1472214103451-9374bd1c798e',
        'photo-1500382017468-9049fed747ef',
        'photo-1469474968028-56623f02e42e',
        'photo-1447752875215-b2761acb3c5d',
        'photo-1433086966358-54859d0ed716',
        'photo-1511497584788-8767ef7299b2',
    ];
    const randomId = NATURE_BG_IDS[Math.floor(Math.random() * NATURE_BG_IDS.length)];
    return `https://images.unsplash.com/${randomId}?auto=format&fit=crop&q=80&w=1600&h=900`;
};

const getHighQualityBackgroundImage = (url: string | null, professorName: string): string => {
    if (!url || url.includes('picsum.photos') || url.includes('source.unsplash.com') || url.includes('unsplash.com/featured')) {
        const NATURE_BG_IDS = [
            'photo-1501854140801-50d01698950b',
            'photo-1470074184345-d97a063efcf9',
            'photo-1441974231531-c6227db76b6e',
            'photo-1501785888041-af3ef285b470',
            'photo-1472214103451-9374bd1c798e',
            'photo-1500382017468-9049fed747ef',
            'photo-1469474968028-56623f02e42e',
            'photo-1447752875215-b2761acb3c5d',
            'photo-1433086966358-54859d0ed716',
            'photo-1511497584788-8767ef7299b2',
        ];
        const seed = professorName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const randomId = NATURE_BG_IDS[seed % NATURE_BG_IDS.length];
        return `https://images.unsplash.com/${randomId}?auto=format&fit=crop&q=80&w=1600&h=900`;
    }
    return url;
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

    const filteredProfessors = professors.filter((professor) => {
        if (!searchQuery) return true;

        const query = searchQuery.toLowerCase().trim();
        const nameMatch = professor.nombre.toLowerCase().includes(query);
        const specialtyMatch = professor.especialidad?.toLowerCase().includes(query);
        const otherCoursesMatch = (professor.courses || []).some((course: string) => course.toLowerCase().includes(query));

        return nameMatch || specialtyMatch || otherCoursesMatch;
    });

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

                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <div className="relative group flex-1 md:w-80">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-500" />
                            </div>
                            <Input
                                placeholder="Buscar por nombre o materia..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-12 bg-bb-card border-bb-border text-bb-text placeholder:text-gray-500 rounded-xl"
                            />
                        </div>

                        <Button
                            onClick={() => setCreateDialogOpen(true)}
                            className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl w-full sm:w-auto"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Agregar Profesor
                        </Button>
                    </div>
                </div>

                {filteredProfessors.length > 0 ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                        {filteredProfessors.map((professor) => {
                            const isTopRated = (professor.averageRating || 0) >= 4.5;

                            return (
                                <div
                                    key={professor.id}
                                    className="group relative"
                                >
                                    <Card className="h-full overflow-hidden transition-all duration-300 bg-bb-card border border-bb-border flex flex-col rounded-xl hover:border-blue-500/30">
                                        <div className="relative h-20 md:h-24 overflow-hidden flex-shrink-0">
                                            <div
                                                className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                                                style={{ backgroundImage: `url("${getHighQualityBackgroundImage(professor.background_image_url, professor.nombre)}")` }}
                                            />
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
                                                            src={professor.avatar_url || '/profes/tl.webp'}
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
                                                    <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3 flex-wrap">
                                                        {(professor.courses || [professor.especialidad]).slice(0, 2).map((course: string, idx: number) => (
                                                            <span key={idx} className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md">
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
                                                        router.push(`/dashboard/professors/${professor.id}`);
                                                    }}
                                                >
                                                    Calificar
                                                </Button>
                                                <Button
                                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] md:text-xs h-8 md:h-10 px-1"
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
                                onClick={() => setCreateDialogOpen(true)}
                                className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus className="h-5 w-5 mr-2" />
                                Agregar Profesor
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Panel para completar datos del profe (Modal) */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="bg-bb-card border-bb-border text-bb-text max-w-4xl rounded-[2.5rem] overflow-y-auto max-h-[90vh] custom-scrollbar p-0 border-0">
                    <AddProfessorForm
                        profile={profile}
                        isModal={true}
                        onSuccess={() => {
                            setCreateDialogOpen(false);
                            router.refresh();
                        }}
                        onCancel={() => setCreateDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
