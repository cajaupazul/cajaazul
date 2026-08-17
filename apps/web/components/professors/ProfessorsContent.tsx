'use client';

import { memo, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BookOpen, ChevronDown, ChevronRight, ChevronUp, Star, Search, Plus, Trash2 } from 'lucide-react';
import { supabase, Professor, Profile, getStorageUrl } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/lib/dashboard-data-context';
import { useProfile } from '@/lib/profile-context';
import { PLACEHOLDERS, getProfessorLibraryBackground } from '@/lib/constants';
// Removed SyncProfessorsModal import
import DeleteProfessorModal from './DeleteProfessorModal';
import { Autocomplete } from '@/components/ui/Autocomplete';
import styles from './ProfessorCards.module.css';

interface ProfessorsContentProps {
    initialProfessors: any[];
    initialSavedProfessors: string[];
    profile: Profile | null;
}


const ProfessorBackground = memo(function ProfessorBackground({ name, specialty }: { name: string; specialty?: string | null }) {
    const [currentUrl, setCurrentUrl] = useState(() => getProfessorLibraryBackground(name, specialty));

    const handleError = () => {
        setCurrentUrl(PLACEHOLDERS.BACKGROUND);
    };

    return (
        <img
            src={currentUrl}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className={styles.backgroundImage}
            onError={handleError}
        />
    );
});

