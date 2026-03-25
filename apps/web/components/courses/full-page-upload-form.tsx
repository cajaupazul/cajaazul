'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, Professor } from '@/lib/supabase';
import { generateThumbnailFromFile } from '@/lib/thumbnail-generator';
import { Upload, X, UserPlus, ArrowLeft, FileText, CheckCircle } from 'lucide-react';
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

export default function FullPageUploadForm({
    courseId,
    courseName,
    allProfessors,
    courseCycles = [],
}: FullPageUploadFormProps) {
    const router = useRouter();
    const [uploading, setUploading] = useState(false);
    
    // Multi-dropzone structural state
    const [uploadMethod, setUploadMethod] = useState<'file' | 'link'>('file');
    const [selectedCycleId, setSelectedCycleId] = useState<string>('historical');
    const [selectedSubfolder, setSelectedSubfolder] = useState<string>('');
    
    const [professorId, setProfessorId] = useState<string>(
        allProfessors.length === 1 ? allProfessors[0].id : 'none'
    );

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

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();

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
                    const originalName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const storagePath = `${Date.now()}-${originalName}.${fileExt}`;

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
                    return { file, materialUrl, thumbnailUrl, fileExt, target };
                }));

                // 2. Insert into DB with explicitly staggered timestamps
                const nowMs = Date.now();
                for (let i = 0; i < uploadedFilesInfo.length; i++) {
                    const info = uploadedFilesInfo[i];
                    const { file, materialUrl, thumbnailUrl, fileExt, target } = info;

                    const fileCreatedAt = new Date(nowMs - i * 1000).toISOString();
                    const finalTipo = target === 'General' ? selectedSubfolder : target;

                    const { error: insertError } = await supabase.from('materials').insert({
                        course_id: courseId,
                        user_id: userId,
                        professor_id: professorId === 'none' ? null : professorId,
                        titulo: file.name.split('.')[0] || file.name,
                        url_archivo: materialUrl,
                        tipo: finalTipo,
                        cycle_id: selectedCycleId === 'historical' ? null : selectedCycleId,
                        descargas: 0,
                        thumbnail_url: thumbnailUrl,
                        created_at: fileCreatedAt,
                    });

                    if (insertError) throw new Error(`Error al guardar ${file.name}: ${insertError.message}`);

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

            router.push(`/dashboard/courses/view?id=${courseId}`);
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
                
                {/* 1. DESTINO Y ASOCIACIÓN (Top Row) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Destino */}
                    <div className="space-y-4">
                        <Label className="text-lg font-black text-bb-text uppercase tracking-tight flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${selectedSubfolder ? 'bg-green-500/20 text-green-500 border-green-500/50' : 'bg-bb-sidebar text-blue-400 border border-bb-border'}`}>
                                {selectedSubfolder ? <CheckCircle className="w-4 h-4" /> : '1'}
                            </span>
                            Destino del Archivo
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
                                            📦 Archivos Históricos (General)
                                        </SelectItem>
                                        {courseCycles.map((cycle: any) => (
                                            <SelectItem key={cycle.id} value={cycle.id} className="hover:bg-bb-card focus:bg-bb-card cursor-pointer py-2">
                                                Ciclo {cycle.ciclo_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

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

                {/* 2. ARCHIVOS / LINKS (Bottom Section) */}
                <div className={`space-y-4 pt-4 border-t border-bb-border/50 transition-opacity duration-300 ${!selectedSubfolder ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <Label className="text-lg font-black text-bb-text uppercase tracking-tight flex items-center gap-2">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${isReadyForFiles ? 'bg-green-500/20 text-green-500 border-green-500/50' : 'bg-bb-sidebar text-blue-400 border border-bb-border'}`}>
                                {isReadyForFiles ? <CheckCircle className="w-4 h-4" /> : '3'}
                            </span>
                            Selecciona los archivos
                        </Label>

                        <div className="flex bg-bb-darker rounded-xl p-1 w-max border border-bb-border">
                            <button
                                type="button"
                                onClick={() => setUploadMethod('file')}
                                className={`px-4 py-2 text-xs uppercase tracking-widest font-bold rounded-lg transition-all ${uploadMethod === 'file' ? 'bg-blue-600 text-white shadow-lg' : 'text-bb-text-secondary hover:text-bb-text'}`}
                            >
                                Archivos
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setUploadMethod('link');
                                    // Make sure a default key exists for links
                                    if (!linksMap['General']) setLinksMap(prev => ({ ...prev, 'General': [{ titulo: '', url: '' }]}));
                                }}
                                className={`px-4 py-2 text-xs uppercase tracking-widest font-bold rounded-lg transition-all ${uploadMethod === 'link' ? 'bg-blue-600 text-white shadow-lg' : 'text-bb-text-secondary hover:text-bb-text'}`}
                            >
                                Enlaces
                            </button>
                        </div>
                    </div>

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
                                                        <FileText className="h-4 w-4 text-blue-400 shrink-0" />
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
                        disabled={uploading || !selectedSubfolder || !isReadyForFiles}
                        className="w-full sm:w-64 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all text-white font-black uppercase tracking-widest text-xs h-12 rounded-xl active:scale-95 disabled:opacity-50"
                    >
                        {uploading ? 'Subiendo...' : (uploadMethod === 'link' ? 'Guardar Enlaces' : `Cargar ${totalSelectedFiles || ''} Archivos`)}
                    </Button>
                </div>
            </form>
        </div>
    );
}
