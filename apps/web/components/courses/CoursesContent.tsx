'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Search, Plus, Trash2, Eye } from 'lucide-react';
import { supabase, Course, Profile } from '@/lib/supabase';
import { useDashboardData } from '@/lib/dashboard-data-context';
import { useProfile } from '@/lib/profile-context';
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
    const [selectedCycle, setSelectedCycle] = useState('todos');
    const [selectedFaculty, setSelectedFaculty] = useState('todos');
    const [savedCourses, setSavedCourses] = useState<string[]>([]);
    const [itemsPerPage] = useState(24);
    const [currentPage, setCurrentPage] = useState(1);
    const router = useRouter();
    const { removeCourse } = useDashboardData();

    // Sync local state when global state changes (e.g. from props)
    useEffect(() => {
        setCourses(initialCourses);
    }, [initialCourses]);

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

    const filteredCourses = courses.filter((course) => {
        const matchesSearch =
            course.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.codigo?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCycle = selectedCycle === 'todos' || course.ciclo?.toString() === selectedCycle;
        const matchesFaculty = selectedFaculty === 'todos' || course.facultad === selectedFaculty;

        return matchesSearch && matchesCycle && matchesFaculty;
    });

    const toggleSavedCourse = (courseId: string) => {
        setSavedCourses((prev) =>
            prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
        );
    };

    const cycles = Array.from(new Set(courses.map((c) => c.ciclo))).sort((a, b) => (a || 0) - (b || 0));

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
                                    className="group cursor-pointer overflow-hidden rounded-lg shadow-md glass-card transition-all hover:shadow-lg hover:border-blue-500/30 flex flex-col"
                                    onClick={() => router.push(`/dashboard/courses/view?id=${course.id}`)}
                                >
                                    <div className="relative h-28 md:h-40 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0">
                                        {course.imagen_url ? (
                                            <img
                                                src={course.imagen_url}
                                                alt={course.nombre}
                                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="h-full w-full bg-gradient-to-br from-blue-400 via-blue-500 to-teal-600 transition-transform group-hover:scale-105" />
                                        )}
                                    </div>

                                    <div className="p-2.5 md:p-4 flex flex-col flex-1 min-h-0">
                                        <span className="text-[10px] md:text-xs font-semibold text-bb-text-secondary uppercase truncate">
                                            {course.codigo}
                                        </span>

                                        <h3 className="mt-1 md:mt-2 line-clamp-2 text-xs md:text-sm font-bold text-bb-text group-hover:text-blue-400 transition-colors leading-tight">
                                            {course.nombre}
                                        </h3>

                                        <div className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-bb-text-secondary space-y-0.5 md:space-y-1 block">
                                            <div className="truncate">{course.facultad || 'Sin Facultad'}</div>
                                            {/* Ocultar ciclo en móvil muy pequeño si es necesario, o dejarlo */}
                                            <div>Ciclo {course.ciclo}</div>
                                        </div>

                                        <div className="mt-auto pt-2 md:pt-3 border-t border-bb-border flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] md:text-xs h-5 md:h-6 px-1.5 md:px-2.5">
                                                    Abierto
                                                </Badge>
                                                <div className="flex items-center gap-1 text-bb-text-secondary text-[10px] md:text-xs font-medium bg-bb-dark px-1.5 rounded-md border border-bb-border" title={`${course.views || 0} visualizaciones`}>
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>{course.views || 0}</span>
                                                </div>
                                                {profile?.role === 'admin' && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (confirm('¿Estás seguro de que quieres eliminar este curso?')) {
                                                                const { error } = await supabase.from('courses').delete().eq('id', course.id);
                                                                if (!error) {
                                                                    setCourses(prev => prev.filter(c => c.id !== course.id));
                                                                    removeCourse(course.id);
                                                                } else {
                                                                    alert('Error al eliminar curso');
                                                                }
                                                            }
                                                        }}
                                                        className="p-1 text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                                        title="Eliminar curso"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 md:gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleSavedCourse(course.id);
                                                    }}
                                                    className={`text-base md:text-lg transition-colors p-1 ${savedCourses.includes(course.id)
                                                        ? 'text-yellow-400'
                                                        : 'text-bb-text-secondary hover:text-yellow-400'
                                                        }`}
                                                    aria-label="Guardar curso"
                                                >
                                                    ★
                                                </button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/dashboard/courses/view?id=${course.id}`);
                                                    }}
                                                    className="text-blue-500 hover:bg-blue-500/10 hover:text-blue-400 text-[10px] md:text-xs h-7 md:h-9 px-2 hidden sm:inline-flex"
                                                >
                                                    Ver más
                                                </Button>
                                            </div>
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
