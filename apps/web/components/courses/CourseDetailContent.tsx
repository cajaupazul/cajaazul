'use client';

import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, Mail, LayoutPanelLeft, FolderRoot, Folder, FolderOpen, Users, Filter, Trash2, Pencil, Upload, List, Calculator, CheckSquare, X, Compass, Folders } from 'lucide-react';
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
import StudentGradeCalculator from './StudentGradeCalculator';
import AdminGradingFormulaEditor from './AdminGradingFormulaEditor';
import CourseContributors from './CourseContributors';
import { FileTypeIcon } from '@/components/files/FileTypeIcon';
import SmartCourseMaterials from './SmartCourseMaterials';

const PREDEFINED_SUBFOLDERS = [
    '📖 Sílabo y Cronograma',
    '📝 Exámenes',
    '📊 Presentaciones y Diapositivas',
];

// These types go to the global Cajón General, not per-cycle folders
const GENERAL_TIPOS = ['🔗 Enlaces Útiles', '📚 Otros Recursos', 'enlace'];

interface CourseDetailContentProps {
    course: Course;
    topProfessor: any;
    allProfessors: any[];
    initialMaterials: any[];
    initialBlackboardContributions: any[];
    currentUser: any | null;
    initialCourseCycles: any[];
}

export default function CourseDetailContent({
    course,
    topProfessor,
    allProfessors,
    initialMaterials,
    initialBlackboardContributions,
    initialCourseCycles
}: CourseDetailContentProps) {
    const { profile: currentUser, isGuest } = useProfile();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [materials, setMaterials] = useState<any[]>(initialMaterials);
    const [blackboardContributions, setBlackboardContributions] = useState<any[]>(initialBlackboardContributions);
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
    const [libraryMode, setLibraryMode] = useState<'smart' | 'folders'>('smart');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [activeCycleId, setActiveCycleId] = useState<string | null>(searchParams.get('cycle'));
    const [activeSubfolder, setActiveSubfolder] = useState<string | null>(null);
    const [showAdminManager, setShowAdminManager] = useState(false);
    const [showCalculatorModal, setShowCalculatorModal] = useState(false);
    const [showAdminCalculatorModal, setShowAdminCalculatorModal] = useState(false);

    // Mass Move State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [targetCycleId, setTargetCycleId] = useState<string | null>('historical');
    const [targetSubfolder, setTargetSubfolder] = useState<string>('');
    const [isMovingFiles, setIsMovingFiles] = useState(false);

    // Blackboard folder sets state
    const [bbSets, setBbSets] = useState<any[]>([]);
    const [activeBbSetId, setActiveBbSetId] = useState<string | null>(null);
    const [bbFolderTree, setBbFolderTree] = useState<any[]>([]);
    const [activeBbFolderId, setActiveBbFolderId] = useState<string | null>(null);
    const [bbFolderFiles, setBbFolderFiles] = useState<any[]>([]);

    // Sync state with url param
    useEffect(() => {
        const profId = searchParams.get('professor');
        if (profId) setSelectedProfessorId(profId);
    }, [searchParams]);

    // Sync state with props when Server Component re-renders
    useEffect(() => {
        setMaterials(initialMaterials);
    }, [initialMaterials]);

    useEffect(() => {
        setBlackboardContributions(initialBlackboardContributions);
    }, [initialBlackboardContributions]);

    // Track view once per session
    useEffect(() => {
        const hasViewedKey = `viewed_course_${course.id}`;
        if (!sessionStorage.getItem(hasViewedKey)) {
            supabase.rpc('increment_course_views', { p_course_id: course.id })
                .then(({ error }) => {
                    if (!error) {
                        sessionStorage.setItem(hasViewedKey, 'true');
                    } else {
                        console.error('Error incrementing views:', error);
                    }
                });
        }
    }, [course.id]);

    // Load BB material sets when entering a specific cycle
    useEffect(() => {
        if (!activeCycleId || activeCycleId === 'general') {
            setBbSets([]);
            return;
        }
        const loadBlackboardSets = async () => {
            let setsQuery = supabase
                .from('bb_material_sets')
                .select('id, course_name, ciclo, cycle_id, professor_id, uploaded_by, created_at, professors(nombre)')
                .eq('course_id', course.id)
                .order('created_at', { ascending: false });
            setsQuery = activeCycleId === 'historical'
                ? setsQuery.is('cycle_id', null)
                : setsQuery.eq('cycle_id', activeCycleId);
            const { data: sets } = await setsQuery;

            const setIds = (sets || []).map((set: any) => set.id);
            const { data: fileRows } = setIds.length > 0
                ? await supabase.from('bb_files').select('set_id').in('set_id', setIds)
                : { data: [] as any[] };
            const counts = new Map<string, number>();
            (fileRows || []).forEach((row: any) => counts.set(row.set_id, (counts.get(row.set_id) || 0) + 1));
            setBbSets((sets || []).map((set: any) => ({ ...set, file_count: counts.get(set.id) || 0 })));
        };
        void loadBlackboardSets();
    }, [activeCycleId, course.id, courseCycles]);

    // Load BB folder tree when a set is selected
    useEffect(() => {
        if (!activeBbSetId) { setBbFolderTree([]); setBbFolderFiles([]); return; }
        supabase
            .from('bb_folders')
            .select('id, parent_id, name, path')
            .eq('set_id', activeBbSetId)
            .then(({ data }) => setBbFolderTree(data || []));
    }, [activeBbSetId]);

    // Load BB files for the active folder
    useEffect(() => {
        if (!activeBbSetId) { setBbFolderFiles([]); return; }
        const baseQuery = supabase
            .from('bb_files')
            .select('id, name, storage_path, size_bytes, mime_type, relative_path, uploaded_by, created_at')
            .eq('set_id', activeBbSetId);
        const query = activeBbFolderId === null
            ? baseQuery.is('folder_id', null)
            : baseQuery.eq('folder_id', activeBbFolderId);
        query.then(({ data }) => setBbFolderFiles(data || []));
    }, [activeBbSetId, activeBbFolderId]);

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
            const { deleteFileFromR2OrThrow, extractPathFromUrl } = await import('@/lib/r2-storage');
            if (extractPathFromUrl(materialUrl, 'course-materials')) {
                await deleteFileFromR2OrThrow('course-materials', materialUrl);
            }

            // Delete thumbnail if exists
            if (material.thumbnail_url) {
                await deleteFileFromR2OrThrow('thumbnails', material.thumbnail_url);
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

    const handleDeleteBbSet = async (setId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
        if (!isAdmin) {
            alert('No tienes permisos para eliminar carpetas.');
            return;
        }

        if (!confirm('¿Estás seguro de que deseas eliminar TODA esta carpeta de Blackboard y todo su contenido? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            // Get all files to delete from R2
            const { data: files } = await supabase
                .from('bb_files')
                .select('id, storage_path')
                .eq('set_id', setId);

            if (files && files.length > 0) {
                const { deleteFileFromR2OrThrow } = await import('@/lib/r2-storage');
                await Promise.all(files
                    .filter(file => file.storage_path)
                    .map(file => deleteFileFromR2OrThrow('course-materials', file.storage_path)));
            }

            // Delete from database
            const { error: dbError } = await supabase
                .from('bb_material_sets')
                .delete()
                .eq('id', setId);

            if (dbError) throw dbError;

            // Update state
            setBbSets(prev => prev.filter(s => s.id !== setId));
            setBlackboardContributions(prev => prev.filter(item => item.bb_set_id !== setId));
            if (activeBbSetId === setId) {
                setActiveBbSetId(null);
                setActiveSubfolder(null);
            }

            alert('Carpeta eliminada exitosamente');
        } catch (error: any) {
            console.error('Error deleting folder:', error);
            alert('Error al eliminar la carpeta: ' + error.message);
        }
    };

    const handleDeleteBbFile = async (file: any, e?: { stopPropagation: () => void }) => {
        e?.stopPropagation();

        const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
        if (!isAdmin) {
            alert('No tienes permisos para eliminar archivos.');
            return;
        }

        if (!confirm(`¿Estás seguro de que deseas eliminar "${file.name}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            // Delete file from R2 storage
            if (file.storage_path || file.file_url) {
                const { deleteFileFromR2OrThrow } = await import('@/lib/r2-storage');
                const urlToDelete = file.storage_path || file.file_url;
                await deleteFileFromR2OrThrow('course-materials', urlToDelete);
            }

            // Delete from database
            const { error: dbError } = await supabase
                .from('bb_files')
                .delete()
                .eq('id', file.id);

            if (dbError) throw dbError;

            // Update local state
            setBbFolderFiles(prev => prev.filter(f => f.id !== file.id));
            setBlackboardContributions(prev => prev.filter(item => item.bb_file_id !== file.id));

            alert('Archivo eliminado exitosamente');
        } catch (error: any) {
            console.error('Error deleting bb file:', error);
            alert('Error al eliminar el archivo: ' + error.message);
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
            const targetTipo = targetCycleId === 'historical' ? targetSubfolder : targetSubfolder;

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

    const smartMaterials = useMemo(
        () => [...materials, ...blackboardContributions],
        [materials, blackboardContributions]
    );

    const canDeleteSmartMaterial = (material: any) => {
        if (!currentUser) return false;
        const isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
        if (material.source === 'blackboard') return isAdmin;
        const createdAt = new Date(material.created_at).getTime();
        const within24Hours = Number.isFinite(createdAt) && (Date.now() - createdAt) / (1000 * 60 * 60) < 24;
        return isAdmin || (material.user_id === currentUser.id && within24Hours);
    };

    const handleDeleteSmartMaterial = (material: any) => {
        if (material.source === 'blackboard') {
            void handleDeleteBbFile(material);
            return;
        }
        void handleDeleteMaterial(material);
    };

    const handleReclassifySmartMaterial = async (material: any, value: string) => {
        try {
            if (material.source === 'blackboard') {
                const { error } = await supabase
                    .from('bb_files')
                    .update({ material_category: value })
                    .eq('id', material.bb_file_id);
                if (error) throw error;

                setBlackboardContributions((previous) => previous.map((item) =>
                    item.bb_file_id === material.bb_file_id ? { ...item, material_category: value } : item
                ));
                return;
            }

            const { error } = await supabase
                .from('materials')
                .update({ tipo: value })
                .eq('id', material.id);
            if (error) throw error;

            setMaterials((previous) => previous.map((item) =>
                item.id === material.id ? { ...item, tipo: value } : item
            ));
        } catch (error: any) {
            console.error('Error al organizar el material:', error);
            alert(`No pudimos guardar la ubicación: ${error.message || 'inténtalo nuevamente.'}`);
            throw error;
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedMaterialIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // All unique evaluation sub-folder types across all cycles (for filter chips)
    const allEvaluationTypes = useMemo(() => {
        const types = new Set<string>();
        // Add predefined evaluation types to make sure they are always available if needed, or only if they exist in materials or active_subfolders
        courseCycles.forEach(cycle => {
            (cycle.active_subfolders || [])
                .forEach((s: string) => {
                    if (!PREDEFINED_SUBFOLDERS.includes(s) && !GENERAL_TIPOS.includes(s)) {
                        types.add(s);
                    }
                });
        });
        // Also collect from materials directly to ensure any uploaded materials with these types are included
        materials.forEach(m => {
            if (m.tipo && !PREDEFINED_SUBFOLDERS.includes(m.tipo) && !GENERAL_TIPOS.includes(m.tipo)) {
                types.add(m.tipo);
            }
        });
        
        // Let's sort them logically
        const order = ['PC 1', 'PC 2', 'PC 3', 'PC 4', 'PC 5', 'Examen Parcial', 'Examen Final', 'Examen Sustitutorio'];
        return Array.from(types).sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [courseCycles, materials]);

    // Extracted material click handler (shared across render helpers)
    const handleMaterialClick = async (material: any) => {
        if (material.tipo?.toLowerCase() === 'enlace') {
            window.open(material.url_archivo, '_blank');
            return;
        }
        const isExcel = material.url_archivo.toLowerCase().match(/\.(xls|xlsx|csv)$/i);
        if (isExcel) {
            try {
                const path = extractPathFromUrl(material.url_archivo, 'course-materials');
                const blob = await getFileFromR2('course-materials', path);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                const extension = material.url_archivo.split('.').pop();
                a.href = url;
                a.download = `${material.titulo}.${extension}`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
            } catch (err: any) {
                console.error('Error al descargar Excel:', err);
                alert('Error al descargar el archivo: ' + err.message);
            }
            return;
        }
        setViewingFile({ path: material.url_archivo, name: material.titulo, useAdvanced: material.use_advanced_viewer });
    };

    // Always renders materials in list layout (used for filter results and cajón general)
    const renderFilteredList = (mats: any[]) => {
        if (mats.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
                    <FolderRoot className="w-8 h-8 mb-2 text-bb-text-secondary" />
                    <p className="text-xs text-bb-text-secondary font-medium">Vacío</p>
                </div>
            );
        }
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
    };

    // In grid mode, files are hidden — folder tiles are shown by the parent
    const renderMaterialGrid = (mats: any[]) => {
        if (viewMode === 'grid') return null;
        return renderFilteredList(mats);
    };

    // FolderCard tile for grid view
    const FolderCard = ({ name, count, onClick }: { name: string; count: number; onClick?: () => void }) => (
        <button
            onClick={onClick}
            className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-bb-darker/55 border border-bb-border/30 rounded-2xl hover:border-blue-500/50 hover:bg-bb-card/90 transition-all active:scale-95 text-center group w-full shadow-md"
        >
            <div className="relative">
                <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-full h-full text-yellow-500 group-hover:text-yellow-400 transition-colors drop-shadow-sm" fill="currentColor">
                        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                </div>
                {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none border border-bb-dark">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-bb-text/90 leading-tight line-clamp-2 w-full uppercase tracking-tighter">
                {name}
            </span>
        </button>
    );

    // Historical materials — excluding general resources (enlaces/otros)
    const historicalMaterials = useMemo(() => {
        return materialsForCounts.filter(m => !m.cycle_id && !GENERAL_TIPOS.includes(m.tipo) && m.tipo?.toLowerCase() !== 'enlace');
    }, [materialsForCounts]);

    const historicalCategories = useMemo(() => {
        const cats = [
            { id: 'silabo', label: '📖 Sílabo y Cronograma', items: [] as any[] },
            { id: 'examenes', label: '📝 Exámenes', items: [] as any[] },
            { id: 'presentaciones', label: '📊 Presentaciones y Diapositivas', items: [] as any[] },
        ];
        historicalMaterials.forEach(m => {
            if (m.tipo?.toLowerCase() === 'syllabus' || (m.titulo || '').toLowerCase().includes('silabo') || (m.titulo || '').toLowerCase().includes('sílabo')) {
                cats[0].items.push(m);
            } else if (m.tipo?.toLowerCase().includes('examen')) {
                cats[1].items.push(m);
            } else if (m.tipo?.toLowerCase().includes('ppt') || m.tipo?.toLowerCase().includes('presentacion')) {
                cats[2].items.push(m);
            }
        });
        return cats;
    }, [historicalMaterials]);

    // Cajón General: all links and other resources from ALL materials (any cycle or historical)
    const cajonGeneralMaterials = useMemo(() => {
        return materialsForCounts.filter(m =>
            GENERAL_TIPOS.includes(m.tipo) || m.tipo?.toLowerCase() === 'enlace'
        );
    }, [materialsForCounts]);

    // Materials grouped by cycle
    const cycleMaterialsMap = useMemo(() => {
        const map = new Map<string, any[]>();
        materialsForCounts.filter(m => !!m.cycle_id).forEach(m => {
            const arr = map.get(m.cycle_id) || [];
            arr.push(m);
            map.set(m.cycle_id, arr);
        });
        return map;
    }, [materialsForCounts]);

    const blackboardCycleCounts = useMemo(() => {
        const counts = new Map<string, number>();
        blackboardContributions.forEach((item) => {
            const key = item.cycle_id || 'historical';
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return counts;
    }, [blackboardContributions]);

    const renderBlackboardImportCards = () => {
        if (bbSets.length === 0) return null;
        return (
            <section className="border-t border-bb-border/60 pt-5" aria-label="Importaciones de Blackboard">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">Material por docente</p>
                        <h4 className="text-base font-black text-bb-text">Importaciones de Blackboard</h4>
                        <p className="mt-1 text-xs text-bb-text-secondary">Conservan la estructura original de carpetas y archivos.</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-bb-text-secondary">
                        {bbSets.reduce((total, set) => total + (set.file_count || 0), 0)} recursos
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {bbSets.map((set) => (
                        <div key={set.id} className="group/folder relative">
                            <button
                                onClick={() => { setActiveBbSetId(set.id); setActiveBbFolderId(null); setActiveSubfolder('__bb__'); }}
                                className="flex min-h-24 w-full items-center gap-3 rounded-xl border border-bb-border bg-bb-card p-4 text-left transition-colors hover:border-blue-500/60 hover:bg-bb-hover"
                            >
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                                    <FolderOpen className="h-6 w-6" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-black text-bb-text">{(set.professors as any)?.nombre || 'Profesor sin asignar'}</span>
                                    <span className="mt-1 block truncate text-[11px] text-bb-text-secondary">{set.course_name || 'Carpeta importada'}</span>
                                    <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wider text-blue-400">{set.file_count || 0} archivos</span>
                                </span>
                            </button>
                            {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                <button
                                    onClick={(e) => handleDeleteBbSet(set.id, e)}
                                    className="absolute right-2 top-2 rounded-lg bg-bb-dark p-1.5 text-red-400 opacity-0 transition-opacity hover:bg-red-500/15 group-hover/folder:opacity-100 focus-visible:opacity-100"
                                    title="Eliminar importación completa"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        );
    };

    const breadcrumbs = useMemo(() => {
        if (!activeCycleId) return null;
        let cycleName = '';
        if (activeCycleId === 'historical') {
            cycleName = '📦 Archivos Históricos';
        } else if (activeCycleId === 'general') {
            cycleName = '🗂 Cajón General';
        } else {
            const cycle = courseCycles.find(c => c.id === activeCycleId);
            cycleName = cycle ? `📁 Ciclo ${cycle.ciclo_name}` : '';
        }
        const bbSetName = activeBbSetId ? bbSets.find(s => s.id === activeBbSetId) : null;

        return (
            <div className="flex items-center flex-wrap gap-2 text-xs font-bold text-bb-text-secondary mb-4 bg-bb-darker/50 p-3 rounded-2xl border border-bb-border/30">
                <button
                    onClick={() => {
                        setActiveCycleId(null);
                        setActiveSubfolder(null);
                        setActiveBbSetId(null);
                        setActiveBbFolderId(null);
                    }}
                    className="hover:text-white transition-colors uppercase tracking-tight flex items-center gap-1 text-[10px] bg-bb-border/40 px-2.5 py-1 rounded-xl"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Volver a Raíz
                </button>
                <span className="text-bb-border">|</span>
                <button
                    onClick={() => {
                        setActiveSubfolder(null);
                        setActiveBbSetId(null);
                        setActiveBbFolderId(null);
                    }}
                    className={`hover:text-white transition-colors ${!activeSubfolder ? 'text-blue-400' : ''}`}
                    disabled={!activeSubfolder}
                >
                    {cycleName}
                </button>
                {activeSubfolder === '__bb__' && bbSetName && (
                    <>
                        <span className="text-bb-text/30">/</span>
                        <button
                            onClick={() => setActiveBbFolderId(null)}
                            className={`transition-colors ${!activeBbFolderId ? 'text-violet-400' : 'hover:text-white'}`}
                            disabled={!activeBbFolderId}
                        >
                            📁 {(bbSetName.professors as any)?.nombre || 'Carpeta BB'}
                        </button>
                        {activeBbFolderId && (
                            <>
                                <span className="text-bb-text/30">/</span>
                                <span className="text-violet-300">{bbFolderTree.find(f => f.id === activeBbFolderId)?.name}</span>
                            </>
                        )}
                    </>
                )}
                {activeSubfolder && activeSubfolder !== '__bb__' && (
                    <>
                        <span className="text-bb-text/30">/</span>
                        <span className="text-teal-400">{activeSubfolder}</span>
                    </>
                )}
            </div>
        );
    }, [activeCycleId, activeSubfolder, courseCycles, activeBbSetId, bbSets, activeBbFolderId, bbFolderTree]);

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

                            <CourseContributors materials={[...materials, ...blackboardContributions]} />

                            {course.descripcion && <p className="text-bb-text-secondary leading-relaxed text-sm md:text-base mb-10">{course.descripcion}</p>}
                        </div>

                        <div className={libraryMode === 'folders' ? 'mb-6' : 'hidden'}>
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
                                    {/* V7.0: Calculadora integrada junto al buscador */}
                                    <button
                                        onClick={() => setShowCalculatorModal(true)}
                                        className="p-3 bg-bb-darker/50 border border-bb-border rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 h-11 transition-all active:scale-95 flex items-center justify-center"
                                        title="Calculadora de Notas"
                                    >
                                        <Calculator className="w-5 h-5 flex-shrink-0" />
                                    </button>
                                    {/* Admin: Editar fórmula de calificación */}
                                    {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                        <button
                                            onClick={() => setShowAdminCalculatorModal(true)}
                                            className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-400/15 h-11 transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap px-3"
                                            title="Editar fórmula de calificación (Admin)"
                                        >
                                            <Pencil className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="hidden sm:inline">Editar Fórmula</span>
                                        </button>
                                    )}
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
                            <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex-1 flex flex-col justify-center">
                                    <h3 className="text-xl md:text-2xl font-black text-bb-text tracking-tight flex items-center gap-3">
                                        <FolderRoot className="w-6 h-6 text-blue-500" />
                                        Materiales del curso
                                    </h3>
                                    <p className="text-xs text-bb-text-secondary mt-1 font-medium">Busca por tipo, profesor o ciclo sin recorrer carpeta por carpeta.</p>
                                </div>
                                <div className="flex w-full flex-wrap items-center gap-2 self-start xl:w-auto xl:justify-end xl:self-auto">
                                    <div className="flex items-center gap-1 bg-bb-card p-1 rounded-xl border border-bb-border flex-shrink-0">
                                        <button
                                            onClick={() => setLibraryMode('smart')}
                                            className={`flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-bold transition-colors ${libraryMode === 'smart' ? 'bg-blue-600 text-white' : 'text-bb-text-secondary hover:bg-bb-hover hover:text-bb-text'}`}
                                            title="Explorar todos los materiales"
                                        >
                                            <Compass className="h-4 w-4" />
                                            Explorar
                                        </button>
                                        <button
                                            onClick={() => setLibraryMode('folders')}
                                            className={`flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-bold transition-colors ${libraryMode === 'folders' ? 'bg-blue-600 text-white' : 'text-bb-text-secondary hover:bg-bb-hover hover:text-bb-text'}`}
                                            title="Abrir la estructura clásica"
                                        >
                                            <Folders className="h-4 w-4" />
                                            Carpetas
                                        </button>
                                    </div>

                                    {libraryMode === 'folders' && (
                                    <div className="flex items-center gap-1 bg-bb-card p-1 rounded-xl border border-bb-border flex-shrink-0">
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
                                    )}
                                    
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

                                    {!isGuest && currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
                                        <button
                                            onClick={() => setShowAddCycleModal(true)}
                                            className="inline-flex items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all bg-bb-border text-bb-text hover:bg-bb-card border border-transparent hover:border-bb-border h-10 sm:h-11 px-3 sm:px-4 active:scale-95 whitespace-nowrap flex-shrink-0"
                                        >
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <FolderRoot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                <span>Nuevo ciclo</span>
                                            </div>
                                        </button>
                                    )}
                                    {!isGuest && (
                                        <Link
                                            href={`/dashboard/courses/upload?courseId=${course.id}${activeCycleId && activeCycleId !== 'general' ? `&cycle=${activeCycleId}` : ''}`}
                                            className="inline-flex items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all bg-blue-600 text-white hover:bg-blue-700 h-10 sm:h-11 px-3 sm:px-5 shadow-lg shadow-blue-600/20 active:scale-95 whitespace-nowrap flex-shrink-0"
                                        >
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                                                Compartir material
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {libraryMode === 'smart' && (
                                <SmartCourseMaterials
                                    materials={smartMaterials}
                                    cycles={courseCycles}
                                    professors={allProfessors}
                                    selectedProfessorId={selectedProfessorId}
                                    onProfessorChange={setSelectedProfessorId}
                                    isSelectionMode={isSelectionMode}
                                    selectedMaterialIds={selectedMaterialIds}
                                    onToggleSelect={handleToggleSelect}
                                    onOpen={handleMaterialClick}
                                    canDelete={canDeleteSmartMaterial}
                                    onDelete={handleDeleteSmartMaterial}
                                    isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'superadmin'}
                                    onReclassify={handleReclassifySmartMaterial}
                                />
                            )}

                            <div className={libraryMode === 'folders' ? 'block' : 'hidden'}>

                            {/* Evaluation Filter Chips */}
                            {allEvaluationTypes.length > 0 && (
                                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
                                    <button
                                        onClick={() => setTypeFilter(null)}
                                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                                            typeFilter === null
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                                                : 'bg-bb-darker/50 hover:bg-bb-card border border-bb-border/30 text-bb-text-secondary hover:text-white'
                                        }`}
                                    >
                                        Todos
                                    </button>
                                    {allEvaluationTypes.map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setTypeFilter(type)}
                                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                                                typeFilter === type
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                                                    : 'bg-bb-darker/50 hover:bg-bb-card border border-bb-border/30 text-bb-text-secondary hover:text-white'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Breadcrumbs for folder navigation */}
                            {breadcrumbs}

                            <div className="space-y-4">
                                {/* ── BB Folder Tree: shown regardless of grid/list mode ── */}
                                {activeSubfolder === '__bb__' && activeBbSetId ? (() => {
                                    const sortFolders = (folders: any[]) =>
                                        [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
                                    const rootFolders = sortFolders(bbFolderTree.filter(f => !f.parent_id));
                                    const childFolders = activeBbFolderId
                                        ? sortFolders(bbFolderTree.filter(f => f.parent_id === activeBbFolderId))
                                        : [];
                                    const sortedFiles = [...bbFolderFiles].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
                                    const buildPath = (folderId: string | null): any[] => {
                                        if (!folderId) return [];
                                        const folder = bbFolderTree.find(f => f.id === folderId);
                                        if (!folder) return [];
                                        return [...buildPath(folder.parent_id), folder];
                                    };
                                    const crumb = buildPath(activeBbFolderId);
                                    const displayFolders = activeBbFolderId ? childFolders : rootFolders;

                                    if (viewMode === 'list') {
                                        // ── List mode: Left panel tree + right panel files ──────
                                        const renderTreeNode = (folder: any, depth: number = 0): ReactNode => {
                                            const children = sortFolders(bbFolderTree.filter(f => f.parent_id === folder.id));
                                            const isActive = activeBbFolderId === folder.id;
                                            return (
                                                <div key={folder.id} style={{ paddingLeft: depth * 16 }}>
                                                    <button
                                                        onClick={() => setActiveBbFolderId(isActive ? folder.parent_id || null : folder.id)}
                                                        className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-left text-sm transition-all ${isActive ? 'bg-violet-500/20 text-violet-300 font-bold' : 'hover:bg-violet-500/10 text-bb-text/80 hover:text-violet-300'}`}
                                                    >
                                                        {isActive ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
                                                        <span className="truncate flex-1 font-medium">{folder.name}</span>
                                                        {children.length > 0 && <span className="text-[10px] text-bb-text-secondary shrink-0">{children.length}</span>}
                                                    </button>
                                                    {isActive && children.map(child => renderTreeNode(child, depth + 1))}
                                                </div>
                                            );
                                        };
                                        return (
                                            <div className="flex gap-4">
                                                <div className="w-56 shrink-0 border-r border-bb-border/30 pr-3 space-y-0.5 max-h-[60vh] overflow-y-auto">
                                                    <button onClick={() => setActiveBbFolderId(null)} className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-left text-sm transition-all ${!activeBbFolderId ? 'bg-violet-500/20 text-violet-300 font-bold' : 'hover:bg-violet-500/10 text-bb-text/80 hover:text-violet-300'}`}>
                                                        <FolderRoot className="h-4 w-4 shrink-0" />
                                                        <span className="truncate flex-1 font-medium">Raíz</span>
                                                    </button>
                                                    {rootFolders.map(f => renderTreeNode(f, 1))}
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    {crumb.length > 0 && (
                                                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-bb-text-secondary font-medium pb-2 border-b border-bb-border/20">
                                                            <button onClick={() => setActiveBbFolderId(null)} className="hover:text-violet-300 transition-colors">Raíz</button>
                                                            {crumb.map((f, i) => (
                                                                <span key={f.id} className="flex items-center gap-1">
                                                                    <span>/</span>
                                                                    <button onClick={() => setActiveBbFolderId(f.id)} className={`hover:text-violet-300 transition-colors ${i === crumb.length - 1 ? 'text-violet-300 font-bold' : ''}`}>{f.name}</button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {sortedFiles.length > 0 ? sortedFiles.map((file: any) => (
                                                        <div key={file.id} className="relative group/file">
                                                            <button onClick={() => setViewingFile({ path: file.storage_path, name: file.name })}
                                                                className="flex items-center gap-3 w-full p-2.5 bg-bb-card border border-bb-border hover:border-violet-500/40 rounded-xl transition-all text-left">
                                                                <FileTypeIcon fileName={file.name} mimeType={file.mime_type} size="sm" />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-bold text-bb-text truncate">{file.name}</p>
                                                                    <p className="text-[10px] text-bb-text-secondary">{file.size_bytes ? `${(file.size_bytes / 1024 / 1024).toFixed(1)} MB` : ''}</p>
                                                                </div>
                                                            </button>
                                                            {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                                                <button
                                                                    onClick={(e) => handleDeleteBbFile(file, e)}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover/file:opacity-100 transition-opacity shadow-lg"
                                                                    title="Eliminar archivo"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )) : (
                                                        <p className="text-sm text-bb-text-secondary text-center py-8 opacity-50">
                                                            {activeBbFolderId ? 'Esta carpeta no tiene archivos directos.' : 'Selecciona una carpeta del árbol.'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // ── Grid mode ───────────────────────────────────────────
                                    return (
                                        <div className="space-y-4">
                                            {crumb.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1 text-[11px] text-bb-text-secondary font-medium">
                                                    <button onClick={() => setActiveBbFolderId(null)} className="hover:text-violet-300 transition-colors">Raíz</button>
                                                    {crumb.map((f, i) => (
                                                        <span key={f.id} className="flex items-center gap-1">
                                                            <span>/</span>
                                                            <button onClick={() => setActiveBbFolderId(f.id)} className={`hover:text-violet-300 transition-colors ${i === crumb.length - 1 ? 'text-violet-300 font-bold' : ''}`}>{f.name}</button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {activeBbFolderId && (
                                                <button onClick={() => setActiveBbFolderId(crumb.length > 1 ? crumb[crumb.length - 2].id : null)}
                                                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-bold transition-colors">
                                                    <ArrowLeft className="w-3.5 h-3.5" /> Volver
                                                </button>
                                            )}
                                            {displayFolders.length > 0 && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                    {displayFolders.map((folder: any) => (
                                                        <button key={folder.id} onClick={() => setActiveBbFolderId(folder.id)}
                                                            className="flex flex-col items-center gap-2 p-3 bg-violet-500/10 border border-violet-500/30 hover:border-violet-400 hover:bg-violet-500/20 rounded-2xl transition-all text-center cursor-pointer">
                                                            <FolderOpen className="h-8 w-8 text-blue-400" />
                                                            <p className="text-[11px] font-black text-violet-300 leading-tight">{folder.name}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {sortedFiles.length > 0 && (
                                                <div className="space-y-2 mt-4">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-bb-text-secondary">Archivos</p>
                                                    <div className="space-y-2">
                                                        {sortedFiles.map((file: any) => (
                                                            <div key={file.id} className="relative group/file">
                                                                <button onClick={() => setViewingFile({ path: file.storage_path, name: file.name })}
                                                                    className="flex items-center gap-3 w-full p-3 bg-bb-card border border-bb-border hover:border-violet-500/40 rounded-xl transition-all text-left">
                                                                    <FileTypeIcon fileName={file.name} mimeType={file.mime_type} size="md" />
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-bold text-bb-text truncate">{file.name}</p>
                                                                        <p className="text-[10px] text-bb-text-secondary">{file.size_bytes ? `${(file.size_bytes / 1024 / 1024).toFixed(1)} MB` : ''}</p>
                                                                    </div>
                                                                </button>
                                                                {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                                                    <button
                                                                        onClick={(e) => handleDeleteBbFile(file, e)}
                                                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover/file:opacity-100 transition-opacity shadow-lg"
                                                                        title="Eliminar archivo"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {sortedFiles.length === 0 && displayFolders.length === 0 && (
                                                <p className="text-sm text-bb-text-secondary text-center py-8">Esta carpeta está vacía.</p>
                                            )}
                                        </div>
                                    );
                                })() : typeFilter !== null ? (
                                    /* Flat view when typeFilter is selected */
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between border-b border-bb-border/35 pb-2">
                                            <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                                                Filtro Activo: {typeFilter}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setTypeFilter(null)}
                                                className="text-xs text-bb-text-secondary hover:text-white h-7 px-2"
                                            >
                                                Limpiar Filtro
                                            </Button>
                                        </div>
                                        {(() => {
                                            let hasResults = false;
                                            const renderedCycles = courseCycles.map((cycle) => {
                                                const cycleMats = (cycleMaterialsMap.get(cycle.id) || []).filter(m => m.tipo === typeFilter);
                                                if (cycleMats.length === 0) return null;
                                                hasResults = true;
                                                return (
                                                    <div key={cycle.id} className="bg-bb-card/40 border border-bb-border/30 rounded-2xl p-4 sm:p-5">
                                                        <h4 className="text-sm font-black text-bb-text mb-3 uppercase tracking-wider flex items-center gap-2">
                                                            <span className="w-1.5 h-3 bg-blue-500 rounded-full"></span>
                                                            Ciclo {cycle.ciclo_name}
                                                        </h4>
                                                        {renderFilteredList(cycleMats)}
                                                    </div>
                                                );
                                            });

                                            const histMats = historicalMaterials.filter(m => m.tipo === typeFilter);
                                            const renderedHist = histMats.length > 0 ? (() => {
                                                hasResults = true;
                                                return (
                                                    <div className="bg-bb-card/40 border border-bb-border/30 rounded-2xl p-4 sm:p-5">
                                                        <h4 className="text-sm font-black text-bb-text mb-3 uppercase tracking-wider flex items-center gap-2">
                                                            <span className="w-1.5 h-3 bg-teal-500 rounded-full"></span>
                                                            Archivos Históricos
                                                        </h4>
                                                        {renderFilteredList(histMats)}
                                                    </div>
                                                );
                                            })() : null;

                                            if (!hasResults) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center py-16 bg-bb-card/25 border border-bb-border/20 rounded-2xl text-center opacity-50">
                                                        <FolderRoot className="w-10 h-10 mb-3 text-bb-text-secondary animate-pulse" />
                                                        <p className="text-sm text-bb-text-secondary font-medium">No se encontraron materiales de tipo "{typeFilter}"</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-4">
                                                    {renderedCycles}
                                                    {renderedHist}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : viewMode === 'grid' ? (
                                    /* Grid mode: Multi-level Folder Navigation */
                                    (() => {
                                        const currentViewMode = (viewMode as string); // prevent TS narrowing
                                        if (!activeCycleId) {
                                            // Root folders
                                            return (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                                                    {courseCycles.map((cycle) => (
                                                        <FolderCard
                                                            key={cycle.id}
                                                            name={`Ciclo ${cycle.ciclo_name}`}
                                                            count={(cycleMaterialsMap.get(cycle.id) || []).length + (blackboardCycleCounts.get(cycle.id) || 0)}
                                                            onClick={() => {
                                                                setActiveCycleId(cycle.id);
                                                                setActiveSubfolder(null);
                                                            }}
                                                        />
                                                    ))}

                                                    {(historicalMaterials.length > 0 || (blackboardCycleCounts.get('historical') || 0) > 0) && (
                                                        <FolderCard
                                                            name="Archivos Históricos"
                                                            count={historicalMaterials.length + (blackboardCycleCounts.get('historical') || 0)}
                                                            onClick={() => {
                                                                setActiveCycleId('historical');
                                                                setActiveSubfolder(null);
                                                            }}
                                                        />
                                                    )}

                                                    {cajonGeneralMaterials.length > 0 && (
                                                        <FolderCard
                                                            name="Cajón General"
                                                            count={cajonGeneralMaterials.length}
                                                            onClick={() => {
                                                                setActiveCycleId('general');
                                                                setActiveSubfolder(null);
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        }

                                        if (activeCycleId === 'general') {
                                            return renderFilteredList(cajonGeneralMaterials);
                                        }

                                        if (activeCycleId === 'historical') {
                                            if (!activeSubfolder) {
                                                return (
                                                    <div className="space-y-8">
                                                        {historicalCategories.length > 0 && (
                                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                                                                {historicalCategories.map((cat) => (
                                                                    <FolderCard
                                                                        key={cat.id}
                                                                        name={cat.label}
                                                                        count={cat.items.length}
                                                                        onClick={() => setActiveSubfolder(cat.label)}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {renderBlackboardImportCards()}
                                                    </div>
                                                );
                                            }
                                            const cat = historicalCategories.find(c => c.label === activeSubfolder);
                                            return cat ? renderFilteredList(cat.items) : null;
                                        }

                                        // Cycle level folder
                                        const cycle = courseCycles.find(c => c.id === activeCycleId);
                                        if (!cycle) return null;
                                        const cycleMats = cycleMaterialsMap.get(cycle.id) || [];

                                        if (!activeSubfolder) {
                                            // Inside cycle, show predefined subfolders Sílabo, Exámenes, Presentaciones
                                            const matchedMatsMap = new Map<string, number>();
                                            PREDEFINED_SUBFOLDERS.forEach((sub) => {
                                                const count = cycleMats.filter(m => m.tipo === sub).length;
                                                matchedMatsMap.set(sub, count);
                                            });
                                            // Exams count summing subfolders
                                            const examsMats = cycleMats.filter(m => m.tipo === '📝 Exámenes');
                                            const customSubfolders = (cycle.active_subfolders || [])
                                                .filter((s: string) => !PREDEFINED_SUBFOLDERS.includes(s) && !GENERAL_TIPOS.includes(s));
                                            let examsCount = examsMats.length;
                                            customSubfolders.forEach((sub: string) => {
                                                examsCount += cycleMats.filter(m => m.tipo === sub).length;
                                            });
                                            matchedMatsMap.set('📝 Exámenes', examsCount);

                                            return (
                                                <div className="space-y-8">
                                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                                                        {PREDEFINED_SUBFOLDERS.map((sub) => (
                                                            <FolderCard
                                                                key={sub}
                                                                name={sub}
                                                                count={matchedMatsMap.get(sub) || 0}
                                                                onClick={() => setActiveSubfolder(sub)}
                                                            />
                                                        ))}
                                                    </div>

                                                    {bbSets.length > 0 && (
                                                        <section className="border-t border-bb-border/60 pt-5" aria-labelledby="blackboard-imports-title">
                                                            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">Material por docente</p>
                                                                    <h4 id="blackboard-imports-title" className="text-base font-black text-bb-text">Importaciones de Blackboard</h4>
                                                                    <p className="mt-1 text-xs text-bb-text-secondary">Conservan la estructura original de carpetas y archivos de cada profesor.</p>
                                                                </div>
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-bb-text-secondary">
                                                                    {bbSets.reduce((total, set) => total + (set.file_count || 0), 0)} recursos
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                                {bbSets.map((set) => (
                                                                    <div key={set.id} className="group/folder relative">
                                                                        <button
                                                                            onClick={() => { setActiveBbSetId(set.id); setActiveBbFolderId(null); setActiveSubfolder('__bb__'); }}
                                                                            className="flex min-h-24 w-full items-center gap-3 rounded-xl border border-bb-border bg-bb-card p-4 text-left transition-colors hover:border-blue-500/60 hover:bg-bb-hover"
                                                                        >
                                                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                                                                                <FolderOpen className="h-6 w-6" />
                                                                            </span>
                                                                            <span className="min-w-0 flex-1">
                                                                                <span className="block truncate text-sm font-black text-bb-text">{(set.professors as any)?.nombre || 'Profesor sin asignar'}</span>
                                                                                <span className="mt-1 block truncate text-[11px] text-bb-text-secondary">{set.course_name || 'Carpeta importada'}</span>
                                                                                <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wider text-blue-400">{set.file_count || 0} archivos</span>
                                                                            </span>
                                                                        </button>
                                                                        {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                                                            <button
                                                                                onClick={(e) => handleDeleteBbSet(set.id, e)}
                                                                                className="absolute right-2 top-2 rounded-lg bg-bb-dark p-1.5 text-red-400 opacity-0 transition-opacity hover:bg-red-500/15 group-hover/folder:opacity-100 focus-visible:opacity-100"
                                                                                title="Eliminar importación completa"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </section>
                                                    )}
                                                </div>
                                            );
                                        }

                                        if (activeSubfolder === '📝 Exámenes') {
                                            // Exam subfolders
                                            const customSubfolders = (cycle.active_subfolders || [])
                                                .filter((s: string) => !PREDEFINED_SUBFOLDERS.includes(s) && !GENERAL_TIPOS.includes(s))
                                                .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                                            const examsMats = cycleMats.filter(m => m.tipo === '📝 Exámenes');

                                            if (customSubfolders.length === 0) {
                                                return renderFilteredList(examsMats);
                                            }

                                            return (
                                                <div className="space-y-6">
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                                                        {customSubfolders.map((sub: string) => {
                                                            const subMats = cycleMats.filter(m => m.tipo === sub);
                                                            return (
                                                                <FolderCard
                                                                    key={sub}
                                                                    name={sub}
                                                                    count={subMats.length}
                                                                    onClick={() => setActiveSubfolder(sub)}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    {examsMats.length > 0 && (
                                                        <div className="mt-6 border-t border-bb-border/20 pt-4">
                                                            <h5 className="text-xs font-bold text-bb-text-secondary uppercase mb-3">Materiales generales de exámenes</h5>
                                                            {renderFilteredList(examsMats)}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // Inside a leaf subfolder (e.g. Sílabo, Presentaciones, or PC 1)
                                        const subfolderMats = cycleMats.filter(m => m.tipo === activeSubfolder);
                                        return renderFilteredList(subfolderMats);
                                    })()
                                ) : (
                                    /* List mode: Traditional Accordion view */
                                    <Accordion>
                                        {/* Mapped Explicit Course Cycles */}
                                        {courseCycles
                                            .filter(c => activeCycleId === null || c.id === activeCycleId)
                                            .map((cycle) => (
                                                <AccordionItem 
                                                    key={`${cycle.id}-${activeCycleId === cycle.id ? 'open' : 'closed'}`}
                                                    defaultOpen={activeCycleId === cycle.id}
                                                    title={
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className="font-bold">📁 Ciclo {cycle.ciclo_name}</span>
                                                            <Badge className="ml-4 bg-teal-500/10 border border-teal-500/20 text-teal-400 font-black">
                                                                {(cycleMaterialsMap.get(cycle.id) || []).length}
                                                            </Badge>
                                                        </div>
                                                    }
                                                >
                                                    <Accordion className="space-y-1 pl-1 md:pl-4">
                                                        {PREDEFINED_SUBFOLDERS.map((mainFolder: string) => {
                                                            const matchedMats = (cycleMaterialsMap.get(cycle.id) || []).filter(m => m.tipo === mainFolder);
                                                            const isExams = mainFolder === '📝 Exámenes';
                                                            const customSubfolders = isExams 
                                                                ? (cycle.active_subfolders || [])
                                                                    .filter((s: string) => !PREDEFINED_SUBFOLDERS.includes(s) && !GENERAL_TIPOS.includes(s))
                                                                    .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) 
                                                                : [];

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

                                        {/* Historical materials accordion */}
                                        {historicalMaterials.length > 0 && (activeCycleId === null || activeCycleId === 'historical') && (
                                            <AccordionItem 
                                                key={`historical-${activeCycleId === 'historical' ? 'open' : 'closed'}`}
                                                defaultOpen={activeCycleId === 'historical' || courseCycles.length === 0}
                                                title={
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="font-bold">📦 Archivos Históricos (Sin Clasificar)</span>
                                                        <Badge className="ml-4 bg-bb-dark border border-bb-border text-bb-text-secondary font-black">
                                                            {historicalMaterials.length}
                                                        </Badge>
                                                    </div>
                                                }
                                            >
                                                <Accordion className="space-y-1">
                                                    {historicalCategories.map((cat) => (
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
                                        )}

                                        {/* Global Cajón General accordion */}
                                        {(cajonGeneralMaterials.length > 0 || (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin'))) && (activeCycleId === null || activeCycleId === 'general') && (
                                            <AccordionItem
                                                key={`general-${activeCycleId === 'general' ? 'open' : 'closed'}`}
                                                defaultOpen={activeCycleId === 'general'}
                                                title={
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="font-bold flex items-center gap-2">🗂 Cajón General (Enlaces y Recursos)</span>
                                                        <Badge className="ml-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black">
                                                            {cajonGeneralMaterials.length}
                                                        </Badge>
                                                    </div>
                                                }
                                            >
                                                {renderFilteredList(cajonGeneralMaterials)}
                                            </AccordionItem>
                                        )}
                                    </Accordion>
                                )}
                            </div>
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
                                                href={`/dashboard/professors/${prof.id}/${course.catalog_course_id || course.id}`}
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

            {/* V7.0: Modal de Calculadora de Notas — dinámica */}
            <AnimatePresence>
                {showCalculatorModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCalculatorModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-bb-card border border-bb-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                            style={{ maxHeight: '90vh' }}
                        >
                            <StudentGradeCalculator
                                courseId={course.id}
                                courseName={course.nombre}
                                onClose={() => setShowCalculatorModal(false)}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* V7.0: Admin Formula Editor Modal */}
            <AnimatePresence>
                {showAdminCalculatorModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAdminCalculatorModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative bg-bb-card border border-bb-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
                            style={{ maxHeight: '92vh' }}
                        >
                            <AdminGradingFormulaEditor
                                courseId={course.id}
                                courseName={course.nombre}
                                onClose={() => setShowAdminCalculatorModal(false)}
                                onSaved={() => setShowAdminCalculatorModal(false)}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