export default function ProfessorsContent({
    initialProfessors,
    initialSavedProfessors,
    profile
}: ProfessorsContentProps) {
    const { isGuest } = useProfile();
    const router = useRouter();
    const { removeProfessor } = useDashboardData();
    const [professors, setProfessors] = useState<any[]>(initialProfessors);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('all');
    const [sortBy, setSortBy] = useState('best');
    const [savedProfessors, setSavedProfessors] = useState<Set<string>>(new Set(initialSavedProfessors));
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [professorToDelete, setProfessorToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Pagination state
    const [itemsPerPage] = useState(24);
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedCourseLists, setExpandedCourseLists] = useState<Set<string>>(new Set());

    const toggleCourseList = (professorId: string) => {
        setExpandedCourseLists((current) => {
            const next = new Set(current);
            if (next.has(professorId)) next.delete(professorId);
            else next.add(professorId);
            return next;
        });
    };

    // Helper to normalize strings (remove accents, lowercase, trim)
    const normalizeString = (str: string) => {
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    };

    const isCleanMatch = (professorCourses: string[], targetCourse: string) => {
        if (!targetCourse || targetCourse === 'all') return true;

        // Use exact comparison after normalization but WITHOUT broad fuzzy logic
        const targetNorm = normalizeString(targetCourse);

        return professorCourses.some(course => {
            const courseNorm = normalizeString(course);

            // 1. Direct match
            if (courseNorm === targetNorm) return true;

            // 2. Exact match within a segmented string (comma separated)
            // This ensures "Matemáticas I, Física" matches "Matemáticas I" exactly
            const segments = courseNorm.split(/[,;|•]/).map(s => s.trim()).filter(Boolean);
            return segments.some(segment => normalizeString(segment) === targetNorm);
        });
    };

    const uniqueCourses = useMemo(() => {
        const courseMap = new Map<string, string>();
        professors.forEach(prof => {
            const addCourses = (courseStr: string | null | undefined) => {
                if (courseStr && courseStr !== 'General') {
                    const courses = courseStr.split(/[,;|•]/).map((s: string) => s.trim());
                    courses.forEach((c: string) => {
                        if (c && c.toLowerCase() !== 'general') {
                            const normalized = normalizeString(c);
                            if (!courseMap.has(normalized)) {
                                courseMap.set(normalized, c.toUpperCase());
                            }
                        }
                    });
                }
            };

            addCourses(prof.especialidad);
            addCourses(prof.otros_cursos);
        });

        const coursesArray = Array.from(courseMap.values()).sort();
        return coursesArray;
    }, [professors]);

    const handleDeleteClick = (prof: any) => {
        setProfessorToDelete(prof);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async (deleteMaterials: boolean) => {
        if (!professorToDelete) return;
        setIsDeleting(true);
        try {
            // 1. Delete comments
            await supabase.from('professor_comments').delete().eq('professor_id', professorToDelete.id);
            // 2. Delete stickers
            await supabase.from('user_decorations').delete().eq('target_type', 'professor').eq('target_id', professorToDelete.id);
            // 3. Delete ratings
            await supabase.from('professor_ratings').delete().eq('professor_id', professorToDelete.id);
            // 4. Optionally delete materials
            if (deleteMaterials) {
                await supabase.from('materials').delete().eq('professor_id', professorToDelete.id);
            } else {
                // If not deleted, nullify link so files aren't floating with invalid ID
                await supabase.from('materials').update({ professor_id: null }).eq('professor_id', professorToDelete.id);
            }
            // 5. Delete professor record
            const { error } = await supabase.from('professors').delete().eq('id', professorToDelete.id);

            if (!error) {
                setProfessors(prev => prev.filter(p => p.id !== professorToDelete.id));
                removeProfessor(professorToDelete.id);
                setDeleteModalOpen(false);
            } else {
                alert('Error al eliminar profesor');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsDeleting(false);
        }
    };

    const searchParams = useSearchParams();
    const courseParam = searchParams.get('course');

    // Sync local state when global state changes (e.g. from props)
    useEffect(() => {
        setProfessors(initialProfessors);
    }, [initialProfessors]);

    // Handle course parameter from URL
    useEffect(() => {
        if (courseParam) {
            const normalizedParam = courseParam.toLowerCase().trim();
            if (normalizedParam === 'all') {
                setSelectedCourse('all');
                return;
            }
            const match = uniqueCourses.find(c => c.toLowerCase().trim() === normalizedParam);
            if (match) {
                setSelectedCourse(match);
            }
        }
    }, [courseParam, uniqueCourses]);

    const filteredAndSortedProfessors = useMemo(() => {
        let result = professors.filter(prof => {
            const searchTerm = normalizeString(searchQuery);
            const matchesSearch = normalizeString(prof.nombre).includes(searchTerm);

            // Extract all courses from both primary specialty and extra courses
            const profCourses: string[] = [];
            if (prof.especialidad) profCourses.push(prof.especialidad);
            if (prof.otros_cursos) {
                prof.otros_cursos.split(',').forEach((c: string) => {
                    const trimmed = c.trim();
                    if (trimmed) profCourses.push(trimmed);
                });
            }

            const matchesCourse = selectedCourse === 'all' || isCleanMatch(profCourses, selectedCourse);
            return matchesSearch && matchesCourse;
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

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCourse, sortBy]);

    return (
        <div className={styles.page}>
            <div className={styles.pageInner}>
                <header className={styles.pageHeader}>
                    <div className={styles.headingCopy}>
                        <span>Comunidad académica</span>
                        <div className={styles.titleRow}>
                            <h1>Profesores</h1>
                            <small>{professors.length} perfiles</small>
                        </div>
                        <p>Encuentra experiencias por docente y curso.</p>
                    </div>
                </header>

                <section className={styles.toolbar} aria-label="Buscar y ordenar profesores">
                    <div className={styles.searchField}>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-500" />
                        </div>
                        <Input
                            placeholder="Buscar profesor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>

                    <Autocomplete
                        items={uniqueCourses}
                        value={selectedCourse === 'all' ? '' : selectedCourse}
                        onChange={(val) => setSelectedCourse(val || 'all')}
                        placeholder="Buscar curso..."
                        className={styles.courseFilter}
                    />

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className={styles.sortTrigger}>
                            <SelectValue placeholder="Ordenar por" />
                        </SelectTrigger>
                        <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                            <SelectItem value="best">Mejor calificados</SelectItem>
                            <SelectItem value="worst">Menor calificados</SelectItem>
                        </SelectContent>
                    </Select>

                    {!isGuest && (
                        <Button
                            onClick={() => router.push('/dashboard/professors/nuevo')}
                            className={styles.addButton}
                        >
                            <Plus aria-hidden="true" />
                            Agregar
                        </Button>
                    )}
                </section>

                {filteredAndSortedProfessors.length > 0 ? (
                    <>
                        <div className={styles.professorGrid}>
                            {filteredAndSortedProfessors.slice(0, currentPage * itemsPerPage).map((professor) => {
                                const catalogCourses = Array.isArray(professor.catalogCourses)
                                    ? professor.catalogCourses.filter((course: any) => course?.id && course?.nombre)
                                    : [];
                                const orderedCourses = [...catalogCourses].sort((courseA: any, courseB: any) => {
                                    if (selectedCourse === 'all') return courseA.nombre.localeCompare(courseB.nombre);
                                    const courseASelected = normalizeString(courseA.nombre) === normalizeString(selectedCourse);
                                    const courseBSelected = normalizeString(courseB.nombre) === normalizeString(selectedCourse);
                                    if (courseASelected === courseBSelected) return courseA.nombre.localeCompare(courseB.nombre);
                                    return courseASelected ? -1 : 1;
                                });
                                const isExpanded = expandedCourseLists.has(professor.id);
                                const visibleCourses = isExpanded ? orderedCourses : orderedCourses.slice(0, 3);
                                const remainingCourses = Math.max(0, orderedCourses.length - 3);
                                const hasRatings = (professor.ratingCount || 0) > 0;

                                return (
                                    <article key={professor.id} className={styles.professorCard}>
                                            <div className={styles.cardBanner}>
                                                <ProfessorBackground name={professor.nombre} specialty={professor.especialidad} />
                                                {profile?.role === 'admin' && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteClick(professor);
                                                        }}
                                                        className={styles.deleteProfessorButton}
                                                        title="Eliminar profesor"
                                                    >
                                                        <Trash2 aria-hidden="true" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className={styles.cardContent}>
                                                <div className={styles.avatar}>
                                                            <img
                                                                src={getStorageUrl(professor.avatar_url || '/profes/tl.webp', 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                                                alt={professor.nombre}
                                                                width={80}
                                                                height={80}
                                                                loading="lazy"
                                                                decoding="async"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = '/profes/tl.webp';
                                                                }}
                                                            />
                                                </div>

                                                <div
                                                    className={hasRatings ? styles.ratingAvailable : styles.ratingEmpty}
                                                    title={hasRatings
                                                        ? `Calificación general basada en ${professor.ratingCount} ${professor.ratingCount === 1 ? 'reseña' : 'reseñas'}`
                                                        : 'Este profesor todavía no tiene reseñas'}
                                                >
                                                    <Star aria-hidden="true" />
                                                    {hasRatings ? (
                                                        <>
                                                            <strong>{Number(professor.averageRating).toFixed(1)}</strong>
                                                            <span>· {professor.ratingCount}</span>
                                                        </>
                                                    ) : (
                                                        <span>Sin reseñas</span>
                                                    )}
                                                </div>

                                                <div className={styles.professorIdentity}>
                                                        <h3 title={professor.nombre}>
                                                            {professor.nombre}
                                                        </h3>
                                                        <p>{orderedCourses.length} {orderedCourses.length === 1 ? 'curso asignado' : 'cursos asignados'}</p>
                                                </div>

                                                <div className={styles.courseSection}>
                                                    <div className={styles.courseSectionHeader}>
                                                        <span>Cursos que enseña</span>
                                                    </div>

                                                    <div className={styles.courseList}>
                                                        {visibleCourses.length > 0 ? visibleCourses.map((course: any) => {
                                                            const isSelectedCourse = selectedCourse !== 'all'
                                                                && normalizeString(course.nombre) === normalizeString(selectedCourse);
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={course.id}
                                                                    className={`${styles.courseButton} ${isSelectedCourse ? styles.courseButtonSelected : ''}`}
                                                                    onClick={() => router.push(`/dashboard/professors/${professor.id}/${course.id}`)}
                                                                    title={`Ver a ${professor.nombre} en ${course.nombre}`}
                                                                >
                                                                    <BookOpen aria-hidden="true" />
                                                                    <span>{course.nombre}</span>
                                                                    <ChevronRight aria-hidden="true" />
                                                                </button>
                                                            );
                                                        }) : (
                                                            <div className={styles.noCourses}>Sin cursos asignados</div>
                                                        )}
                                                    </div>

                                                    <div className={styles.moreCoursesSlot}>
                                                        {remainingCourses > 0 && (
                                                            <button
                                                                type="button"
                                                                className={styles.moreCoursesButton}
                                                                onClick={() => toggleCourseList(professor.id)}
                                                                aria-expanded={isExpanded}
                                                            >
                                                                {isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                                                                <span>{isExpanded ? 'Mostrar solo 3 cursos' : `Ver ${remainingCourses} ${remainingCourses === 1 ? 'curso más' : 'cursos más'}`}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                    </article>
                                );
                            })}
                        </div>
                        
                        {filteredAndSortedProfessors.length > currentPage * itemsPerPage && (
                            <div className="flex justify-center mb-8">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="bg-bb-card border-bb-border text-bb-text hover:bg-bb-hover"
                                >
                                    Cargar más profesores
                                </Button>
                            </div>
                        )}
                    </>
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
                        {!searchQuery && !isGuest && (
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

            <DeleteProfessorModal
                open={deleteModalOpen}
                onOpenChange={setDeleteModalOpen}
                onConfirm={confirmDelete}
                professorName={professorToDelete?.nombre || ''}
                isDeleting={isDeleting}
            />
        </div>
    );
}
