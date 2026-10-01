'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle2, Loader2, Rocket, Trash2 } from 'lucide-react';
import { parseOfertaFile, parseOfertaText, ParsedOferta } from '@/lib/pdf-schedule-parser';
import { debugExcel } from '@/lib/excel-debug';
import { supabase, AcademicOfferingVersion } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useTheme } from '@/lib/theme-context';

type Props = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
};

const normalizeAcademicPeriod = (value: string) => {
    const upper = value.trim().toUpperCase();
    const match = upper.match(/(20\d{2})\s*[-_/]\s*(II|I|2|1)(?:\D|$)/);
    if (!match) return upper;
    return `${match[1]}-${match[2] === 'II' || match[2] === '2' ? 'II' : 'I'}`;
};

export default function UploadOfertaModal({ open, onClose, onSuccess }: Props) {
    const { profile } = useProfile();
    const { colors } = useTheme();
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [parsedData, setParsedData] = useState<{ periodo: string; ofertas: ParsedOferta[]; errors: string[] } | null>(null);
    const [periodoOverride, setPeriodoOverride] = useState('');
    const [isPasteMode, setIsPasteMode] = useState(false);
    const [pastedText, setPastedText] = useState('');
    const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
    const [showManagePeriodos, setShowManagePeriodos] = useState(false);
    const [versions, setVersions] = useState<AcademicOfferingVersion[]>([]);
    const [loadingPeriodos, setLoadingPeriodos] = useState(false);
    const [createdVersionNumber, setCreatedVersionNumber] = useState<number | null>(null);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(ext || '')) return;
        setFile(f);
        setParsing(true);

        try {
            console.log('[OFERTA_UPLOAD] Parsing file:', f.name, 'type:', ext);
            // Run diagnostic first for Excel files
            if (ext === 'xlsx' || ext === 'xls') {
                await debugExcel(f);
            }
            const result = await parseOfertaFile(f);
            console.log('[OFERTA_UPLOAD] Parse result:', result.ofertas.length, 'ofertas,', result.errors.length, 'errors');
            setParsedData(result);
            setPeriodoOverride(result.periodo);
            setStep('preview');
        } catch (err: any) {
            console.error('[OFERTA_UPLOAD] Parse error:', err);
            setParsedData({ periodo: '', ofertas: [], errors: [`Error al parsear: ${err.message}`] });
            setStep('preview');
        } finally {
            setParsing(false);
        }
    }, []);

    const handleTextParse = useCallback(async () => {
        if (!pastedText.trim()) return;
        setParsing(true);
        try {
            const result = await parseOfertaText(pastedText);
            setParsedData(result);
            setPeriodoOverride(result.periodo);
            setStep('preview');
        } catch (err: any) {
            setParsedData({ periodo: '', ofertas: [], errors: [`Error: ${err.message}`] });
            setStep('preview');
        } finally {
            setParsing(false);
        }
    }, [pastedText]);

    const handleLoadPeriodos = async () => {
        if (showManagePeriodos) { setShowManagePeriodos(false); return; }
        setLoadingPeriodos(true);
        try {
            const { data, error } = await supabase
                .from('academic_offering_versions')
                .select('*')
                .order('academic_period', { ascending: false })
                .order('version_number', { ascending: false });
            if (error) throw error;
            setVersions((data || []) as AcademicOfferingVersion[]);
            setShowManagePeriodos(true);
        } catch (err: any) {
            alert('No se pudieron cargar las versiones: ' + err.message);
        } finally {
            setLoadingPeriodos(false);
        }
    };

    const refreshVersions = async () => {
        const { data, error } = await supabase
            .from('academic_offering_versions')
            .select('*')
            .order('academic_period', { ascending: false })
            .order('version_number', { ascending: false });
        if (error) throw error;
        setVersions((data || []) as AcademicOfferingVersion[]);
    };

    const handlePublishVersion = async (version: AcademicOfferingVersion) => {
        if (!confirm(`¿Publicar ${version.academic_period} · versión ${version.version_number}? La versión vigente anterior quedará archivada.`)) return;
        setUploading(true);
        try {
            const { error } = await supabase.rpc('publish_academic_offering_version', { p_version_id: version.id });
            if (error) throw error;
            await refreshVersions();
            onSuccess();
        } catch (err: any) {
            alert('No se pudo publicar: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteVersion = async (version: AcademicOfferingVersion) => {
        if (!confirm(`¿Eliminar ${version.academic_period} · versión ${version.version_number}? Solo se permite si no está publicada ni tiene horarios guardados.`)) return;
        setUploading(true);
        try {
            const { error } = await supabase.rpc('delete_academic_offering_version', { p_version_id: version.id });
            if (error) throw error;
            await refreshVersions();
            onSuccess();
        } catch (err: any) {
            alert('No se pudo eliminar: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleConfirmUpload = async () => {
        if (!parsedData || !profile) return;
        setUploading(true);

        try {
            const periodo = normalizeAcademicPeriod(periodoOverride || parsedData.periodo);
            if (!/^20\d{2}-(I|II)$/.test(periodo)) {
                throw new Error('El ciclo debe tener el formato AAAA-I o AAAA-II (por ejemplo, 2026-II).');
            }

            const coursesMap = new Map<string, any>();
            parsedData.ofertas.forEach(o => {
                if (!coursesMap.has(o.codigo_curso)) {
                    coursesMap.set(o.codigo_curso, {
                        course_code: o.codigo_curso,
                        course_name: o.nombre_curso,
                        credits: Number(o.creditos ?? 0),
                    });
                }
            });

            const sectionsMap = new Map<string, any>();
            parsedData.ofertas.forEach(o => {
                const sectionKey = `${o.codigo_curso}::${o.seccion}`;
                if (!sectionsMap.has(sectionKey)) {
                    sectionsMap.set(sectionKey, {
                        course_code: o.codigo_curso,
                        letter: o.seccion,
                        teacher: o.profesor || 'Sin profesor',
                    });
                }
            });

            const blockRowsMap = new Map<string, any>();
            parsedData.ofertas.forEach(o => {
                const key = `${o.codigo_curso}-${o.seccion}-${o.tipo}-${o.dia}-${o.hora_inicio}-${o.hora_fin}`;
                if (!blockRowsMap.has(key)) {
                    blockRowsMap.set(key, {
                        course_code: o.codigo_curso,
                        letter: o.seccion,
                        type: o.tipo,
                        day: o.dia,
                        start_time: o.hora_inicio,
                        end_time: o.hora_fin,
                        classroom: o.aula || null
                    });
                }
            });

            // A single database function performs the import atomically. If any
            // row is invalid, PostgreSQL rolls the whole version back.
            const { data: versionRows, error: importError } = await supabase.rpc(
                'import_academic_offering_version',
                {
                    p_academic_period: periodo,
                    p_source_label: parsedData.periodo || periodoOverride || periodo,
                    p_source_filename: file?.name || (isPasteMode ? 'Texto pegado' : null),
                    p_courses: Array.from(coursesMap.values()),
                    p_sections: Array.from(sectionsMap.values()),
                    p_blocks: Array.from(blockRowsMap.values()),
                }
            );
            if (importError) throw importError;

            const version = Array.isArray(versionRows) ? versionRows[0] : versionRows;
            if (!version?.id) throw new Error('No se pudo crear la nueva versión de la oferta.');

            setCreatedVersionNumber(Number(version.version_number));
            await refreshVersions();
            setStep('done');
            setTimeout(() => {
                onSuccess();
                handleReset();
            }, 1500);
        } catch (err: any) {
            console.error('[OFERTA_UPLOAD] Persistence error:', err);
            alert('Error al subir: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setPastedText('');
        setParsedData(null);
        setPeriodoOverride('');
        setCreatedVersionNumber(null);
        setStep('upload');
        setIsPasteMode(false);
        onClose();
    };

    if (!open) return null;

    // Count unique courses
    const uniqueCourses = parsedData ? new Set(parsedData.ofertas.map(o => o.codigo_curso)).size : 0;
    const uniqueSections = parsedData ? new Set(parsedData.ofertas.map(o => `${o.codigo_curso}-${o.seccion}`)).size : 0;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-bb-card border border-bb-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-bb-border">
                    <h2 className="text-lg font-bold text-bb-text flex items-center gap-2">
                        <Upload className="w-5 h-5" style={{ color: colors?.primary }} />
                        Subir Oferta Académica
                    </h2>
                    <button onClick={handleReset} className="p-2 text-bb-text-secondary hover:text-bb-text rounded-lg hover:bg-bb-hover">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'upload' && (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="flex bg-bb-hover p-1 rounded-xl w-full max-w-sm mb-4">
                                <button
                                    onClick={() => setIsPasteMode(false)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isPasteMode ? 'bg-bb-card text-bb-text shadow-sm' : 'text-bb-text-secondary hover:text-bb-text'}`}
                                >
                                    Subir Archivo
                                </button>
                                <button
                                    onClick={() => setIsPasteMode(true)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isPasteMode ? 'bg-bb-card text-bb-text shadow-sm' : 'text-bb-text-secondary hover:text-bb-text'}`}
                                >
                                    Pegar Texto
                                </button>
                            </div>

                            {isPasteMode ? (
                                <div className="w-full flex flex-col gap-3">
                                    <div className="bg-bb-hover/60 border border-bb-border/60 rounded-xl px-4 py-2.5 text-xs text-bb-text-secondary space-y-1">
                                        <p className="font-semibold text-bb-text mb-1">📋 Cómo pegar correctamente:</p>
                                        <p>1. Abre el PDF de la oferta académica en tu navegador</p>
                                        <p>2. Selecciona TODO el texto (Ctrl+A) y cópialo (Ctrl+C)</p>
                                        <p>3. Pégalo aquí. El sistema detectará automáticamente cursos, secciones, CLASES, FINALES y PARCIALES.</p>
                                    </div>
                                    <textarea
                                        value={pastedText}
                                        onChange={e => setPastedText(e.target.value)}
                                        placeholder="Pega aquí el texto completo copiado del PDF o Word de la oferta académica..."
                                        className="w-full h-52 bg-bb-dark border border-bb-border rounded-xl px-4 py-3 text-bb-text text-sm focus:outline-none focus:ring-2 resize-none font-mono"
                                        style={{ focusRingColor: colors?.primary } as any}
                                    />
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-bb-text-secondary flex-1">{pastedText.trim() ? `${pastedText.trim().split('\n').length} líneas` : 'Sin texto'}</span>
                                        <button
                                            onClick={handleTextParse}
                                            disabled={parsing || !pastedText.trim()}
                                            className="flex-1 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 flex items-center justify-center gap-2"
                                            style={{ backgroundColor: colors?.primary }}
                                        >
                                            {parsing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analizar Texto'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-6 py-6 w-full">
                                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-bb-hover">
                                        <FileText className="w-10 h-10 text-bb-text-secondary" />
                                    </div>

                                    {parsing ? (
                                        <div className="flex items-center gap-3 text-bb-text">
                                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors?.primary }} />
                                            <span>Analizando archivo...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-bb-text-secondary text-center text-sm max-w-md">
                                                Sube el PDF, Word (.docx) o Excel (.xlsx) de la oferta académica. El sistema leerá automáticamente los cursos, secciones, horarios y profesores.
                                            </p>
                                            <label
                                                className="cursor-pointer px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                                                style={{ backgroundColor: colors?.primary }}
                                            >
                                                Seleccionar Archivo
                                                <input
                                                    type="file"
                                                    accept=".pdf,.docx,.doc,.xlsx,.xls"
                                                    className="hidden"
                                                    onChange={handleFileSelect}
                                                />
                                            </label>

                                            {/* Manage Periods Panel */}
                                            <div className="w-full max-w-md">
                                                <button
                                                    onClick={handleLoadPeriodos}
                                                    disabled={uploading || loadingPeriodos}
                                                    className="flex items-center gap-2 w-full justify-center px-4 py-2 rounded-lg text-xs font-semibold text-bb-text-secondary border border-bb-border hover:bg-bb-hover transition-colors disabled:opacity-50"
                                                >
                                                    {loadingPeriodos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                                    {showManagePeriodos ? 'Ocultar versiones' : 'Administrar versiones de la oferta'}
                                                </button>

                                                {showManagePeriodos && (
                                                    <div className="mt-2 rounded-xl border border-bb-border bg-bb-hover/30 p-3 space-y-2 max-h-64 overflow-y-auto">
                                                        <p className="text-xs text-bb-text font-semibold">Versiones guardadas:</p>
                                                        {versions.length === 0 ? (
                                                            <p className="text-xs text-bb-text-secondary">No hay versiones guardadas.</p>
                                                        ) : (
                                                            versions.map(version => (
                                                                <div key={version.id} className="flex items-center justify-between gap-3 bg-bb-card rounded-lg px-3 py-2">
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm text-bb-text font-medium">
                                                                            {version.academic_period} · v{version.version_number}
                                                                        </p>
                                                                        <p className="text-[10px] text-bb-text-secondary truncate">
                                                                            {version.status === 'published' ? 'Vigente' : version.status === 'draft' ? 'Borrador' : 'Histórica'}
                                                                            {version.source_filename ? ` · ${version.source_filename}` : ''}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        {version.status !== 'published' && (
                                                                            <button
                                                                                onClick={() => handlePublishVersion(version)}
                                                                                disabled={uploading}
                                                                                className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
                                                                                title="Publicar como oferta vigente"
                                                                            >
                                                                                <Rocket className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        {version.status !== 'published' && (
                                                                            <button
                                                                                onClick={() => handleDeleteVersion(version)}
                                                                                disabled={uploading}
                                                                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                                                                                title="Eliminar versión"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'preview' && parsedData && (
                        <div className="space-y-4">
                            {/* Errors */}
                            {parsedData.errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    {parsedData.errors.map((e, i) => (
                                        <p key={i} className="text-red-400 text-sm flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {e}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-bb-hover rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-bb-text">{uniqueCourses}</p>
                                    <p className="text-xs text-bb-text-secondary">Cursos</p>
                                </div>
                                <div className="bg-bb-hover rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-bb-text">{uniqueSections}</p>
                                    <p className="text-xs text-bb-text-secondary">Secciones</p>
                                </div>
                                <div className="bg-bb-hover rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-bb-text">{parsedData.ofertas.length}</p>
                                    <p className="text-xs text-bb-text-secondary">Registros</p>
                                </div>
                            </div>

                            {/* Periodo */}
                            <div>
                                <label className="text-sm font-medium text-bb-text-secondary mb-1 block">Período Académico</label>
                                <input
                                    type="text"
                                    value={periodoOverride}
                                    onChange={e => setPeriodoOverride(e.target.value)}
                                    className="w-full bg-bb-dark border border-bb-border rounded-xl px-4 py-2.5 text-bb-text text-sm focus:outline-none focus:ring-2"
                                    style={{ focusRingColor: colors?.primary } as any}
                                    placeholder="ej: 2026-II"
                                />
                                <p className="mt-2 text-xs text-bb-text-secondary">
                                    Se creará una versión nueva en borrador. La oferta vigente no se reemplaza hasta que publiques esta versión.
                                </p>
                            </div>

                            {/* Preview table */}
                            <div className="rounded-xl border border-bb-border overflow-hidden">
                                <div className="max-h-60 overflow-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-bb-hover sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">Código</th>
                                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">Curso</th>
                                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">Secc</th>
                                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">Profesor</th>
                                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">Tipo</th>
                                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">Día</th>
                                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">Horario</th>
                                                <th className="px-3 py-2 text-left text-bb-text-secondary font-medium">Aula</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedData.ofertas.slice(0, 50).map((o, i) => (
                                                <tr key={i} className={`border-t border-bb-border/50 hover:bg-bb-hover/50 ${o.tipo === 'FINAL' ? 'bg-red-500/5' : o.tipo === 'PARCIAL' ? 'bg-yellow-500/5' : ''}`}>
                                                    <td className="px-3 py-1.5 text-bb-text font-mono text-[10px]">{o.codigo_curso}</td>
                                                    <td className="px-3 py-1.5 text-bb-text truncate max-w-[140px]">{o.nombre_curso}</td>
                                                    <td className="px-3 py-1.5 text-bb-text font-bold">{o.seccion}</td>
                                                    <td className="px-3 py-1.5 text-bb-text-secondary truncate max-w-[120px]">{o.profesor || '—'}</td>
                                                    <td className="px-3 py-1.5">
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${o.tipo === 'FINAL' ? 'bg-red-500 text-white' :
                                                            o.tipo === 'PARCIAL' ? 'bg-yellow-500 text-white' :
                                                                o.tipo === 'PRACTICA' ? 'bg-purple-500/70 text-white' :
                                                                    'bg-blue-500/40 text-blue-200'
                                                            }`}>{o.tipo}</span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-bb-text">{o.dia}</td>
                                                    <td className="px-3 py-1.5 text-bb-text">{o.hora_inicio}–{o.hora_fin}</td>
                                                    <td className="px-3 py-1.5 text-bb-text-secondary">{o.aula || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {parsedData.ofertas.length > 50 && (
                                    <div className="text-center py-2 text-xs text-bb-text-secondary bg-bb-hover">
                                        Mostrando 50 de {parsedData.ofertas.length} registros
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="flex flex-col items-center gap-4 py-10">
                            <CheckCircle2 className="w-16 h-16 text-green-500" />
                            <p className="text-lg font-semibold text-bb-text">Oferta cargada como borrador</p>
                            <p className="text-sm text-bb-text-secondary text-center">
                                Se creó la versión {createdVersionNumber}. Publícala desde “Administrar versiones” cuando hayas verificado los datos.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && parsedData && parsedData.ofertas.length > 0 && (
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-bb-border">
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReset}
                                    className="px-6 py-2.5 rounded-xl font-semibold text-bb-text-secondary hover:bg-bb-hover transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmUpload}
                                    disabled={uploading}
                                    className="px-10 py-2.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 flex items-center gap-2"
                                    style={{ backgroundColor: colors?.primary }}
                                >
                                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar y Subir'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
