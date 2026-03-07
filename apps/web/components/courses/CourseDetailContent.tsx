'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, Mail, LayoutPanelLeft, FileText, FolderRoot, Users, Filter, Trash2, Pencil, Upload, List } from 'lucide-react';
import { motion } from 'framer-motion';
import { Course, Professor, getStorageUrl, supabase } from '@/lib/supabase';
import AdminMaterialManager from './AdminMaterialManager';
import { PLACEHOLDERS } from '@/lib/constants';
import SecureFileModal from '@/components/secure/SecureFileModal';
import MaterialCard from './MaterialCard';
import { Autocomplete } from '@/components/ui/Autocomplete';

type TabType = 'todos' | 'silabo' | 'presentaciones' | 'examenes' | 'enlaces' | 'otros';

interface CourseDetailContentProps {
    course: Course;
    topProfessor: any;
    allProfessors: any[];
    initialMaterials: any[];
    currentUser: any | null;
}

export default function CourseDetailContent({
    course,
    topProfessor,
    allProfessors,
    initialMaterials,
    currentUser
}: CourseDetailContentProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [materials, setMaterials] = useState<any[]>(initialMaterials);
    const [activeTab, setActiveTab] = useState<TabType>('todos');
    const [viewingFile, setViewingFile] = useState<{ path: string; name: string } | null>(null);
    const [selectedProfessorId, setSelectedProfessorId] = useState<string>(searchParams.get('professor') || 'all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showAdminManager, setShowAdminManager] = useState(false);

    // Sync state with url param
    useEffect(() => {
        const profId = searchParams.get('professor');
        if (profId) setSelectedProfessorId(profId);
    }, [searchParams]);

    // Sync state with props when Server Component re-renders
    useEffect(() => {
        setMaterials(initialMaterials);
    }, [initialMaterials]);

    const handleMaterialUploaded = () => {
        router.refresh();
    };

    const handleDeleteMaterial = async (material: any) => {
        const materialId = material.id;
        const materialUrl = material.url_archivo;
        const createdAt = new Date(material.created_at);
        const now = new Date();
        const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
        const isOwner = currentUser?.id === material.user_id;
        const within24h = diffHours < 24;

        if (!isAdmin && (!isOwner || !within24h)) {
            alert('No tienes permisos para eliminar este material o ya pasaron las 24 horas permitidas.');
            return;
        }

        if (!confirm('¿Estás seguro de que deseas eliminar este material? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            // Delete from storage
            const { deleteFileFromR2 } = await import('@/lib/r2-storage');
            await deleteFileFromR2('course-materials', materialUrl);

            // Delete thumbnail if exists
            if (material.thumbnail_url) {
                await deleteFileFromR2('thumbnails', material.thumbnail_url);
            }

            // Delete from database
            const { error: dbError } = await supabase
                .from('materials')
                .delete()
                .eq('id', materialId);

            if (dbError) throw dbError;

            // Optimistic UI update: Remove from local state immediately
            setMaterials(prev => prev.filter(m => m.id !== materialId));

            alert('Material eliminado exitosamente');
        } catch (error: any) {
            console.error('Error deleting material:', error);
            alert('Error al eliminar el material: ' + error.message);
        }
    };



    const handleEditCourse = () => {
        router.push(`/dashboard/courses/new?id=${course.id}`);
    };

    // Base materials list filtered ONLY by professor (for counts)
    const materialsForCounts = useMemo(() => {
        let results = materials || [];
        if (selectedProfessorId !== 'all') {
            results = results.filter(m => m.professor_id === selectedProfessorId);
        }
        return results;
    }, [materials, selectedProfessorId]);

    // Derived lists for COUNTS (stable across tabs)
    const syllabusCount = useMemo(() => {
        return materialsForCounts.filter(m =>
            m.tipo?.toLowerCase() === 'syllabus' ||
            (m.titulo || '').toLowerCase().includes('silabo') ||
            (m.titulo || '').toLowerCase().includes('sílabo')
        ).length;
    }, [materialsForCounts]);

    const presentacionesCount = useMemo(() => {
        return materialsForCounts.filter(m =>
            m.tipo?.toLowerCase().includes('ppt') || m.tipo?.toLowerCase().includes('presentacion')
        ).length;
    }, [materialsForCounts]);

    const examenesCount = useMemo(() => {
        return materialsForCounts.filter(m => m.tipo?.toLowerCase().includes('examen')).length;
    }, [materialsForCounts]);

    const enlacesCount = useMemo(() => {
        return materialsForCounts.filter(m => m.tipo === 'enlace').length;
    }, [materialsForCounts]);

    const otrosCount = useMemo(() => {
        return materialsForCounts.filter(m =>
            !m.tipo?.toLowerCase().includes('ppt') &&
            !m.tipo?.toLowerCase().includes('presentacion') &&
            !m.tipo?.toLowerCase().includes('examen') &&
            m.tipo !== 'syllabus' &&
            m.tipo !== 'enlace'
        ).length;
    }, [materialsForCounts]);

    // Filtered lists for DISPLAY (depends on active tab)
    const filteredMaterials = useMemo(() => {
        const base = materialsForCounts; // Already filtered by professor

        if (activeTab === 'silabo') {
            return base.filter(m =>
                m.tipo?.toLowerCase() === 'syllabus' ||
                (m.titulo || '').toLowerCase().includes('silabo') ||
                (m.titulo || '').toLowerCase().includes('sílabo')
            );
        }

        if (activeTab === 'todos') {
            // 'todos' tab logic: usually everything? 
            // Logic in original code was: 'todos' -> everything.
            // But let's check original lines 105-110. It returned everything.
            return base;
        }

        if (activeTab === 'presentaciones') {
            return base.filter(m => m.tipo?.toLowerCase().includes('ppt') || m.tipo?.toLowerCase().includes('presentacion'));
        }

        if (activeTab === 'examenes') {
            return base.filter(m => m.tipo?.toLowerCase().includes('examen'));
        }

        if (activeTab === 'enlaces') {
            return base.filter(m => m.tipo === 'enlace');
        }

        if (activeTab === 'otros') {
            return base.filter(m =>
                !m.tipo?.toLowerCase().includes('ppt') &&
                !m.tipo?.toLowerCase().includes('presentacion') &&
                !m.tipo?.toLowerCase().includes('examen') &&
                m.tipo !== 'syllabus' &&
                m.tipo !== 'enlace'
            );
        }

        return base;
    }, [materialsForCounts, activeTab]);

    // Find if there is a syllabus in materials as a fallback (more robust search)
    const syllabusMaterialForHeader = useMemo(() => {
        return materials?.find(m =>
            m.tipo?.toLowerCase() === 'syllabus' ||
            (m.titulo || '').toLowerCase().includes('silabo') ||
            (m.titulo || '').toLowerCase().includes('sílabo')
        );
    }, [materials]);

    const effectiveSyllabusUrl = course.syllabus_url || syllabusMaterialForHeader?.url_archivo;


    const tabs = [
        { id: 'todos' as TabType, label: '📂 Todo', count: materialsForCounts.length },
        { id: 'silabo' as TabType, label: '📖 Sílabo', count: syllabusCount },
        { id: 'presentaciones' as TabType, label: '📊 Presentaciones', count: presentacionesCount },
        { id: 'examenes' as TabType, label: '📝 Exámenes Pasados', count: examenesCount },
        { id: 'enlaces' as TabType, label: '🔗 Enlaces', count: enlacesCount },
        { id: 'otros' as TabType, label: '📚 Otros Recursos', count: otrosCount },
    ];

    const renderMaterialGrid = (mats: any[]) => {
        if (mats.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                    <FolderRoot className="w-12 h-12 mb-3" />
                    <p className="text-bb-text-secondary font-medium">Aún no hay materiales aquí</p>
                </div>
            );
        }

        if (viewMode === 'list') {
            return (
                <div className="space-y-4">
                    {mats.map((material) => (
                        <MaterialCard
                            key={material.id}
                            material={material}
                            viewMode="list"
                            onClick={() => {
                                if (material.tipo?.toLowerCase() === 'enlace') {
                                    window.open(material.url_archivo, '_blank');
                                } else {
                                    setViewingFile({ path: material.url_archivo, name: material.titulo });
                                }
                            }}
                            canDelete={
                                currentUser && (
                                    (currentUser.role === 'admin' || currentUser.role === 'superadmin') ||
                                    (material.user_id === currentUser.id && (new Date().getTime() - new Date(material.created_at).getTime()) / (1000 * 60 * 60) < 24)
                                )
                            }
                            onDelete={() => handleDeleteMaterial(material)}
                        />
                    ))}
                </div>
            );
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {mats.map((material) => (
                    <MaterialCard
                        key={material.id}
                        material={material}
                        viewMode="grid"
                        onClick={() => {
                            if (material.tipo?.toLowerCase() === 'enlace') {
                                window.open(material.url_archivo, '_blank');
                            } else {
                                setViewingFile({ path: material.url_archivo, name: material.titulo });
                            }
                        }}
                        canDelete={
                            currentUser && (
                                (currentUser.role === 'admin' || currentUser.role === 'superadmin') ||
                                (material.user_id === currentUser.id && (new Date().getTime() - new Date(material.created_at).getTime()) / (1000 * 60 * 60) < 24)
                            )
                        }
                        onDelete={() => handleDeleteMaterial(material)}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-auto bg-bb-dark">
            <div className="relative h-40 md:h-64 bg-bb-darker border-b border-bb-border">
                {course.imagen_url ? (
                    <img src={course.imagen_url} alt={course.nombre} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600/20 via-bb-darker to-teal-600/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-bb-dark/80 via-bb-dark/20 to-transparent" />
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-4 left-4 bg-bb-dark/50 border-bb-border hover:bg-bb-card text-white backdrop-blur-md"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>

                {currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 bg-bb-dark/50 border border-bb-border hover:bg-bb-card text-white backdrop-blur-md z-20"
                        onClick={handleEditCourse}
                        title="Editar curso completo"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="w-full px-4 sm:px-6 lg:px-10 py-6 md:py-10 max-w-[1600px] mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                    <div className="lg:col-span-3">
                        <div className="mb-10">
                            <div className="flex items-start justify-between mb-6 flex-wrap gap-6">
                                <div className="space-y-2">
                                    <p className="text-xs md:text-sm font-black text-blue-400 uppercase tracking-[0.2em]">
                                        {course.codigo}
                                    </p>
                                    <h1 className="text-3xl md:text-5xl font-bold text-bb-text leading-tight uppercase">{course.nombre}</h1>
                                </div>
                                <div className="flex flex-col items-end gap-5 shrink-0 pt-2">
                                    <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 font-black px-4 py-1.5 uppercase tracking-widest text-[10px]">Abierto</Badge>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs md:text-sm text-bb-text-secondary mb-10 font-medium">
                                <div><span className="text-bb-text/50">Facultad:</span> {course.facultad}</div>
                                <div><span className="text-bb-text/50">Ciclo:</span> {course.ciclo}</div>
                            </div>

                            {course.descripcion && <p className="text-bb-text-secondary leading-relaxed text-sm md:text-base mb-10">{course.descripcion}</p>}
                        </div>

                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                    <Filter className="w-4 h-4 text-blue-400" />
                                </div>
                                <h4 className="text-xs font-bold text-bb-text-secondary uppercase tracking-wider">Filtrar por profesor</h4>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Autocomplete
                                    items={allProfessors.map(p => p.nombre)}
                                    value={selectedProfessorId === 'all' ? '' : (allProfessors.find(p => p.id === selectedProfessorId)?.nombre || '')}
                                    onChange={(val) => {
                                        if (!val) {
                                            setSelectedProfessorId('all');
                                        } else {
                                            const prof = allProfessors.find(p => p.nombre === val);
                                            if (prof) setSelectedProfessorId(prof.id);
                                        }
                                    }}
                                    placeholder="Buscar por profesor..."
                                    className="w-full sm:w-80"
                                />
                                {selectedProfessorId !== 'all' && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => setSelectedProfessorId('all')}
                                        className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 h-11"
                                    >
                                        Limpiar Filtro
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="w-full">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
                                <div className="flex gap-1 border-b border-bb-border overflow-x-auto no-scrollbar flex-1 pb-px">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`px-3 md:px-4 py-3 font-bold text-[11px] md:text-sm transition-all relative whitespace-nowrap flex-1 sm:flex-none text-center ${activeTab === tab.id ? 'text-blue-400' : 'text-bb-text-secondary hover:text-bb-text'
                                                }`}
                                        >
                                            <span className="flex items-center justify-center gap-1.5 md:gap-2">
                                                {tab.label.split(' ')[1]}
                                                <span className={`text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded-md ${activeTab === tab.id ? 'bg-blue-500/20 text-blue-400' : 'bg-bb-darker text-bb-text-secondary'}`}>
                                                    {tab.count}
                                                </span>
                                            </span>
                                            {activeTab === tab.id && (
                                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></motion.div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 self-center sm:self-auto bg-bb-darker/50 p-1 rounded-xl border border-bb-border">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg' : 'text-bb-text-secondary hover:text-bb-text'}`}
                                        title="Vista Cuadrícula"
                                    >
                                        <LayoutPanelLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-bb-text-secondary hover:text-bb-text'}`}
                                        title="Vista Lista"
                                    >
                                        <List className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                </div>
                                <Link
                                    href={`/dashboard/courses/upload?courseId=${course.id}`}
                                    className="inline-flex items-center justify-center rounded-xl text-xs md:text-sm font-bold transition-all bg-blue-600 text-white hover:bg-blue-700 h-11 px-6 shadow-lg shadow-blue-600/20 active:scale-95 whitespace-nowrap"
                                >
                                    <div className="flex items-center gap-2">
                                        <Upload className="w-4 h-4" strokeWidth={2.5} />
                                        Subir Material
                                    </div>
                                </Link>
                            </div>

                            <div className="bg-bb-card p-4 md:p-6 rounded-2xl border border-bb-border shadow-sm">
                                {renderMaterialGrid(filteredMaterials)}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="sticky top-8 space-y-6">
                            {allProfessors.length > 0 ? (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-bb-text mb-2 flex items-center gap-2 px-1">
                                        <Users className="w-4 h-4 text-blue-400" /> Profesores del curso
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        {allProfessors.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)).map((prof) => (
                                            <Link
                                                key={prof.id}
                                                href={`/dashboard/professors/view?id=${prof.id}&course=${course.nombre}`}
                                                className={`group p-3 bg-bb-card rounded-2xl border transition-all hover:shadow-lg hover:shadow-blue-500/10 active:scale-95 ${selectedProfessorId === prof.id ? 'border-blue-500/50 bg-blue-500/5' : 'border-bb-border hover:border-blue-500/30'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="relative shrink-0">
                                                        <img
                                                            src={getStorageUrl(prof.avatar_url || '/profes/tl.webp', 'profile-avatars', PLACEHOLDERS.AVATAR)}
                                                            alt={prof.nombre}
                                                            className="w-12 h-12 rounded-xl object-cover border border-bb-border/50 shadow-sm transition-transform group-hover:scale-105"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '/profes/tl.webp';
                                                            }}
                                                        />
                                                        {prof.averageRating > 0 && (
                                                            <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-bb-dark text-[8px] font-black px-1 rounded-md border border-bb-dark">
                                                                {prof.averageRating.toFixed(1)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-sm text-bb-text truncate group-hover:text-blue-400 transition-colors">{prof.nombre}</p>
                                                        <p className="text-[10px] text-bb-text-secondary truncate mt-0.5">
                                                            {course.nombre}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-bb-card p-8 rounded-2xl border border-bb-border text-center">
                                    <div className="flex items-center gap-2">
                                        {currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowAdminManager(true)}
                                                className="h-8 w-8 p-0 rounded-full bg-bb-dark/50 border border-bb-border hover:bg-bb-card text-bb-text-secondary hover:text-white"
                                                title="Gestionar materiales (Admin)"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-bb-darker flex items-center justify-center mx-auto mb-3">
                                        <Users className="w-6 h-6 text-bb-text/20" />
                                    </div>
                                    <p className="text-bb-text-secondary text-sm font-medium">No hay profesores asignados</p>
                                    <p className="text-[10px] text-bb-text/30 mt-1 uppercase font-bold tracking-tighter">Sube material para vincular uno</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <SecureFileModal
                isOpen={!!viewingFile}
                onClose={() => setViewingFile(null)}
                filePath={viewingFile?.path || null}
                fileName={viewingFile?.name || null}
            />
            {/* Admin Manager Modal */}
            {showAdminManager && (
                <AdminMaterialManager
                    isOpen={showAdminManager}
                    onClose={() => setShowAdminManager(false)}
                    materials={materials}
                    allProfessors={allProfessors}
                    courseName={course.nombre}
                />
            )}
        </div>
    );
}

