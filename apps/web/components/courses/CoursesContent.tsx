'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Search, Plus, Trash2, Eye, Star, ArrowRight } from 'lucide-react';
import { supabase, Course, Profile } from '@/lib/supabase';
import { useDashboardData } from '@/lib/dashboard-data-context';
import { useProfile } from '@/lib/profile-context';
import { deleteFileFromR2WithRetry, extractPathFromUrl } from '@/lib/r2-storage';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

const FACULTADES = [
    'Facultad de Ciencias Empresariales',
    'Facultad de Derecho',
    'Facultad de Economía y Finanzas',
    'Facultad de Ingeniería',
];

const CICLOS = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

interface CoursesContentProps {
    initialCourses: Course[];
    profile: Profile | null;
}

export default function CoursesContent({ initialCourses, profile }: CoursesContentProps) {
    const { isGuest } = useProfile();
    const [courses, setCourses] = useState<Course[]>(initialCourses);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [selectedCycle, setSelectedCycle] = useState('todos');
    const [selectedFaculty, setSelectedFaculty] = useState('todos');
    const [savedCourses, setSavedCourses] = useState<string[]>([]);
    const [itemsPerPage] = useState(24);
    const [currentPage, setCurrentPage] = useState(1);
    const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
    const router = useRouter();
    const { removeCourse } = useDashboardData();

    // Sync local state when global state changes (e.g. from props)
    useEffect(() => {
        setCourses(initialCourses);
    }, [initialCourses]);

    // Debounce search query to prevent lag on rapid typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCycle, selectedFaculty]);

    // Silently refresh views on mount to bypass Next.js navigation cache
    useEffect(() => {
        const fetchViews = async () => {
            const { data } = await supabase.from('courses').select('id, views');
            if (data) {
                setCourses(prev => prev.map(c => {
                    const updated = data.find(d => d.id === c.id);
                    return updated ? { ...c, views: updated.views } : c;
                }));
            }
        };
        fetchViews();
    }, []);

    // Realtime listener for course views
    useEffect(() => {
        const channel = supabase
            .channel('public:courses:views')
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'courses' },
                (payload) => {
                    setCourses((prevCourses) => 
                        prevCourses.map(c => 
                            c.id === payload.new.id 
                                ? { ...c, views: payload.new.views } 
                                : c
                        )
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const favoritesStorageKey = `campuslink:pinned-courses:${profile?.id || 'guest'}`;

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(favoritesStorageKey);
            const parsed = stored ? JSON.parse(stored) : [];
            setSavedCourses(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
        } catch {
            setSavedCourses([]);
        }
    }, [favoritesStorageKey]);

    const filteredCourses = courses.filter((course) => {
        const matchesSearch =
            course.nombre.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            course.codigo?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

        const matchesCycle = selectedCycle === 'todos' || course.ciclo?.toString() === selectedCycle;
        const matchesFaculty = selectedFaculty === 'todos' || course.facultad === selectedFaculty;

        return matchesSearch && matchesCycle && matchesFaculty;
    }).sort((a, b) => Number(savedCourses.includes(b.id)) - Number(savedCourses.includes(a.id)));

    const toggleSavedCourse = (courseId: string) => {
        setSavedCourses((prev) => {
            const next = prev.includes(courseId)
                ? prev.filter((id) => id !== courseId)
                : [...prev, courseId];
            try {
                window.localStorage.setItem(favoritesStorageKey, JSON.stringify(next));
            } catch {
                // Keep the in-memory preference when local storage is unavailable.
            }
            return next;
        });
    };

    const cycles = Array.from(new Set(courses.map((c) => c.ciclo))).sort((a, b) => (a || 0) - (b || 0));

    const deleteManagedCourse = async (course: Course) => {
        if (deletingCourseId) return;
        setDeletingCourseId(course.id);
        try {
            const [{ data: materials, error: materialsError }, { data: sets, error: setsError }] = await Promise.all([
                supabase.from('materials').select('url_archivo, thumbnail_url').eq('course_id', course.id),
                supabase.from('bb_material_sets').select('id').eq('course_id', course.id),
            ]);
            if (materialsError) throw materialsError;
            if (setsError) throw setsError;

            const setIds = (sets || []).map(set => set.id);
            let bbFiles: Array<{ storage_path: string }> = [];
            if (setIds.length > 0) {
                const { data, error } = await supabase.from('bb_files').select('storage_path').in('set_id', setIds);
                if (error) throw error;
                bbFiles = data || [];
            }

            const objects = new Map<string, { bucket: string; path: string }>();
            const addObject = (bucket: string, value?: string | null) => {
                if (!value) return;
                const path = extractPathFromUrl(value, bucket);
                if (path) objects.set(`${bucket}:${path}`, { bucket, path });
            };
            (materials || []).forEach(material => {
                addObject('course-materials', material.url_archivo);
                addObject('thumbnails', material.thumbnail_url);
            });
            bbFiles.forEach(file => addObject('course-materials', file.storage_path));
            addObject('course-images', course.imagen_url);

            const pendingObjects = Array.from(objects.values());
            for (let index = 0; index < pendingObjects.length; index += 10) {
                await Promise.all(pendingObjects.slice(index, index + 10).map(({ bucket, path }) =>
                    deleteFileFromR2WithRetry(bucket, path),
                ));
            }

            const { error } = await supabase.from('courses').delete().eq('id', course.id);
            if (error) throw error;
            setCourses(prev => prev.filter(item => item.id !== course.id));
            removeCourse(course.id);
        } catch (error) {
            console.error('Error deleting course:', error);
            alert('No se pudo eliminar el curso y todos sus archivos de forma segura. Intenta nuevamente.');
        } finally {
            setDeletingCourseId(null);
        }
    };

    return (
        <div className="flex-1 overflow-auto p-4 md:p-8 bg-bb-dark transition-colors duration-300">
            <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-4xl font-bold text-bb-text">Cursos</h1>
                    <p className="text-bb-text-secondary mt-1 md:mt-2 text-sm md:text-base">
                        {filteredCourses.length} {filteredCourses.length === 1 ? 'curso' : 'cursos'} disponibles
                    </p>
                </div>
                
                {!isGuest && (
                    <Button
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 h-10 md:h-11 text-white shadow-lg shadow-blue-500/20 text-sm md:text-base font-bold"
                        onClick={() => router.push('/dashboard/courses/new')}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Curso
                    </Button>
                )}
            </div>

            <div className="mb-4 md:mb-6 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-bb-text-secondary h-4 w-4 md:h-5 md:w-5" />
                <Input
                    placeholder="Busque sus cursos"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 md:pl-12 py-3 md:py-6 text-sm md:text-base bg-bb-card border-bb-border text-bb-text rounded-lg shadow-sm placeholder:text-bb-text-secondary/50"
                />
            </div>

            <div className="mb-6 md:mb-8 grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4 md:items-center">
                <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2">
                    <span className="text-xs md:text-sm font-semibold text-bb-text-secondary hidden md:inline">Períodos</span>
                    <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                        <SelectTrigger className="w-full md:w-32 h-9 md:h-10 bg-bb-card border-bb-border text-bb-text text-xs md:text-sm">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                            <SelectItem value="todos" className="focus:bg-bb-hover focus:text-bb-text">Todos</SelectItem>
                            {CICLOS.map((cycle) => (
                                <SelectItem key={cycle} value={cycle} className="focus:bg-bb-hover focus:text-bb-text">
                                    Ciclo {cycle}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2">
                    <span className="text-xs md:text-sm font-semibold text-bb-text-secondary hidden md:inline">Filtros</span>
                    <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                        <SelectTrigger className="w-full md:w-48 h-9 md:h-10 bg-bb-card border-bb-border text-bb-text text-xs md:text-sm">
                            <SelectValue placeholder="Facultad" />
                        </SelectTrigger>
                        <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                            <SelectItem value="todos" className="focus:bg-bb-hover focus:text-bb-text">Todas las Facultades</SelectItem>
                            {FACULTADES.map((faculty) => (
                                <SelectItem key={faculty} value={faculty} className="focus:bg-bb-hover focus:text-bb-text">
                                    {faculty}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>


                <span className="text-xs md:text-sm text-bb-text-secondary col-span-2 md:col-span-1 md:ml-auto text-right">
                    {Math.min(itemsPerPage, filteredCourses.length)} de {filteredCourses.length} cursos
                </span>
            </div>

            {
                filteredCourses.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6 mb-8">
                            {filteredCourses.slice(0, currentPage * itemsPerPage).map((course) => (
                                <div
                                    key={course.id}
                                    className="group cursor-pointer overflow-hidden rounded-lg shadow-md glass-card transition-all hover:shadow-lg hover:border-blue-500/30 flex h-full flex-col"
                                    onClick={() => router.push(`/dashboard/courses/view?id=${course.id}`)}
                                >
                                    <div className="relative h-28 md:h-40 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0">
                                        {course.imagen_url ? (
                                            <Image
                                                src={course.imagen_url}
                                                alt={course.nombre}
                                                fill
                                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                                className="object-cover transition-transform group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="h-full w-full bg-gradient-to-br from-blue-400 via-blue-500 to-teal-600 transition-transform group-hover:scale-105" />
                                        )}
                                        {profile?.role === 'admin' && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm('¿Estás seguro de que quieres eliminar este curso?')) {
                                                        await deleteManagedCourse(course);
                                                    }
                                                }}
                                                disabled={deletingCourseId === course.id}
                                                className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-md border border-red-500/30 bg-[#161616] text-red-400 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-wait disabled:opacity-50 md:right-3 md:top-3"
                                                title="Eliminar curso"
                                                aria-label={`Eliminar ${course.nombre}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="p-2.5 md:p-4 flex flex-col flex-1 min-h-0">
                                        <div className="flex min-w-0 items-center justify-between gap-2">
                                            <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-bb-text-secondary md:text-xs">
                                                {course.codigo}
                                            </span>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <span className="inline-flex h-6 items-center gap-1 rounded-md border border-bb-border bg-bb-dark px-1.5 text-[10px] font-semibold text-bb-text-secondary md:px-2 md:text-xs" title={`${course.views || 0} visualizaciones`}>
                                                    <Eye className="h-3.5 w-3.5" />
                                                    {course.views || 0}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSavedCourse(course.id);
                                                    }}
                                                    className={`grid h-6 w-6 place-items-center rounded-md transition-colors ${savedCourses.includes(course.id)
                                                        ? 'bg-yellow-400/15 text-yellow-400'
                                                        : 'text-bb-text-secondary hover:bg-bb-hover hover:text-yellow-400'
                                                        }`}
                                                    aria-label={savedCourses.includes(course.id) ? 'Quitar de cursos destacados' : 'Destacar curso primero'}
                                                    title={savedCourses.includes(course.id) ? 'Quitar de destacados' : 'Mostrar primero'}
                                                >
                                                    <Star className="h-3.5 w-3.5" fill={savedCourses.includes(course.id) ? 'currentColor' : 'none'} />
                                                </button>
                                            </div>
                                        </div>

                                        <h3 className="mt-1 min-h-8 line-clamp-2 text-xs font-bold leading-tight text-bb-text transition-colors group-hover:text-blue-400 md:mt-2 md:min-h-10 md:text-sm">
                                            {course.nombre}
                                        </h3>

                                        <div className="mt-1.5 block space-y-0.5 text-[10px] text-bb-text-secondary md:mt-2 md:space-y-1 md:text-xs">
                                            <div className="truncate">{course.facultad || 'Sin Facultad'}</div>
                                            <div>Ciclo {course.ciclo}</div>
                                        </div>

                                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-bb-border pt-2 md:pt-3">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="h-5 border-green-500/20 bg-green-500/10 px-1.5 text-[10px] text-green-500 md:h-6 md:px-2.5 md:text-xs">
                                                    Abierto
                                                </Badge>
                                            </div>
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 transition-colors group-hover:text-blue-400 md:text-xs">
                                                Ver curso
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {filteredCourses.length > currentPage * itemsPerPage && (
                            <div className="flex justify-center mb-8">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="bg-bb-card border-bb-border text-bb-text hover:bg-bb-hover"
                                >
                                    Cargar más cursos
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-bb-text-secondary text-lg">
                            {searchQuery ? 'No se encontraron cursos' : 'No hay cursos disponibles'}
                        </p>
                    </div>
                )
            }
        </div >
    );
}
