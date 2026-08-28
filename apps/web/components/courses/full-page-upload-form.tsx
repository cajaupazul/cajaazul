'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, Professor } from '@/lib/supabase';
import { generateThumbnailFromFile } from '@/lib/thumbnail-generator';
import { Upload, X, UserPlus, ArrowLeft, CheckCircle, FolderUp, Files, Link2, FolderTree, FolderOpen } from 'lucide-react';
import { FileTypeIcon } from '@/components/files/FileTypeIcon';
import { buildBlackboardStoragePath, buildCourseMaterialPath } from '@/lib/course-storage-paths';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

interface FullPageUploadFormProps {
    courseId: string;
    courseName: string;
    allProfessors: Professor[];
    courseCycles: any[];
}

const PREDEFINED_SUBFOLDERS = [
    '📖 Sílabo y Cronograma',
    '📝 Exámenes',
    '📊 Presentaciones y Diapositivas',
    '🔗 Enlaces Útiles',
    '📚 Otros Recursos'
];

interface FileEntry { file: File; relativePath: string; }

export default function FullPageUploadForm({
    courseId,
    courseName,
    allProfessors,
    courseCycles = [],
}: FullPageUploadFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [uploading, setUploading] = useState(false);
    
    // Multi-dropzone structural state
    const [uploadMethod, setUploadMethod] = useState<'file' | 'link' | 'bb-folder'>('file');
    const requestedCycle = searchParams.get('cycle');
    const [selectedCycleId, setSelectedCycleId] = useState<string>(
        courseCycles.some((cycle: any) => cycle.id === requestedCycle)
            ? requestedCycle!
            : courseCycles[0]?.id || 'historical'
    );
    const [selectedSubfolder, setSelectedSubfolder] = useState<string>('');
    
    const [professorId, setProfessorId] = useState<string>(
        allProfessors.length === 1 ? allProfessors[0].id : 'none'
    );

    // Blackboard folder upload states
    const [bbFiles, setBbFiles] = useState<FileEntry[]>([]);
    const [bbRootName, setBbRootName] = useState('');
    const [bbProgress, setBbProgress] = useState(0);
    const [bbProgressMsg, setBbProgressMsg] = useState('');

    // Mapped State: Folder Name -> Files/Links
    const [filesMap, setFilesMap] = useState<Record<string, File[]>>({});
    const [linksMap, setLinksMap] = useState<Record<string, { titulo: string; url: string }[]>>({
        'General': [{ titulo: '', url: '' }]
    });

    const addLinkRow = (key: string) => {
        setLinksMap(prev => {
            const current = prev[key] || [];
            return { ...prev, [key]: [...current, { titulo: '', url: '' }] };
        });
    };

    const updateLink = (key: string, index: number, field: 'titulo' | 'url', value: string) => {
        setLinksMap(prev => {
            const current = [...(prev[key] || [])];
            current[index] = { ...current[index], [field]: value };
            return { ...prev, [key]: current };
        });
    };

    const removeLinkRow = (key: string, index: number) => {
        setLinksMap(prev => {
            const current = prev[key] || [];
            const filtered = current.filter((_, i) => i !== index);
            return { ...prev, [key]: filtered };
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            setFilesMap(prev => {
                const existing = prev[key] || [];
                const combined = [...existing, ...selectedFiles];
                // Sort files naturally (like Windows Explorer)
                return {
                    ...prev,
                    [key]: combined.sort((a, b) => 
                        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                    )
                };
            });
        }
    };

    const removeFile = (key: string, index: number) => {
        setFilesMap(prev => ({
            ...prev,
            [key]: prev[key].filter((_, i) => i !== index)
        }));
    };

    const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files || []);
        if (!picked.length) return;
        const entries: FileEntry[] = picked.map(f => ({
            file: f,
            relativePath: (f as any).webkitRelativePath || f.name,
        }));
        setBbFiles(entries);
        const root = entries[0]?.relativePath.split('/')[0] || '';
        setBbRootName(root);
        setBbProgress(0);
        setBbProgressMsg('');
    };

    const uploadBbFiles = async (setId: string, entries: FileEntry[], isComplement: boolean) => {
        const folderMap: Record<string, string> = {};

        const allFolderPaths = new Set<string>();
        for (const entry of entries) {
            const parts = entry.relativePath.split('/');
            parts.pop();
            for (let i = 1; i < parts.length; i++) {
                allFolderPaths.add(parts.slice(0, i + 1).join('/'));
            }
        }

        setBbProgressMsg('Creando estructura de carpetas...');
        const sortedPaths = Array.from(allFolderPaths).sort((a, b) => a.split('/').length - b.split('/').length);

        for (const folderPath of sortedPaths) {
            if (isComplement) {
                const { data: existingFolder } = await supabase
                    .from('bb_folders').select('id').eq('set_id', setId).eq('path', folderPath).maybeSingle();
                if (existingFolder) { folderMap[folderPath] = existingFolder.id; continue; }
            }
            const parts = folderPath.split('/');
            const name = parts[parts.length - 1];
            const parentPath = parts.slice(0, -1).join('/');
            const parentId = parentPath ? folderMap[parentPath] : null;
            const { data: folder, error: folderErr } = await supabase
                .from('bb_folders').insert({ set_id: setId, parent_id: parentId, name, path: folderPath }).select('id').single();
            if (folderErr) throw folderErr;
            folderMap[folderPath] = folder.id;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const uploaderId = session?.user?.id;
        if (!token || !uploaderId) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión antes de subir archivos.');

        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://campuslink-api.cajaupazul.workers.dev';
        const cycleId = selectedCycleId === 'historical' ? null : selectedCycleId;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            setBbProgressMsg(`Subiendo ${i + 1} de ${entries.length}: ${entry.file.name}`);

            const storagePath = buildBlackboardStoragePath({
                courseId,
                cycleId,
                professorId,
                setId,
                relativePath: entry.relativePath,
            });

            const uploadResponse = await fetch(`${apiBase}/storage/upload?path=${encodeURIComponent(storagePath)}&bucket=course-materials`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': entry.file.type || 'application/octet-stream',
                },
                body: entry.file,
            });

            if (!uploadResponse.ok) {
                const details = await uploadResponse.json().catch(() => null) as { error?: string } | null;
                throw new Error(details?.error || `No se pudo subir ${entry.file.name}`);
            }

            const fileParts = entry.relativePath.split('/');
            fileParts.pop();
            const folderPath = fileParts.join('/');
            const folderId = folderPath ? folderMap[folderPath] : null;

            const { error: fileError } = await supabase.from('bb_files').insert({
                set_id: setId,
                folder_id: folderId,
                name: entry.file.name,
                storage_path: storagePath,
                relative_path: entry.relativePath,
                size_bytes: entry.file.size,
                mime_type: entry.file.type,
                uploaded_by: uploaderId,
            });

            if (fileError) {
                await fetch(`${apiBase}/storage/delete?path=${encodeURIComponent(storagePath)}&bucket=course-materials`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }).catch(() => null);
                throw new Error(`No se pudo registrar ${entry.file.name}: ${fileError.message}`);
            }

            setBbProgress(Math.round(((i + 1) / entries.length) * 100));
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

        if (uploadMethod === 'bb-folder') {
            if (professorId === 'none') {
                alert('Por favor selecciona un profesor para asociar la carpeta.');
                return;
            }
            if (bbFiles.length === 0) {
                alert('Por favor selecciona una carpeta para subir.');
                return;
            }
            setUploading(true);
            try {
                let cicloName = 'Histórico';
                if (selectedCycleId !== 'historical') {
                    const cy = courseCycles.find(c => c.id === selectedCycleId);
                    if (cy) cicloName = cy.ciclo_name;
                }

                const { data: existing } = await supabase
                    .from('bb_material_sets')
                    .select('id')
                    .eq('course_id', courseId)
                    .eq('professor_id', professorId)
                    .eq('course_name', bbRootName)
                    .eq('ciclo', cicloName)
                    .maybeSingle();

                let setId = existing?.id;
                if (existing) {
                    const { data: existingFiles } = await supabase
                        .from('bb_files')
                        .select('relative_path')
                        .eq('set_id', setId);
                    const existingPaths = new Set((existingFiles || []).map((f: any) => f.relative_path).filter(Boolean));
                    const newFiles = bbFiles.filter(f => !existingPaths.has(f.relativePath));
                    if (newFiles.length === 0) {
                        alert('Todos los archivos de esta carpeta ya existen en este ciclo para este profesor.');
                        setUploading(false);
                        return;
                    }
                    await uploadBbFiles(setId!, newFiles, true);
                } else {
                    const { data: newSet, error: setErr } = await supabase
                        .from('bb_material_sets')
                        .insert({
                            professor_id: professorId,
                            course_id: courseId,
                            course_name: bbRootName,
                            ciclo: cicloName,
                            cycle_id: selectedCycleId === 'historical' ? null : selectedCycleId,
                            uploaded_by: (await supabase.auth.getUser()).data.user?.id,
                        })
                        .select('id')
                        .single();
                    if (setErr) throw setErr;
                    setId = newSet.id;
                    await uploadBbFiles(setId!, bbFiles, false);
                }
                router.push(`/dashboard/courses/view?id=${courseId}&cycle=${selectedCycleId}`);
                router.refresh();
            } catch (err: any) {
                alert(err.message || 'Error al subir la carpeta');
            } finally {
                setUploading(false);
            }
            return;
        }

        if (!selectedSubfolder) {
            alert('Por favor selecciona la carpeta de destino primero');
            return;
        }

        if (uploadMethod === 'file') {
            const hasFiles = Object.values(filesMap).some(arr => arr.length > 0);
            if (!hasFiles) {
                alert('Por favor selecciona al menos un archivo');
                return;
            }
        } else {
            const hasLinks = Object.values(linksMap).some(arr => arr.some(l => l.url));
            if (!hasLinks) {
                alert('Por favor ingresa la URL de al menos un enlace');
                return;
            }
            const hasInvalidLink = Object.values(linksMap).some(arr => arr.some(l => l.titulo && !l.url));
            if (hasInvalidLink) {
                alert('Por favor completa la URL para los enlaces con título');
                return;
            }
        }

        setUploading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');
            const userId = user.id;

            if (uploadMethod === 'link') {
                const allLinks: { titulo: string; url: string; target: string }[] = [];
                Object.entries(linksMap).forEach(([folderKey, linkArray]) => {
                    linkArray.forEach(l => {
                        if (l.url) allLinks.push({ ...l, target: folderKey });
                    });
                });

                const nowMs = Date.now();
                for (let i = 0; i < allLinks.length; i++) {
                    const link = allLinks[i];
                    const linkCreatedAt = new Date(nowMs - i * 1000).toISOString();
                    const finalTipo = link.target === 'General' ? selectedSubfolder : link.target;

                    const { error: insertError } = await supabase.from('materials').insert({
                        course_id: courseId,
                        user_id: userId,
                        professor_id: professorId === 'none' ? null : professorId,
                        titulo: link.titulo || 'Enlace Externo',
                        url_archivo: link.url,
                        tipo: finalTipo,
                        cycle_id: selectedCycleId === 'historical' ? null : selectedCycleId,
                        descargas: 0,
                        created_at: linkCreatedAt,
                    });
                    if (insertError) throw new Error(`Error al guardar enlace: ${insertError.message}`);
                }
            } else {
                const allFiles: { file: File; target: string }[] = [];
                Object.entries(filesMap).forEach(([folderKey, fileArray]) => {
                    fileArray.forEach(f => {
                        allFiles.push({ file: f, target: folderKey });
                    });
                });

                // 1. Upload all files to R2 in parallel
                const uploadedFilesInfo = await Promise.all(allFiles.map(async ({ file, target }) => {
                    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
                    const finalSection = target === 'General' ? selectedSubfolder : target;
                    const storagePath = buildCourseMaterialPath({
                        courseId,
                        cycleId: selectedCycleId === 'historical' ? null : selectedCycleId,
                        section: finalSection,
                        fileName: file.name,
                    });

                    const { uploadFileToR2 } = await import('@/lib/r2-storage');

                    let thumbnailUrl: string | null = null;
                    const thumbnailBlob = await generateThumbnailFromFile(file);
                    if (thumbnailBlob) {
                        try {
                            const thumbFileName = `thumb_${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
                            const { data: thumbData } = await supabase.storage
                                .from('thumbnails')
                                .upload(thumbFileName, thumbnailBlob, {
                                    contentType: 'image/webp',
                                    upsert: false,
                                });

                            if (thumbData) {
                                const { data: publicData } = supabase.storage
                                    .from('thumbnails')
                                    .getPublicUrl(thumbFileName);
                                thumbnailUrl = publicData.publicUrl;
                            }
                        } catch (thumbErr) {
                            console.warn('[THUMBNAIL] Failed:', thumbErr);
                        }
                    }

                    const materialUrl = await uploadFileToR2('course-materials', storagePath, file);
                    return { file, materialUrl, thumbnailUrl, fileExt, target, storagePath };
                }));

                // 2. Insert into DB with explicitly staggered timestamps
                const nowMs = Date.now();
                for (let i = 0; i < uploadedFilesInfo.length; i++) {
                    const info = uploadedFilesInfo[i];
                    const { file, materialUrl, thumbnailUrl, fileExt, target, storagePath } = info;

                    const fileCreatedAt = new Date(nowMs - i * 1000).toISOString();
                    const finalTipo = target === 'General' ? selectedSubfolder : target;

                    const { error: insertError } = await supabase.from('materials').insert({
                        course_id: courseId,
                        user_id: userId,
                        professor_id: professorId === 'none' ? null : professorId,
                        titulo: file.name.split('.')[0] || file.name,
                        url_archivo: materialUrl,
                        storage_path: storagePath,
                        tipo: finalTipo,
                        cycle_id: selectedCycleId === 'historical' ? null : selectedCycleId,
                        descargas: 0,
                        thumbnail_url: thumbnailUrl,
                        created_at: fileCreatedAt,
                    });

                    if (insertError) {
                        const { deleteFileFromR2 } = await import('@/lib/r2-storage');
                        await deleteFileFromR2('course-materials', storagePath).catch(() => false);
                        throw new Error(`Error al guardar ${file.name}: ${insertError.message}`);
                    }

                    if (finalTipo === '📖 Sílabo y Cronograma') {
                        await supabase
                            .from('courses')
                            .update({ syllabus_url: materialUrl })
                            .eq('id', courseId);
                    }

                    const officeExtensions = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
                    if (!thumbnailUrl && officeExtensions.includes(fileExt)) {
                        try {
                            const { triggerFileConversion } = await import('@/lib/converter');
                            const urlObj = new URL(materialUrl);
                            const fileKey = urlObj.searchParams.get('path') || materialUrl.split('/course-materials/')[1];
                            if (fileKey) {
                                await triggerFileConversion(decodeURIComponent(fileKey), 'course-materials');
                            }
                        } catch (e) {
                            console.warn('[CONVERTER] Trigger failed:', e);
                        }
                    }
                }
            }

            router.push(`/dashboard/courses/view?id=${courseId}&cycle=${selectedCycleId}`);
            router.refresh();
        } catch (error: any) {
            console.error('Error:', error);
            alert(error.message || 'Error al procesar el material');
        } finally {
            setUploading(false);
        }
    };

    // Calculate active zones to render
    const isExams = selectedSubfolder === '📝 Exámenes';
    const nestedSubfolders = isExams && selectedCycleId !== 'historical'
        ? courseCycles.find(c => c.id === selectedCycleId)?.active_subfolders?.filter((s: string) => !PREDEFINED_SUBFOLDERS.includes(s)) || []
        : [];
        
    const dropzoneKeys = (isExams && nestedSubfolders.length > 0)
        ? [...nestedSubfolders, 'General']
        : ['General'];

    const totalSelectedFiles = Object.values(filesMap).reduce((acc, arr) => acc + arr.length, 0);
    const hasAnyFilesSelected = totalSelectedFiles > 0;
    const hasAnyLinksEntered = Object.values(linksMap).some(arr => arr.some(l => l.url));
    const isReadyForFiles = uploadMethod === 'link' ? hasAnyLinksEntered : hasAnyFilesSelected;

    const isReadyForBbFolder = uploadMethod === 'bb-folder' && bbFiles.length > 0 && professorId !== 'none';
    const isReadyToSubmit = uploadMethod === 'bb-folder' ? isReadyForBbFolder : isReadyForFiles;
    const selectedCycle = courseCycles.find((cycle: any) => cycle.id === selectedCycleId);
    const selectedProfessor = allProfessors.find((professor: any) => professor.id === professorId);
    const bbFolderCount = new Set(
        bbFiles
            .map((entry) => entry.relativePath.split('/').slice(0, -1).join('/'))
            .filter(Boolean)
    ).size;
    const bbTotalBytes = bbFiles.reduce((total, entry) => total + entry.file.size, 0);

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 min-h-screen bg-bb-dark">
            <div className="mb-8">
                <Button
                    variant="ghost"
                    className="pl-0 text-bb-text-secondary hover:bg-transparent hover:text-blue-400 mb-2 transition-colors"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver al curso
                </Button>
                <h1 className="text-3xl font-black text-bb-text uppercase tracking-tight">Subir Material</h1>
                <p className="text-bb-text-secondary mt-2 font-medium">
                    Comparte tus recursos con la comunidad de <span className="font-bold text-blue-400">{courseName}</span>.
                </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-8 bg-bb-card p-6 md:p-8 rounded-xl shadow-2xl border border-bb-border shadow-black/10 dark:shadow-black/40 flex flex-col">

                {/* BB UPLOAD PROGRESS OVERLAY */}
                {uploading && uploadMethod === 'bb-folder' && (
                    <div className="flex flex-col items-center justify-center py-12 gap-6">
                        {/* Animated folder icon */}
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border-2 border-blue-500/40 flex items-center justify-center animate-pulse">
                                <FolderUp className="h-9 w-9 text-blue-400" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                            </div>
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-lg font-black text-bb-text">Subiendo carpeta...</p>
                            <p className="text-sm text-blue-400 font-bold">{bbRootName}</p>
                        </div>

                        {/* Main progress bar */}
                        <div className="w-full max-w-md space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-bb-text-secondary truncate max-w-[80%]">{bbProgressMsg}</span>
                                <span className="text-blue-400 shrink-0 ml-2">{bbProgress}%</span>
                            </div>
                            <div className="w-full bg-bb-sidebar rounded-full h-3 overflow-hidden border border-bb-border">
                                <div
                                    className="relative h-3 overflow-hidden rounded-full bg-blue-500 transition-all duration-500 ease-out"
                                    style={{ width: `${bbProgress}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-bb-text-secondary/60 text-center">
                                {bbProgress < 10 ? 'Preparando estructura de carpetas...' : `${Math.round(bbProgress / 100 * bbFiles.length)} de ${bbFiles.length} archivos subidos`}
                            </p>
                        </div>

                        <p className="text-[11px] text-bb-text-secondary/50 text-center max-w-xs">
                            No cierres esta página hasta que termine la subida.
                        </p>
                    </div>
                )}

                {/* NORMAL FORM CONTENT — hidden while bb-folder uploading */}
                <div className={uploading && uploadMethod === 'bb-folder' ? 'hidden' : ''}>

                {/* 1. DESTINO Y ASOCIACIÓN (Top Row) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Destino */}
                    <div className="space-y-4">
                        <Label className="text-lg font-black text-bb-text uppercase tracking-tight flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${(selectedSubfolder || uploadMethod === 'bb-folder') ? 'bg-green-500/20 text-green-500 border-green-500/50' : 'bg-bb-sidebar text-blue-400 border border-bb-border'}`}>
                                {(selectedSubfolder || uploadMethod === 'bb-folder') ? <CheckCircle className="w-4 h-4" /> : '1'}
                            </span>
                            {uploadMethod === 'bb-folder' ? 'Ciclo y Profesor' : 'Destino del Archivo'}
                        </Label>

                        <div className="space-y-4 bg-bb-sidebar/50 p-5 rounded-xl border border-bb-border">
                            <div>
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 block px-1">¿A qué Ciclo pertenece?</Label>
                                <Select value={selectedCycleId} onValueChange={(val) => {
                                    setSelectedCycleId(val);
                                    setSelectedSubfolder('');
                                }}>
                                    <SelectTrigger className="h-12 bg-bb-card border-bb-border text-bb-text rounded-xl focus:ring-blue-500/20">
                                        <SelectValue placeholder="Selecciona un ciclo" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-bb-dark border border-bb-border text-bb-text rounded-xl shadow-xl max-h-60 z-[9999]">
                                        <SelectItem value="historical" className="hover:bg-bb-card focus:bg-bb-card cursor-pointer py-2 font-bold">
                                            Sin ciclo / archivo histórico
                                        </SelectItem>
                                        {courseCycles.map((cycle: any) => (
                                            <SelectItem key={cycle.id} value={cycle.id} className="hover:bg-bb-card focus:bg-bb-card cursor-pointer py-2">
                                                Ciclo {cycle.ciclo_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedCycleId === 'historical' && (
                                <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-medium leading-relaxed text-amber-300">
                                    Usa esta opción solo si el material no pertenece a un ciclo. Para una carpeta Blackboard reciente, selecciona el ciclo correspondiente.
                                </p>
                            )}

                            {uploadMethod !== 'bb-folder' && (
                            <div>
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 block px-1">Sección o Carpeta</Label>
                                <Select value={selectedSubfolder} onValueChange={setSelectedSubfolder}>
                                    <SelectTrigger className="h-12 bg-bb-card border-bb-border text-bb-text rounded-xl focus:ring-blue-500/20">
                                        <SelectValue placeholder="Selecciona una sección..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-bb-dark border border-bb-border text-bb-text rounded-xl shadow-xl max-h-60 z-[9999]">
                                        {PREDEFINED_SUBFOLDERS.map((sub: string) => (
                                            <SelectItem key={sub} value={sub} className={`hover:bg-bb-card focus:bg-bb-card cursor-pointer py-2 font-bold ${sub === '📝 Exámenes' ? 'text-blue-400' : ''}`}>
                                                {sub}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            )}
                        </div>
                    </div>

                    {/* Asociación */}
                    <div className="space-y-4">
                        <Label className="text-lg font-black text-bb-text uppercase tracking-tight flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-bb-sidebar text-blue-400 border border-bb-border flex items-center justify-center text-xs font-black">2</span>
                            Asociación
                        </Label>

                        <div className="p-5 bg-bb-sidebar/50 rounded-xl border border-bb-border">
                            <div className="flex items-center justify-between mb-3">
                                <Label htmlFor="professor" className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 px-1">Profesor del curso</Label>
                                <Link
                                    href="/dashboard/professors"
                                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline uppercase tracking-wider"
                                    target="_blank"
                                >
                                    <UserPlus className="h-3 w-3" />
                                    Nuevo Profesor
                                </Link>
                            </div>

                            <Select value={professorId} onValueChange={setProfessorId}>
                                <SelectTrigger className="h-12 bg-bb-card border-bb-border text-bb-text rounded-xl focus:ring-blue-500/20">
                                    <SelectValue placeholder="Seleccionar profesor..." />
                                </SelectTrigger>
                                <SelectContent className="bg-bb-card border-bb-border text-bb-text rounded-xl max-h-[300px] overflow-y-auto z-[9999]">
                                    <SelectItem value="none" className="focus:bg-blue-600 focus:text-white rounded-lg">
                                        <span className="text-bb-text-secondary italic font-bold text-blue-400">Todo / Material General</span>
                                    </SelectItem>
                                    {allProfessors.map((prof: any) => (
                                        <SelectItem key={prof.id} value={prof.id} className="focus:bg-blue-600 focus:text-white rounded-lg">
                                            <span className="font-bold">{prof.nombre}</span>
                                            {prof.matchedCourse && (
                                                <span className="ml-2 text-[10px] opacity-50 font-medium">
                                                    ({prof.matchedCourse})
                                                </span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <p className="text-[10px] text-bb-text-secondary mt-4 leading-relaxed italic font-medium">
                                Si el material corresponde a una clase específica de un profesor, selecciónalo aquí. Esto ayudará a otros a buscarlo.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. ARCHIVOS / LINKS / CARPETA BB (Bottom Section) */}
                <div className="space-y-4 pt-4 border-t border-bb-border/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <Label className="text-lg font-black text-bb-text uppercase tracking-tight flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${isReadyToSubmit ? 'bg-green-500/20 text-green-500 border-green-500/50' : 'bg-bb-sidebar text-blue-400 border border-bb-border'}`}>
                                {isReadyToSubmit ? <CheckCircle className="w-4 h-4" /> : '3'}
                            </span>
                            {uploadMethod === 'bb-folder' ? 'Carpeta Blackboard' : 'Selecciona los archivos'}
                        </Label>

                        <div className="flex bg-bb-darker rounded-xl p-1 w-max border border-bb-border">
                            <button
                                type="button"
                                onClick={() => setUploadMethod('file')}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-bold rounded-lg transition-colors ${uploadMethod === 'file' ? 'bg-blue-600 text-white' : 'text-bb-text-secondary hover:text-bb-text'}`}
                            >
                                <Files className="h-4 w-4" /> Archivos
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setUploadMethod('link');
                                    if (!linksMap['General']) setLinksMap(prev => ({ ...prev, 'General': [{ titulo: '', url: '' }]}));
                                }}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-bold rounded-lg transition-colors ${uploadMethod === 'link' ? 'bg-blue-600 text-white' : 'text-bb-text-secondary hover:text-bb-text'}`}
                            >
                                <Link2 className="h-4 w-4" /> Enlaces
                            </button>
                            <button
                                type="button"
                                onClick={() => setUploadMethod('bb-folder')}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-wider font-bold rounded-lg transition-colors ${uploadMethod === 'bb-folder' ? 'bg-blue-600 text-white' : 'text-bb-text-secondary hover:text-bb-text'}`}
                            >
                                <FolderUp className="h-4 w-4" /> Blackboard
                            </button>
                        </div>
                    </div>

                    {/* BLACKBOARD FOLDER UPLOAD UI */}
                    {uploadMethod === 'bb-folder' && (
                        <div className="space-y-4">
                            <div className="grid gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 sm:grid-cols-[auto_1fr]">
                                <FolderTree className="mt-0.5 h-5 w-5 text-blue-400" />
                                <div className="text-sm leading-relaxed text-bb-text-secondary">
                                    <p className="font-bold text-bb-text">Importar carpeta descargada de Blackboard</p>
                                    <p className="mt-1">Se conservarán sus subcarpetas y cada archivo quedará atribuido a tu usuario, al ciclo y al profesor seleccionados.</p>
                                    <p className="mt-2 text-xs font-bold text-blue-400">
                                        Destino: {selectedCycle ? `Ciclo ${selectedCycle.ciclo_name}` : 'Sin ciclo'} · {selectedProfessor?.nombre || 'Selecciona un profesor'}
                                    </p>
                                </div>
                            </div>

                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                                    ${bbFiles.length > 0
                                        ? 'border-blue-500 bg-blue-500/5'
                                        : 'border-bb-border hover:border-blue-500 hover:bg-bb-darker/50'}`}
                                onClick={() => document.getElementById('bb-folder-input')?.click()}
                            >
                                <input
                                    id="bb-folder-input"
                                    type="file"
                                    className="hidden"
                                    // @ts-ignore
                                    webkitdirectory=""
                                    directory=""
                                    multiple
                                    onChange={handleFolderSelect}
                                />
                                <div className="flex flex-col items-center gap-3">
                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all
                                        ${bbFiles.length > 0 ? 'bg-blue-600 text-white' : 'bg-bb-darker border border-bb-border text-blue-400'}`}>
                                        <FolderUp className="h-6 w-6" />
                                    </div>
                                    {bbFiles.length > 0 ? (
                                        <div className="space-y-1">
                                            <p className="font-black text-blue-400 text-sm">{bbRootName}</p>
                                            <p className="text-xs text-bb-text-secondary">{bbFiles.length} archivos · {bbFolderCount} carpetas · {(bbTotalBytes / 1024 / 1024).toFixed(1)} MB</p>
                                            <p className="text-[10px] text-bb-text-secondary/60 italic">Clic para cambiar carpeta</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <p className="font-bold text-bb-text text-sm">Seleccionar Carpeta</p>
                                            <p className="text-xs text-bb-text-secondary">Haz clic para elegir la carpeta descargada de Blackboard</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {bbFiles.length > 0 && (
                                <div className="bg-bb-sidebar/50 rounded-xl border border-bb-border p-4 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-bb-text-secondary">Vista previa de estructura</p>
                                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                        {Array.from(new Set(bbFiles.map(f => f.relativePath.split('/').slice(0, -1).join('/')))).filter(Boolean).slice(0, 20).map((folder, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs text-bb-text-secondary py-0.5">
                                                <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" />
                                                <span className="font-medium">{folder}</span>
                                            </div>
                                        ))}
                                        {bbFiles.slice(0, 8).map((f, i) => (
                                            <div key={`f-${i}`} className="flex items-center gap-2 text-xs text-bb-text-secondary py-0.5 pl-4">
                                                <FileTypeIcon fileName={f.file.name} mimeType={f.file.type} size="sm" />
                                                <span className="truncate max-w-[300px]">{f.file.name}</span>
                                                <span className="text-bb-text-secondary/50 shrink-0">{(f.file.size / 1024 / 1024).toFixed(1)} MB</span>
                                            </div>
                                        ))}
                                        {bbFiles.length > 8 && (
                                            <p className="text-[10px] text-bb-text-secondary/50 pl-4">...y {bbFiles.length - 8} archivos más</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {uploading && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-bb-text-secondary">
                                        <span>{bbProgressMsg}</span>
                                        <span>{bbProgress}%</span>
                                    </div>
                                    <div className="w-full bg-bb-sidebar rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${bbProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DYNAMIC DROPZONES (files / links) */}
                    {uploadMethod !== 'bb-folder' && (
                    <div className={`transition-opacity duration-300 ${!selectedSubfolder ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>

                    {/* DYNAMIC DROPZONES */}
                    <div className={dropzoneKeys.length > 1 ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "w-full space-y-4"}>
                        {dropzoneKeys.map((key) => {
                            const isGeneral = key === 'General';
                            const label = isGeneral 
                                ? (dropzoneKeys.length > 1 ? 'Material General' : selectedSubfolder || 'General') 
                                : key;

                            if (uploadMethod === 'link') {
                                const currentLinks = linksMap[key] || [{ titulo: '', url: '' }];
                                return (
                                    <div key={`link-${key}`} className="space-y-4 bg-bb-sidebar/30 p-5 rounded-xl border border-bb-border">
                                        <Label className="text-sm font-black text-blue-400 uppercase tracking-widest px-1">{label}</Label>
                                        <div className="space-y-3">
                                            {currentLinks.map((link, index) => (
                                                <div key={index} className="flex flex-col gap-2 p-3 bg-bb-darker/50 rounded-xl border border-bb-border relative">
                                                    {currentLinks.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLinkRow(key, index)}
                                                            className="absolute top-2 right-2 p-1 text-red-400 hover:bg-red-500/10 rounded-lg z-10"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-black uppercase text-bb-text-secondary tracking-widest pl-1">Título</Label>
                                                        <Input
                                                            placeholder="Ej: Video de la clase"
                                                            value={link.titulo}
                                                            onChange={(e) => updateLink(key, index, 'titulo', e.target.value)}
                                                            className="bg-bb-card border-bb-border text-bb-text text-sm h-10 rounded-lg"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-black uppercase text-bb-text-secondary tracking-widest pl-1">Enlace *</Label>
                                                        <Input
                                                            placeholder="https://..."
                                                            value={link.url}
                                                            onChange={(e) => updateLink(key, index, 'url', e.target.value)}
                                                            className="bg-bb-card border-bb-border text-bb-text text-sm h-10 rounded-lg pr-8"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => addLinkRow(key)}
                                                className="w-full h-10 text-[11px] border-dashed border-2 border-bb-border text-bb-text-secondary hover:text-blue-400 hover:border-blue-500/50 rounded-xl font-bold transition-all"
                                            >
                                                + Agregar Enlace
                                            </Button>
                                        </div>
                                    </div>
                                );
                            }

                            // File Upload UI
                            const currentFiles = filesMap[key] || [];
                            return (
                                <div key={`file-${key}`} className={`space-y-4 bg-bb-sidebar/30 p-5 rounded-xl border transition-all duration-300 ${currentFiles.length > 0 ? 'border-blue-500/40 bg-blue-500/5 shadow-lg shadow-blue-500/5' : 'border-bb-border'}`}>
                                    <Label className="text-sm font-black text-blue-400 uppercase tracking-widest px-1">{label}</Label>
                                    
                                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${currentFiles.length > 0 ? 'border-blue-500 bg-blue-500/10' : 'border-bb-border hover:border-blue-500 hover:bg-bb-darker/50'}`}>
                                        <input
                                            id={`file-${key}`}
                                            type="file"
                                            multiple
                                            onChange={(e) => handleFileChange(e, key)}
                                            className="hidden"
                                            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                                        />
                                        <label htmlFor={`file-${key}`} className="cursor-pointer flex flex-col items-center justify-center w-full h-full gap-3">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform active:scale-90 ${currentFiles.length > 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-bb-darker text-blue-400 border border-bb-border'}`}>
                                                <Upload className="h-5 w-5" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-bb-text">Subir archivos</p>
                                                {dropzoneKeys.length === 1 && <p className="text-[10px] text-bb-text-secondary">Arrastra o haz clic aquí</p>}
                                            </div>
                                        </label>
                                    </div>

                                    {currentFiles.length > 0 && (
                                        <div className="space-y-2 mt-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                                            {currentFiles.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between p-2.5 bg-bb-card rounded-lg border border-bb-border group hover:border-blue-500/30 transition-all">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <FileTypeIcon fileName={f.name} mimeType={f.type} size="sm" />
                                                        <div className="min-w-0 pr-2">
                                                            <p className="text-[11px] font-bold text-bb-text truncate leading-tight">{f.name}</p>
                                                            <p className="text-[9px] text-bb-text-secondary mt-0.5">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(key, i)}
                                                        className="p-1.5 hover:bg-red-500/10 text-bb-text-secondary hover:text-red-500 rounded-md transition-all shrink-0"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    </div>
                    )}
                </div>

                <div className="pt-6 border-t border-bb-border flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        className="w-full sm:w-32 text-bb-text-secondary hover:text-bb-text hover:bg-bb-hover font-bold rounded-xl"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={uploading || !isReadyToSubmit}
                        className={`w-full sm:w-64 shadow-lg transition-all text-white font-black uppercase tracking-widest text-xs h-12 rounded-xl active:scale-95 disabled:opacity-50
                            bg-blue-600 hover:bg-blue-700 shadow-blue-600/20`}
                    >
                        {uploading
                            ? (uploadMethod === 'bb-folder' ? bbProgressMsg || 'Procesando...' : 'Subiendo...')
                            : uploadMethod === 'link'
                                ? 'Guardar Enlaces'
                                : uploadMethod === 'bb-folder'
                                    ? `Subir Carpeta (${bbFiles.length} archivos)`
                                    : `Cargar ${totalSelectedFiles || ''} Archivos`}
                    </Button>
                </div>
                </div>{/* end normal form content */}
            </form>
        </div>
    );
}
