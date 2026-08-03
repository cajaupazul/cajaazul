'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseOfertaText } from '@/lib/pdf-schedule-parser';
import { CheckCircle2, RefreshCw, AlertCircle, Users, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDiversifiedProfessorBackground } from '@/lib/constants';

interface SyncProfessorsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface ProfessorPreview {
    nombre: string;
    courses: { codigo: string; nombre: string; exists: boolean }[];
    isNew: boolean;
    existingId?: string;
    existingCursosString?: string;
    existingEspecialidad?: string;
    existingBackground?: string;
}

const INVALID_NAMES = new Set(['PENDIENTE', 'SIN DOCENTE', 'SIN PROFESOR', 'POR ASIGNAR', 'PEND']);

// Helper to chunk large arrays to prevent Supabase URI Too Long errors
function chunkArray<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, (i + 1) * size)
    );
}

export default function SyncProfessorsModal({ open, onOpenChange, onSuccess }: SyncProfessorsModalProps) {
    const [step, setStep] = useState<'input' | 'preview' | 'syncing' | 'done'>('input');
    const [pastedText, setPastedText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedProfessors, setParsedProfessors] = useState<ProfessorPreview[]>([]);
    const [totalCoursesFound, setTotalCoursesFound] = useState(0);

    const handleParse = async () => {
        if (!pastedText.trim()) return;
        setIsParsing(true);
        try {
            // 1. Parse Excel Text using the external parser for full schedules
            const result = await parseOfertaText(pastedText);

            // 1.5 Custom parser for simple schedule-less lists
            const simpleProfMap = new Map<string, Map<string, string>>();
            const lines = pastedText.split('\n').map(l => l.trimRight());
            let currentCodigo = '';
            let currentCurso = '';

            for (const line of lines) {
                if (!line.trim()) continue;

                // Try course header: "120266 - Antiguo Perú..." or "123456 - Algo\t"
                const courseMatch = line.match(/^([A-Z0-9]{4,8})\s*[-–]\s*(.+?)(?:\t|$)/);
                if (courseMatch) {
                    currentCodigo = courseMatch[1];
                    currentCurso = courseMatch[2].trim();
                    continue;
                }

                // Try professor line: "A\tPARDO GRAU, Cecilia" or "A   DE VEGA DE UNCETA..."
                const profMatch = line.match(/^([A-Z0-9]{1,3})(?:\t|\s{2,})(.*)$/);

                if (profMatch) {
                    const seccion = profMatch[1].trim();
                    const profNamesStr = profMatch[2].trim();

                    if (profNamesStr.length > 3) {
                        const profs = profNamesStr.split('/').map(p => p.trim().toUpperCase());

                        for (let name of profs) {
                            name = name.replace(/\n/g, ' ').replace(/\s+/g, ' ');
                            if (name && currentCodigo && name.length >= 5 && !INVALID_NAMES.has(name)) {
                                if (!simpleProfMap.has(name)) simpleProfMap.set(name, new Map());
                                simpleProfMap.get(name)!.set(currentCodigo, currentCurso);
                            }
                        }
                    }
                }
            }


            // 2. Extract unique professors and their courses combining both parsers
            const profMap = new Map<string, Map<string, string>>(); // name -> Map<codigo, cursoNombre>

            // Add results from normal parser
            for (const o of result.ofertas) {
                if (!o.profesor) continue;
                const rawNames = o.profesor.split('/').map(n => n.trim().toUpperCase());

                for (let name of rawNames) {
                    name = name.replace(/\n/g, ' ').replace(/\s+/g, ' ');
                    if (name.length < 5 || INVALID_NAMES.has(name)) continue;

                    if (!profMap.has(name)) profMap.set(name, new Map());
                    profMap.get(name)!.set(o.codigo_curso, o.nombre_curso);
                }
            }

            // Add results from simple parser
            for (const [name, courses] of simpleProfMap.entries()) {
                if (!profMap.has(name)) profMap.set(name, new Map());
                const map = profMap.get(name)!;
                for (const [codigo, curso] of courses.entries()) {
                    map.set(codigo, curso);
                }
            }

            if (profMap.size === 0) {
                throw new Error("No se encontraron profesores válidos en el texto.");
            }

            // 3. Collect all unique course codes to build existing mapping
            const allCodigos = new Set<string>();
            profMap.forEach(courses => {
                courses.forEach((_, codigo) => allCodigos.add(codigo));
            });

            // 4. Fetch existing courses from 'courses' main directory to check validity
            const codigosArr = Array.from(allCodigos);
            const courseChunks = chunkArray(codigosArr, 50);
            const existingCourses: any[] = [];

            for (const chunk of courseChunks) {
                const { data, error: cErr } = await supabase
                    .from('courses')
                    .select('id, codigo')
                    .in('codigo', chunk);
                if (cErr) throw cErr;
                if (data) existingCourses.push(...data);
            }
            const existingCourseCodigos = new Set(existingCourses.map(c => c.codigo));

            // 5. Fetch existing professors to know if we are updating or creating
            const provsArr = Array.from(profMap.keys());
            const profChunks = chunkArray(provsArr, 50);
            const existingProfs: any[] = [];

            for (const chunk of profChunks) {
                const { data, error: pErr } = await supabase
                    .from('professors')
                    .select('id, nombre, especialidad, otros_cursos, background_image_url')
                    .in('nombre', chunk);
                if (pErr) throw pErr;
                if (data) existingProfs.push(...data);
            }

            const existingProfsMap = new Map(existingProfs.map(p => [p.nombre.toUpperCase(), p]));

            // 6. Build Preview Data
            const previewData: ProfessorPreview[] = [];
            let totalC = 0;

            for (const [name, coursesMap] of profMap.entries()) {
                const courseList = Array.from(coursesMap.entries()).map(([codigo, nombre]) => ({
                    codigo,
                    nombre,
                    exists: existingCourseCodigos.has(codigo)
                }));

                const existingProf = existingProfsMap.get(name);

                previewData.push({
                    nombre: name,
                    courses: courseList,
                    isNew: !existingProf,
                    existingId: existingProf?.id,
                    existingCursosString: existingProf?.otros_cursos,
                    existingEspecialidad: existingProf?.especialidad,
                    existingBackground: existingProf?.background_image_url
                });

                totalC += courseList.length;
            }

            // 7. Sort preview data alphabetically
            previewData.sort((a, b) => a.nombre.localeCompare(b.nombre));

            setParsedProfessors(previewData);
            setTotalCoursesFound(totalC);
            setStep('preview');

        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Error al procesar el texto.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleConfirmSync = async () => {
        setStep('syncing');
        try {
            // STEP 1: Upsert Professors
            const upsertPayload = parsedProfessors.map(p => {
                const sortedCourses = p.courses.map(c => c.nombre);

                // Merge with existing logic
                if (!p.isNew) {
                    const existingSet = new Set<string>();
                    if (p.existingEspecialidad) existingSet.add(p.existingEspecialidad);
                    if (p.existingCursosString) p.existingCursosString.split(',').forEach(c => existingSet.add(c.trim()));

                    sortedCourses.forEach(c => existingSet.add(c));
                    const mergedCourses = Array.from(existingSet);
                    const especialidad = mergedCourses.length > 0 ? mergedCourses[0] : null;

                    return {
                        id: p.existingId,
                        nombre: p.nombre,
                        facultad: 'General',
                        universidad: 'Universidad del Pacífico',
                        especialidad: especialidad,
                        otros_cursos: mergedCourses.length > 1 ? mergedCourses.slice(1).join(', ') : null,
                        // Persist background if not already present
                        background_image_url: p.existingBackground || getDiversifiedProfessorBackground(p.nombre, especialidad)
                    };
                } else {
                    const especialidad = sortedCourses.length > 0 ? sortedCourses[0] : null;
                    return {
                        nombre: p.nombre,
                        facultad: 'General',
                        universidad: 'Universidad del Pacífico',
                        especialidad: especialidad,
                        otros_cursos: sortedCourses.length > 1 ? sortedCourses.slice(1).join(', ') : null,
                        avatar_url: '/profes/tl.webp',
                        background_image_url: getDiversifiedProfessorBackground(p.nombre, especialidad)
                    };
                }
            });

            // We do batched upserts if there are many, but usually it's < 500
            const { data: upsertedProfs, error: uErr } = await supabase
                .from('professors')
                .upsert(upsertPayload, { onConflict: 'id' })
                .select('id, nombre');

            if (uErr) throw uErr;

            // Optional STEP 2: course_professors mapping
            // (Only for courses that ACTUALLY exist in the directory)
            if (upsertedProfs && upsertedProfs.length > 0) {
                const nameToIdMap = new Map(upsertedProfs.map((p: any) => [p.nombre.toUpperCase(), p.id]));

                // Fetch full course data to get course UUIDs from Codigos
                const codigosWithExisting = new Set<string>();
                parsedProfessors.forEach(p => p.courses.filter(c => c.exists).forEach(c => codigosWithExisting.add(c.codigo)));

                if (codigosWithExisting.size > 0) {
                    const codigosList = Array.from(codigosWithExisting);
                    const dbCourses: any[] = [];
                    const dbChunks = chunkArray(codigosList, 50);

                    for (const chunk of dbChunks) {
                        const { data } = await supabase
                            .from('catalog_courses')
                            .select('id, codigo')
                            .in('codigo', chunk);
                        if (data) dbCourses.push(...data);
                    }

                    const codeToCatalogIdMap = new Map(dbCourses.map(c => [c.codigo, c.id]));

                    const linksToInsert: { catalog_course_id: string; professor_id: string }[] = [];

                    for (const p of parsedProfessors) {
                        const profId = nameToIdMap.get(p.nombre);
                        if (!profId) continue;

                        for (const course of p.courses) {
                            if (course.exists) {
                                const catalogCourseId = codeToCatalogIdMap.get(course.codigo);
                                if (catalogCourseId) {
                                    linksToInsert.push({ catalog_course_id: catalogCourseId, professor_id: profId });
                                }
                            }
                        }
                    }

                    if (linksToInsert.length > 0) {
                        const { error: lErr } = await supabase.from('course_professors').upsert(linksToInsert, { onConflict: 'professor_id,catalog_course_id', ignoreDuplicates: true });
                        if (lErr) console.warn("Failed to insert course_professors links", lErr);
                    }
                }
            }

            setStep('done');
            setTimeout(() => {
                onSuccess();
                handleReset();
            }, 1500);

        } catch (err: any) {
            console.error("SYNC FATAL ERROR:", err);
            alert("Error al sincronizar: " + (err.message || 'Error desconocido'));
            setStep('preview');
        }
    };

    const handleReset = () => {
        setStep('input');
        setPastedText('');
        setParsedProfessors([]);
        setTotalCoursesFound(0);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val && step !== 'syncing') handleReset();
            else if (val) onOpenChange(true);
        }}>
            <DialogContent className="bg-bb-card border-bb-border text-bb-text sm:max-w-4xl w-[95vw] overflow-y-auto max-h-[90vh] rounded-3xl p-4 md:p-6">

                {step === 'input' && (
                    <>
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-xl md:text-2xl font-black text-blue-400 flex items-center gap-2">
                                <Users className="w-6 h-6" />
                                Sincronización Automática de Profesores
                            </DialogTitle>
                            <DialogDescription className="text-bb-text-secondary text-base">
                                Pega tu cuadro de Excel de oferta académica. El sistema extraerá a todos los docentes, unificará sus cursos y actualizará la base de datos automáticamente.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                            <p className="text-sm text-blue-200">
                                💡 Tip: Los docentes serán convertidos a <strong>MAYÚSCULAS</strong>. Los cursos iluminados serán enlazados con el directorio oficial.
                            </p>
                        </div>

                        <Textarea
                            className="min-h-[300px] bg-bb-darker border-bb-border text-bb-text font-mono text-xs md:text-sm rounded-xl mb-4"
                            placeholder="Ejemplo:
120266 - Antiguo Perú, Arqueología...
A    PARDO GRAU, Cecilia Maria Luisa    CLASE    LUN...
..."
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                        />

                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={handleReset} className="text-bb-text-secondary">
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleParse}
                                disabled={!pastedText.trim() || isParsing}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            >
                                {isParsing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : 'Analizar Text'}
                            </Button>
                        </div>
                    </>
                )}

                {step === 'preview' && (
                    <>
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-xl md:text-2xl font-black flex items-center gap-2 text-bb-text">
                                Vista Previa de Sincronización
                            </DialogTitle>
                            <DialogDescription className="text-bb-text-secondary">
                                Se encontraron <strong className="text-blue-400">{parsedProfessors.length} docentes</strong> dictando en total <strong className="text-blue-400">{totalCoursesFound} cursos</strong> únicos.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex items-center gap-4 mb-4 text-xs font-semibold px-2">
                            <div className="flex items-center gap-1.5 text-blue-400">
                                <span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500/50 block"></span>
                                Curso ya registrado
                            </div>
                            <div className="flex items-center gap-1.5 text-bb-text-secondary">
                                <span className="w-3 h-3 rounded-full bg-gray-800 border border-gray-600 block"></span>
                                Curso nuevo (Opcional)
                            </div>
                            <div className="flex items-center gap-1.5 text-green-400 ml-auto mr-2">
                                <span className="px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/30 text-[10px]">NUEVO</span>
                                Profesor Nuevo
                            </div>
                        </div>

                        <div className="h-[400px] overflow-y-auto bg-bb-sidebar border border-bb-border rounded-xl p-3 md:p-4 mb-4">
                            <div className="flex flex-col gap-3">
                                {parsedProfessors.map((prof, i) => (
                                    <div key={i} className="bg-bb-card border border-bb-border rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-start gap-4">
                                        <div className="flex-shrink-0 w-full md:w-64">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-base text-bb-text truncate">{prof.nombre}</h4>
                                                {prof.isNew && (
                                                    <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                                                        Nuevo
                                                    </span>
                                                )}
                                            </div>
                                            {!prof.isNew && (
                                                <p className="text-xs text-bb-text-secondary mt-1 flex items-center gap-1">
                                                    <RefreshCw className="w-3 h-3" /> Actualizando perfil
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 flex-1">
                                            {prof.courses.map((c, j) => (
                                                <div
                                                    key={j}
                                                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors
                                                        ${c.exists
                                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                                            : 'bg-bb-darker border-bb-border text-bb-text-secondary opacity-70'}
                                                    `}
                                                    title={c.exists ? 'Se enlazará al directorio oficial' : 'Aún no existe en el directorio principal'}
                                                >
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    {c.nombre}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setStep('input')} className="text-bb-text-secondary">
                                Editar Texto
                            </Button>
                            <Button
                                onClick={handleConfirmSync}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            >
                                Iniciar Sincronización
                            </Button>
                        </div>
                    </>
                )}

                {step === 'syncing' && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full border-4 border-bb-sidebar flex items-center justify-center bg-bb-card">
                                <Users className="w-8 h-8 text-blue-500 animate-pulse" />
                            </div>
                            <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-blue-500 border-b-transparent border-l-transparent animate-spin"></div>
                        </div>
                        <h3 className="text-xl font-bold text-bb-text mt-6 mb-2">Sincronizando Base de Datos...</h3>
                        <p className="text-bb-text-secondary text-center max-w-sm">
                            Asignando cursos y guardando {parsedProfessors.length} profesores en el sistema.
                        </p>
                    </div>
                )}

                {step === 'done' && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6 border-2 border-green-500/30">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-bold text-bb-text mb-2">¡Sincronización Exitosa!</h3>
                        <p className="text-bb-text-secondary text-center">
                            Profesores y cursos guardados correctamente.
                        </p>
                    </div>
                )}

            </DialogContent>
        </Dialog>
    );
}
