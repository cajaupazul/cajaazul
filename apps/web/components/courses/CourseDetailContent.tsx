'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, Mail, LayoutPanelLeft, FileText, FolderRoot, Users, Filter, Trash2, Pencil, Upload, List, Calculator, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Course, Professor, getStorageUrl, supabase } from '@/lib/supabase';
import { extractPathFromUrl, getFileFromR2 } from '@/lib/r2-storage';
import AdminMaterialManager from './AdminMaterialManager';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';
import { PLACEHOLDERS } from '@/lib/constants';
import SecureFileModal from '@/components/secure/SecureFileModal';
import MaterialCard from './MaterialCard';
import { Accordion, AccordionItem } from '@/components/ui/accordion';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CourseDetailContentProps {
    course: Course;
    topProfessor: any;
    allProfessors: any[];
    initialMaterials: any[];
    currentUser: any | null;
    initialCourseCycles: any[];
}

export default function CourseDetailContent({
    course,
    topProfessor,
    allProfessors,
    initialMaterials,
    initialCourseCycles
}: CourseDetailContentProps) {
    const { profile: currentUser, isGuest } = useProfile();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [materials, setMaterials] = useState<any[]>(initialMaterials);
    const [courseCycles, setCourseCycles] = useState<any[]>(initialCourseCycles);
    
    // UI state for Add Cycle Modal
    const [showAddCycleModal, setShowAddCycleModal] = useState(false);
    const [selectedCycleToAdd, setSelectedCycleToAdd] = useState(() => {
        const d = new Date();
        const m = d.getMonth();
        return `${d.getFullYear()}-${m < 3 ? 0 : m < 7 ? 1 : 2}`;
    });
    const [isSavingCycle, setIsSavingCycle] = useState(false);
    
    // UI state for Add Subfolder Modal
    const [showAddSubfolderModal, setShowAddSubfolderModal] = useState(false);
    const [cycleToEdit, setCycleToEdit] = useState<any>(null);
    const [selectedSubfolderToAdd, setSelectedSubfolderToAdd] = useState('');
    const [isSavingSubfolder, setIsSavingSubfolder] = useState(false);

    const [viewingFile, setViewingFile] = useState<{ path: string; name: string; useAdvanced?: boolean } | null>(null);
    const [selectedProfessorId, setSelectedProfessorId] = useState<string>(searchParams.get('professor') || 'all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showAdminManager, setShowAdminManager] = useState(false);
    const [showCalculatorModal, setShowCalculatorModal] = useState(false);

    // Mass Move State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [targetCycleId, setTargetCycleId] = useState<string | null>('historical');
    const [targetSubfolder, setTargetSubfolder] = useState<string>('');
    const [isMovingFiles, setIsMovingFiles] = useState(false);

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

    // Generates cycles from 2020 up to current year
    const availableCycleOptions = useMemo(() => {
        const options = [];
        const currentYear = new Date().getFullYear();
        for (let year = 2020; year <= currentYear; year++) {
            for (let period = 0; period <= 2; period++) {
                options.push(`${year}-${period}`);
            }
        }
        return options;
    }, []);

    const handleAddCycle = async () => {
        if (!selectedCycleToAdd) {
            alert('Por favor selecciona un ciclo');
            return;
        }

        const currentYear = new Date().getFullYear();
        const [year] = selectedCycleToAdd.split('-').map(Number);
        
        if (year > currentYear) {
            alert('No se pueden crear ciclos de años futuros');
            return;
        }

        if (courseCycles.some(c => c.ciclo_name === selectedCycleToAdd)) {
            alert('Este ciclo ya fue creado para este curso');
            return;
        }

        try {
            setIsSavingCycle(true);
            const newCycle = {
                course_id: course.id,
                ciclo_name: selectedCycleToAdd,
                created_by: currentUser?.id || null
            };

            const { data, error } = await supabase
                .from('course_cycles')
                .insert(newCycle)
                .select()
                .single();

            if (error) throw error;

            setCourseCycles(prev => [data, ...prev].sort((a, b) => b.ciclo_name.localeCompare(a.ciclo_name)));
            setShowAddCycleModal(false);
            setSelectedCycleToAdd('');
        } catch (error: any) {
            console.error('Error adding cycle:', error);
            alert('Error al agregar el ciclo: ' + error.message);
        } finally {
            setIsSavingCycle(false);
        }
    };

    const handleMassMove = async () => {
        if (selectedMaterialIds.length === 0) return;
        if (targetCycleId !== 'historical' && !targetSubfolder) {
            alert('Por favor selecciona una subcarpeta de destino');
            return;
        }

        try {
            setIsMovingFiles(true);
            const targetCycleUuid = targetCycleId === 'historical' ? null : targetCycleId;
            const targetTipo = targetCycleId === 'historical' ? targetSubfolder /* Actually for historical it keeps original or we should just reset? Wait, let's keep original if subfolder is empty */ : targetSubfolder;

            // En caso de Archivos Históricos, user might want to let it keep current tipo, so we just set targetCycleUuid to null. 
            // We'll update cycle_id. If targetCycleId != 'historical', we also update tipo.
            const updatePayload: any = { cycle_id: targetCycleUuid };
            if (targetCycleUuid) {
                updatePayload.tipo = targetTipo;
            }

            const { error } = await supabase
                .from('materials')
                .update(updatePayload)
                .in('id', selectedMaterialIds);

            if (error) throw error;

            // Optimistically update the UI
            setMaterials(prev => prev.map(m => {
                if (selectedMaterialIds.includes(m.id)) {
                    return { ...m, ...updatePayload };
                }
                return m;
            }));

            // Reset Selection Mode
            setIsSelectionMode(false);
            setSelectedMaterialIds([]);
            setShowMoveModal(false);
            setTargetCycleId('historical');
            setTargetSubfolder('');
            alert(`${selectedMaterialIds.length} archivos movidos exitosamente`);
        } catch (error: any) {
            console.error('Error al mover archivos:', error);
            alert('Error al mover los archivos: ' + error.message);
        } finally {
            setIsMovingFiles(false);
        }
    };

    const PREDEFINED_SUBFOLDERS = [
        '📖 Sílabo y Cronograma',
        '📝 Exámenes',
        '📊 Presentaciones y Diapositivas',
        '🔗 Enlaces Útiles',
        '📚 Otros Recursos'
    ];

    const handleAddSubfolder = async () => {
        if (!selectedSubfolderToAdd || !cycleToEdit) {
            alert('Por favor selecciona una subcarpeta');
            return;
        }

        const currentSubfolders = cycleToEdit.active_subfolders || [];
        if (currentSubfolders.includes(selectedSubfolderToAdd)) {
            alert('Esta subcarpeta ya existe en este ciclo');
            return;
        }

        try {
            setIsSavingSubfolder(true);
            const newSubfolders = [...currentSubfolders, selectedSubfolderToAdd];
            
            const { error, data } = await supabase
                .from('course_cycles')
                .update({ active_subfolders: newSubfolders })
                .eq('id', cycleToEdit.id)
                .select()
                .single();

            if (error) throw error;

            setCourseCycles(prev => prev.map(c => c.id === cycleToEdit.id ? data : c));
            setShowAddSubfolderModal(false);
            setSelectedSubfolderToAdd('');
            setCycleToEdit(null);
        } catch (error: any) {
            console.error('Error adding subfolder:', error);
            alert('Error al agregar la carpeta: ' + error.message);
        } finally {
            setIsSavingSubfolder(false);
        }
    };



    const handleEditCourse = () => {
        router.push(`/dashboard/courses/new?id=${course.id}`);
    };


    // Base materials list filtered ONLY by professor (for counts)
    const materialsForCounts = useMemo(() => {
        let results = materials || [];
        if (selectedProfessorId !== 'all') {
            // Include materials from the selected professor OR those marked as General (null)
            results = results.filter(m => m.professor_id === selectedProfessorId || m.professor_id === null);
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

    const handleToggleSelect = (id: string) => {
        setSelectedMaterialIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const renderMaterialGrid = (mats: any[]) => {
        if (mats.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                    <FolderRoot className="w-12 h-12 mb-3 text-bb-text-secondary" />
                    <p className="text-bb-text-secondary font-medium">Aún no hay materiales en esta carpeta</p>
                </div>
            );
        }

        const handleMaterialClick = async (material: any) => {
            if (material.tipo?.toLowerCase() === 'enlace') {
                window.open(material.url_archivo, '_blank');
                return;
            }

            const isExcel = material.url_archivo.toLowerCase().match(/\.(xls|xlsx|csv)$/i);
            if (isExcel) {
                try {
                    // Start download process
                    const path = extractPathFromUrl(material.url_archivo, 'course-materials');
                    const blob = await getFileFromR2('course-materials', path);
                    
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const extension = material.url_archivo.split('.').pop();
                    a.href = url;
                    a.download = `${material.titulo}.${extension}`;
                    document.body.appendChild(a);
                    a.click();
                    
                    // Cleanup
                    setTimeout(() => {
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }, 100);
                } catch (err: any) {
                    console.error('Error al descargar Excel:', err);
                    alert('Error al descargar el archivo: ' + err.message);
                }
                return;
            }

            // Normal file (PDF, PPTX, Docx, Image) -> open in SecureFileViewer
            setViewingFile({
                path: material.url_archivo,
                name: material.titulo,
                useAdvanced: material.use_advanced_viewer
            });
        };

        if (viewMode === 'list') {
            return (
                <div className="space-y-4">
                    {mats.map((material) => (
                        <MaterialCard
                            key={material.id}
                            material={material}
                            viewMode="list"
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedMaterialIds.includes(material.id)}
                            onSelect={() => handleToggleSelect(material.id)}
                            onClick={() => handleMaterialClick(material)}
                            canDelete={
                                !!currentUser && (
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
            <div className={`grid ${viewMode === 'grid' 
                ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4' 
                : 'grid-cols-1 gap-1 sm:gap-2'}`}>
                {mats.map((material) => (
                    <MaterialCard
                        key={material.id}
                        material={material}
                        viewMode={viewMode}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedMaterialIds.includes(material.id)}
                        onSelect={() => handleToggleSelect(material.id)}
                        onClick={() => handleMaterialClick(material)}
                        canDelete={
                            !!currentUser && (
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

        const categories = [
            { id: 'silabo', label: '📖 Sílabo y Cronograma', items: [] as any[] },
            { id: 'examenes', label: '📝 Exámenes', items: [] as any[] },
            { id: 'presentaciones', label: '📊 Presentaciones y Diapositivas', items: [] as any[] },
            { id: 'enlaces', label: '🔗 Enlaces Útiles', items: [] as any[] },
            { id: 'otros', label: '📚 Otros Recursos', items: [] as any[] },
        ];

        // Archivos Históricos (sin ciclo)
        const historicalMaterials = materialsForCounts.filter(m => !m.cycle_id);
        historicalMaterials.forEach(m => {
            if (m.tipo?.toLowerCase() === 'syllabus' || (m.titulo || '').toLowerCase().includes('silabo') || (m.titulo || '').toLowerCase().includes('sílabo')) {
                categories[0].items.push(m);
            } else if (m.tipo?.toLowerCase().includes('examen')) {
                categories[1].items.push(m);
            } else if (m.tipo?.toLowerCase().includes('ppt') || m.tipo?.toLowerCase().includes('presentacion')) {
                categories[2].items.push(m);
            } else if (m.tipo === 'enlace') {
                categories[3].items.push(m);
            } else {
                categories[4].items.push(m);
            }
        });

        // Archivos en Ciclos
        const cycleMaterialsMap = new Map<string, any[]>();
        materialsForCounts.filter(m => !!m.cycle_id).forEach(m => {
            const arr = cycleMaterialsMap.get(m.cycle_id) || [];
            arr.push(m);
            cycleMaterialsMap.set(m.cycle_id, arr);
        });

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
                                <div className="flex flex-1 items-center gap-2">
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
                                        className="flex-1 sm:w-80"
                                    />
                                    {/* V6.0: Calculadora integrada en móvil junto al buscador */}
                                    <button
                                        onClick={() => setShowCalculatorModal(true)}
                                        className="sm:hidden p-3 bg-bb-darker/50 border border-bb-border rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 h-11 transition-all active:scale-95"
                                        title="Calculadora de Notas"
                                    >
                                        <Calculator className="w-5 h-5 flex-shrink-0" />
                                    </button>
                                </div>
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
                            <div className="flex flex-col sm:flex-row items-stretch justify-between gap-4 mb-6">
                                <div className="flex-1 flex flex-col justify-center">
                                    <h3 className="text-xl md:text-2xl font-black text-bb-text tracking-tight uppercase flex items-center gap-3">
                                        <FolderRoot className="w-6 h-6 text-blue-500" />
                                        Estructura del Curso
                                    </h3>
                                    <p className="text-xs text-bb-text-secondary mt-1 font-medium">Navega por las carpetas para encontrar el material</p>
                                </div>
                                <div className="flex items-center justify-end gap-2 sm:gap-3 self-center sm:self-auto w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                                    <div className="flex items-center gap-1 sm:gap-2 bg-bb-darker/50 p-1 rounded-xl border border-bb-border flex-shrink-0">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1.5 sm:p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg' : 'text-bb-text-secondary hover:text-bb-text'}`}
                                            title="Vista Cuadrícula"
                                        >
                                            <LayoutPanelLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-1.5 sm:p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-bb-text-secondary hover:text-bb-text'}`}
                                            title="Vista Lista"
                                        >
                                            <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                                        </button>
                                    </div>
                                    
                                    {currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
                                        <button
                                            onClick={() => {
                                                setIsSelectionMode(!isSelectionMode);
                                                setSelectedMaterialIds([]);
                                            }}
                                            className={`inline-flex items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all h-10 sm:h-11 px-3 sm:px-4 active:scale-95 whitespace-nowrap flex-shrink-0 ${isSelectionMode ? 'bg-blue-600 text-white shadow-blue-500/20 shadow-lg' : 'bg-bb-border/50 text-bb-text-secondary hover:text-white hover:bg-bb-card border border-transparent hover:border-bb-border'}`}
                                        >
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                <span className="hidden xs:inline">{isSelectionMode ? 'Cancelar Selección' : 'Seleccionar Archivos'}</span>
                                                <span className="xs:hidden">{isSelectionMode ? 'Cancelar' : 'Seleccionar'}</span>
                                            </div>
                                        </button>
                                    )}

                                    {!isGuest && (
                                        <button
                                            onClick={() => setShowAddCycleModal(true)}
                                            className="inline-flex items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all bg-bb-border text-bb-text hover:bg-bb-card border border-transparent hover:border-bb-border h-10 sm:h-11 px-3 sm:px-4 active:scale-95 whitespace-nowrap flex-shrink-0"
                                        >
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <FolderRoot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                <span>+ Ciclo</span>
                                            </div>
                                        </button>
                                    )}
                                    {!isGuest && (
                                        <Link
                                            href={`/dashboard/courses/upload?courseId=${course.id}`}
                                            className="inline-flex items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all bg-blue-600 text-white hover:bg-blue-700 h-10 sm:h-11 px-3 sm:px-5 shadow-lg shadow-blue-600/20 active:scale-95 whitespace-nowrap flex-shrink-0"
                                        >
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                                                Subir
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Accordion>
                                    
                                    {/* Mapped Explicit Course Cycles */}
                                    {courseCycles.map((cycle) => (
                                        <AccordionItem 
                                            key={cycle.id || cycle.ciclo_name}
                                            title={
                                                <div className="flex items-center justify-between w-full">
                                                    <span>📁 Ciclo {cycle.ciclo_name}</span>
                                                    <Badge className="ml-4 bg-teal-500/10 border border-teal-500/20 text-teal-400 font-black">
                                                        {(cycleMaterialsMap.get(cycle.id) || []).length}
                                                    </Badge>
                                                </div>
                                            }
                                        >
                                            {/* V6.1: Nested mapped Subfolders permanently rendered */}
                                            <Accordion className="space-y-1 pl-1 md:pl-4">
                                                {PREDEFINED_SUBFOLDERS.map((mainFolder: string) => {
                                                    const matchedMats = (cycleMaterialsMap.get(cycle.id) || []).filter(m => m.tipo === mainFolder);
                                                    const isExams = mainFolder === '📝 Exámenes';
                                                    const customSubfolders = isExams ? (cycle.active_subfolders || []).filter((s: string) => !PREDEFINED_SUBFOLDERS.includes(s)) : [];

                                                    let totalCount = matchedMats.length;
                                                    if (isExams) {
                                                        customSubfolders.forEach((sub: string) => {
                                                            totalCount += (cycleMaterialsMap.get(cycle.id) || []).filter(m => m.tipo === sub).length;
                                                        });
                                                    }

                                                    return (
                                                        <AccordionItem key={mainFolder} variant="minimal" title={
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="text-sm font-bold text-bb-text/90 tracking-tight">{mainFolder}</span>
                                                                <Badge className="ml-4 bg-blue-500/10 text-blue-400 border border-blue-500/10 font-black text-[9px] py-0 px-1.5 h-5">
                                                                    {totalCount}
                                                                </Badge>
                                                            </div>
                                                        }>
                                                            {matchedMats.length > 0 && renderMaterialGrid(matchedMats)}
                                                            {matchedMats.length === 0 && (!isExams || customSubfolders.length === 0) && (
                                                                <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
                                                                    <FolderRoot className="w-8 h-8 mb-2 text-bb-text-secondary" />
                                                                    <p className="text-xs text-bb-text-secondary font-medium">Vacío</p>
                                                                </div>
                                                            )}

                                                            {isExams && customSubfolders.length > 0 && (
                                                                <div className="mt-2 border-l border-bb-border/30 pl-2 space-y-1">
                                                                     <Accordion className="space-y-1">
                                                                        {customSubfolders.map((sub: string) => {
                                                                            const subMats = (cycleMaterialsMap.get(cycle.id) || []).filter(m => m.tipo === sub);
                                                                            return (
                                                                                <AccordionItem key={sub} variant="ghost" title={
                                                                                    <div className="flex items-center justify-between w-full">
                                                                                        <span className="text-xs font-bold text-bb-text/70 uppercase tracking-tighter flex items-center gap-2">
                                                                                            <span className="text-blue-500/50">↳</span> {sub}
                                                                                        </span>
                                                                                        <Badge className="ml-4 bg-teal-500/10 text-teal-400 border border-teal-500/10 font-black text-[8px] py-0 px-1.5 h-4">{subMats.length}</Badge>
                                                                                    </div>
                                                                                }>
                                                                                    {subMats.length > 0 ? renderMaterialGrid(subMats) : (
                                                                                        <div className="text-center py-4 opacity-40 text-xs">Vacío</div>
                                                                                    )}
                                                                                </AccordionItem>
                                                                            )
                                                                        })}
                                                                     </Accordion>
                                                                </div>
                                                            )}

                                                            {isExams && currentUser && !isGuest && (currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
                                                                <div className="mt-4 flex justify-end">
                                                                    <button
                                                                        onClick={() => {
                                                                            setCycleToEdit(cycle);
                                                                            setShowAddSubfolderModal(true);
                                                                        }}
                                                                        className="inline-flex items-center justify-center rounded-xl text-xs font-bold transition-all bg-bb-border/50 text-bb-text-secondary hover:text-white hover:bg-bb-card border border-transparent hover:border-bb-border h-9 px-4 active:scale-95 whitespace-nowrap"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <FolderRoot className="w-3.5 h-3.5" />
                                                                            + Evaluación (PC, Parcial...)
                                                                        </div>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </AccordionItem>
                                                    );
                                                })}
                                            </Accordion>
                                        </AccordionItem>
                                    ))}

                                    <AccordionItem title={
                                        <div className="flex items-center justify-between w-full">
                                            <span>📦 Archivos Históricos (Sin Clasificar)</span>
                                            <Badge className="ml-4 bg-bb-dark border border-bb-border text-bb-text-secondary font-black">
                                                {historicalMaterials.length}
                                            </Badge>
                                        </div>
                                    } defaultOpen={courseCycles.length === 0}>
                                        
                                        <Accordion className="space-y-1">
                                            {categories.map((cat) => (
                                                <AccordionItem 
                                                    key={cat.id} 
                                                    variant="minimal"
                                                    title={
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className="text-sm font-bold text-bb-text/90 tracking-tight">{cat.label}</span>
                                                            <Badge className="ml-4 bg-blue-500/10 text-blue-400 border border-blue-500/10 font-black text-[9px] py-0 px-1.5 h-5">
                                                                {cat.items.length}
                                                            </Badge>
                                                        </div>
                                                    } 
                                                    defaultOpen={cat.id === 'silabo' && courseCycles.length === 0}
                                                >
                                                    {renderMaterialGrid(cat.items)}
                                                </AccordionItem>
                                            ))}
                                        </Accordion>

                                    </AccordionItem>
                                </Accordion>
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
                                        <button
                                            onClick={() => setSelectedProfessorId(selectedProfessorId === 'none' ? 'all' : 'none')}
                                            className={`group p-3 bg-bb-card rounded-2xl border transition-all hover:shadow-lg hover:shadow-blue-500/10 active:scale-95 text-left w-full ${selectedProfessorId === 'none' ? 'border-blue-500/50 bg-blue-500/5' : 'border-bb-border hover:border-blue-500/30'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-bb-border/50 flex items-center justify-center transition-transform group-hover:scale-105">
                                                    <FolderRoot className="w-6 h-6 text-blue-400" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-sm text-bb-text truncate group-hover:text-blue-400 transition-colors">Material General / Todo</p>
                                                    <p className="text-[10px] text-bb-text-secondary truncate mt-0.5 uppercase tracking-tighter font-black">
                                                        Recursos comunes
                                                    </p>
                                                </div>
                                            </div>
                                        </button>

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
                                                        <p className="text-[10px] text-bb-text-secondary truncate mt-0.5 font-medium">
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
                useAdvancedViewer={viewingFile?.useAdvanced}
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

            {/* V6.0: Modal para Agregar Ciclo */}
            <AnimatePresence>
                {showAddCycleModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddCycleModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-bb-card border border-bb-border p-6 md:p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-auto"
                        >
                            <div className="flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-xl mb-5 border border-blue-500/20">
                                <FolderRoot className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-bb-text mb-2 tracking-tight">Agregar Nuevo Ciclo</h3>
                            <p className="text-xs text-bb-text-secondary leading-relaxed mb-6">
                                Abre una carpeta de ciclo para este curso seleccionándolo del listado disponible.
                            </p>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-wider mb-2">Seleccionar Ciclo</label>
                                <Select value={selectedCycleToAdd} onValueChange={setSelectedCycleToAdd}>
                                    <SelectTrigger className="w-full bg-bb-dark border border-bb-border rounded-xl px-4 py-3 h-12 text-sm text-bb-text focus:outline-none focus:border-blue-500 shadow-none">
                                        <SelectValue placeholder="Elige un ciclo (Ej: 2026-1)" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-bb-dark border border-bb-border text-bb-text rounded-xl shadow-xl max-h-60">
                                        {availableCycleOptions.map(opt => (
                                            <SelectItem key={opt} value={opt} className="hover:bg-bb-card focus:bg-bb-card cursor-pointer py-2">
                                                {opt}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setShowAddCycleModal(false)}
                                    variant="ghost"
                                    className="flex-1 rounded-xl text-bb-text-secondary hover:text-bb-text hover:bg-bb-dark"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleAddCycle}
                                    disabled={isSavingCycle || !selectedCycleToAdd}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSavingCycle ? 'Guardando...' : 'Crear Carpeta'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* V6.0: Modal para Agregar Subcarpeta */}
            <AnimatePresence>
                {showAddSubfolderModal && cycleToEdit && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddSubfolderModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-bb-card border border-bb-border p-6 md:p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-auto"
                        >
                            <div className="flex items-center justify-center w-12 h-12 bg-teal-500/10 rounded-xl mb-5 border border-teal-500/20">
                                <FolderRoot className="w-6 h-6 text-teal-400" />
                            </div>
                            <h3 className="text-xl font-bold text-bb-text mb-2 tracking-tight">Agregar Evaluación</h3>
                            <p className="text-xs text-bb-text-secondary leading-relaxed mb-6">
                                Agrega una nueva sub-carpeta de evaluación dentro de la sección <strong className="text-teal-400">Exámenes</strong> del Ciclo {cycleToEdit.ciclo_name}.
                            </p>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-wider mb-2">Seleccionar Evaluación</label>
                                <Select value={selectedSubfolderToAdd} onValueChange={setSelectedSubfolderToAdd}>
                                    <SelectTrigger className="w-full bg-bb-dark border border-bb-border rounded-xl px-4 py-3 h-12 text-sm text-bb-text focus:outline-none focus:border-blue-500 shadow-none">
                                        <SelectValue placeholder="Elige un tipo de evaluación" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-bb-dark border border-bb-border text-bb-text rounded-xl shadow-xl">
                                        {['PC 1', 'PC 2', 'PC 3', 'PC 4', 'PC 5', 'Examen Parcial', 'Examen Final', 'Examen Sustitutorio'].map(opt => (
                                            <SelectItem 
                                                key={opt} 
                                                value={opt} 
                                                disabled={cycleToEdit.active_subfolders?.includes(opt)}
                                                className="hover:bg-bb-card focus:bg-bb-card cursor-pointer py-2 data-[disabled]:opacity-40"
                                            >
                                                {opt}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setShowAddSubfolderModal(false)}
                                    variant="ghost"
                                    className="flex-1 rounded-xl text-bb-text-secondary hover:text-bb-text hover:bg-bb-dark"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleAddSubfolder}
                                    disabled={isSavingSubfolder || !selectedSubfolderToAdd}
                                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSavingSubfolder ? 'Creando...' : 'Crear Subcarpeta'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* V6.0: Floating Selection Action Bar */}
            <AnimatePresence>
                {isSelectionMode && selectedMaterialIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-bb-card border border-blue-500/50 shadow-2xl shadow-blue-500/20 px-6 py-4 rounded-3xl flex items-center gap-6"
                    >
                        <span className="text-white font-bold whitespace-nowrap">{selectedMaterialIds.length} archivos seleccionados</span>
                        <div className="flex items-center gap-3 border-l border-bb-border/50 pl-6 shrink-0">
                            <Button variant="ghost" className="text-bb-text-secondary hover:text-white hover:bg-bb-darker rounded-xl text-xs font-bold" onClick={() => setSelectedMaterialIds([])}>Desmarcar todos</Button>
                            <Button className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 px-6 h-10" onClick={() => setShowMoveModal(true)}>
                                Mover a Carpeta
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* V6.0: Modal Mover Archivos */}
            <AnimatePresence>
                {showMoveModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMoveModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-bb-card border border-bb-border p-6 md:p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-auto"
                        >
                            <div className="flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-xl mb-5 border border-blue-500/20">
                                <FolderRoot className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-bb-text mb-2 tracking-tight">Mover {selectedMaterialIds.length} Archivos</h3>
                            <p className="text-xs text-bb-text-secondary leading-relaxed mb-6">
                                Selecciona el ciclo y subcarpeta destino para los archivos seleccionados.
                            </p>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-wider mb-2">Destino / Ciclo</label>
                                    <Select value={targetCycleId || 'historical'} onValueChange={(v) => {
                                        setTargetCycleId(v);
                                        setTargetSubfolder('');
                                    }}>
                                        <SelectTrigger className="w-full bg-bb-dark border border-bb-border rounded-xl px-4 py-3 h-12 text-sm text-bb-text focus:outline-none focus:border-blue-500 shadow-none">
                                            <SelectValue placeholder="Selecciona un origen" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-bb-dark border border-bb-border text-bb-text rounded-xl shadow-xl max-h-60">
                                            <SelectItem value="historical" className="hover:bg-bb-card focus:bg-bb-card cursor-pointer py-2">
                                                📦 Archivos Históricos (Raíz)
                                            </SelectItem>
                                            {courseCycles.map(c => (
                                                <SelectItem key={c.id} value={c.id} className="hover:bg-bb-card focus:bg-bb-card cursor-pointer py-2">
                                                    📁 Ciclo {c.ciclo_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {targetCycleId !== 'historical' && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                                        <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-wider mb-2">Sección o Carpeta</label>
                                        <Select value={targetSubfolder} onValueChange={setTargetSubfolder}>
                                            <SelectTrigger className="w-full bg-bb-dark border border-bb-border rounded-xl px-4 py-3 h-12 text-sm text-bb-text focus:outline-none focus:border-blue-500 shadow-none">
                                                <SelectValue placeholder="Selecciona una sección..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-bb-dark border border-bb-border text-bb-text rounded-xl shadow-xl max-h-60">
                                                {PREDEFINED_SUBFOLDERS.map((sub: string) => (
                                                    <SelectItem key={sub} value={sub} className={`focus:bg-bb-card cursor-pointer py-2 font-bold ${sub === '📝 Exámenes' ? 'text-blue-400' : ''}`}>
                                                        {sub}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {/* Nested Selection for Evaluations */}
                                        {targetSubfolder === '📝 Exámenes' && targetCycleId !== 'historical' && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="mt-4 pt-4 border-t border-bb-border/50"
                                            >
                                                <label className="block text-xs font-bold text-bb-text-secondary uppercase tracking-wider mb-2">Tipo de Evaluación (Opcional)</label>
                                                <Select value={targetSubfolder} onValueChange={setTargetSubfolder}>
                                                    <SelectTrigger className="w-full bg-bb-dark border border-bb-border rounded-xl px-4 py-3 h-12 text-sm text-blue-400 font-bold focus:outline-none focus:border-blue-500 shadow-none">
                                                        <SelectValue placeholder="Carpeta de Examen General" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-bb-dark border border-bb-border text-bb-text rounded-xl shadow-xl">
                                                        <SelectItem value="📝 Exámenes" className="focus:bg-bb-card cursor-pointer py-2 italic opacity-60">📁 Carpeta Raíz de Exámenes</SelectItem>
                                                        {(courseCycles.find(c => c.id === targetCycleId)?.active_subfolders || [])
                                                            .filter((s: string) => !PREDEFINED_SUBFOLDERS.includes(s))
                                                            .map((nested: string) => (
                                                                <SelectItem key={nested} value={nested} className="focus:bg-bb-card cursor-pointer py-2 text-blue-300">
                                                                    ↳ {nested}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setShowMoveModal(false)}
                                    variant="ghost"
                                    className="flex-1 rounded-xl text-bb-text-secondary hover:text-bb-text hover:bg-bb-dark"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleMassMove}
                                    disabled={isMovingFiles || (targetCycleId !== 'historical' && !targetSubfolder)}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isMovingFiles ? 'Moviendo...' : 'Confirmar'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* V6.0: Modal de Calculadora de Notas */}
            <AnimatePresence>
                {showCalculatorModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCalculatorModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative bg-bb-card border border-bb-border p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center"
                        >
                            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                                <Calculator className="w-10 h-10 text-blue-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-bb-text mb-2 tracking-tight">Calculadora de Notas</h3>
                            <p className="text-bb-text-secondary text-sm mb-8 leading-relaxed">
                                Esta herramienta te permitirá simular tus promedios de forma automática basándose en el sílabo del curso. <br /><br />
                                <span className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">¡Lanzamiento próximamente!</span>
                            </p>
                            <Button
                                onClick={() => setShowCalculatorModal(false)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                            >
                                Entendido
                            </Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

