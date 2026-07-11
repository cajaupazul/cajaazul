'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { parseOfertaFile, parseOfertaText, ParsedOferta } from '@/lib/pdf-schedule-parser';
import { debugExcel } from '@/lib/excel-debug';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import { useTheme } from '@/lib/theme-context';

type Props = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
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
    const [periodos, setPeriodos] = useState<string[]>([]);
    const [loadingPeriodos, setLoadingPeriodos] = useState(false);

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

    const handleClearPeriod = async () => {
        const periodo = periodoOverride || parsedData?.periodo;
        if (!periodo) return;

        if (!confirm(`¿Estás SEGURO de que quieres BORRAR TODA la oferta del periodo ${periodo}? Esta acción es irreversible.`)) {
            return;
        }

        setUploading(true);
        try {
            await supabase.from('oferta_academica').delete().eq('periodo', periodo);
            const { error } = await supabase.from('sche_sections').delete().eq('periodo', periodo);
            if (error) throw error;
            alert(`Toda la oferta del periodo ${periodo} ha sido borrada.`);
            onSuccess();
        } catch (err: any) {
            console.error('[OFERTA_UPLOAD] Clear error:', err);
            alert('Error al borrar: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleLoadPeriodos = async () => {
        if (showManagePeriodos) { setShowManagePeriodos(false); return; }
        setLoadingPeriodos(true);
        try {
            const { data } = await supabase
                .from('sche_sections')
                .select('periodo')
                .order('periodo', { ascending: false });
            const unique = Array.from(new Set((data || []).map((r: any) => r.periodo).filter(Boolean)));
            setPeriodos(unique);
            setShowManagePeriodos(true);
        } finally {
            setLoadingPeriodos(false);
        }
    };

    const handleDeletePeriodo = async (per: string) => {
        if (!confirm(`¿Eliminar toda la oferta del periodo "${per}"? Esta acción no se puede deshacer.`)) return;
        setUploading(true);
        try {
            await supabase.from('oferta_academica').delete().eq('periodo', per);
            const { error } = await supabase.from('sche_sections').delete().eq('periodo', per);
            if (error) throw error;
            setPeriodos(prev => prev.filter(p => p !== per));
            onSuccess();
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleConfirmUpload = async () => {
        if (!parsedData || !profile) return;
        setUploading(true);

        try {
            const periodo = periodoOverride || parsedData.periodo;

            // 1. Extract Unique Courses (Normalized)
            const coursesMap = new Map<string, any>();
            parsedData.ofertas.forEach(o => {
                if (!coursesMap.has(o.codigo_curso)) {
                    coursesMap.set(o.codigo_curso, {
                        id: o.codigo_curso,
                        name: o.nombre_curso,
                        credits: o.creditos
                    });
                }
            });
            const courseRows = Array.from(coursesMap.values());

            // 2. Extract Unique Sections (Normalized)
            const sectionsMap = new Map<string, any>();
            parsedData.ofertas.forEach(o => {
                const section_id = `${periodo}-${o.codigo_curso}-${o.seccion}`;
                if (!sectionsMap.has(section_id)) {
                    sectionsMap.set(section_id, {
                        id: section_id,
                        course_id: o.codigo_curso,
                        letter: o.seccion,
                        teacher: o.profesor || 'Sin profesor',
                        periodo: periodo
                    });
                }
            });
            const sectionRows = Array.from(sectionsMap.values());

            // 3. Extract Schedule Blocks (Deduplicated)
            const blockRowsMap = new Map<string, any>();
            parsedData.ofertas.forEach(o => {
                const section_id = `${periodo}-${o.codigo_curso}-${o.seccion}`;
                const key = `${section_id}-${o.tipo}-${o.dia}-${o.hora_inicio}-${o.hora_fin}`;
                if (!blockRowsMap.has(key)) {
                    blockRowsMap.set(key, {
                        section_id,
                        type: o.tipo,
                        day: o.dia,
                        start_time: o.hora_inicio,
                        end_time: o.hora_fin,
                        classroom: o.aula || null
                    });
                }
            });
            const blockRows = Array.from(blockRowsMap.values());

            // PERSISTENCE (The Shield)
            // A. Upsert Courses
            const { error: cErr } = await supabase.from('sche_courses').upsert(courseRows);
            if (cErr) throw cErr;

            // B. Clean current periodo for sections (cascades to blocks)
            // We do this to ensure we don't have stale sections if the PDF changed
            const { error: dErr } = await supabase.from('sche_sections').delete().eq('periodo', periodo);
            if (dErr) throw dErr;

            // Also clean legacy table to avoid user confusion in Supabase Studio
            await supabase.from('oferta_academica').delete().eq('periodo', periodo);

            // C. Insert Sections
            const { error: sErr } = await supabase.from('sche_sections').insert(sectionRows);
            if (sErr) throw sErr;

            // D. Insert Blocks (Batched)
            const batchSize = 500;
            for (let i = 0; i < blockRows.length; i += batchSize) {
                const batch = blockRows.slice(i, i + batchSize);
                const { error: bErr } = await supabase.from('sche_schedule_blocks').insert(batch);
                if (bErr) throw bErr;
            }

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
                                                    className="flex items-center gap-2 w-full justify-center px-4 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                >
                                                    {loadingPeriodos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                                    {showManagePeriodos ? 'Ocultar administrador de periodos' : 'Administrar / eliminar oferta anterior'}
                                                </button>

                                                {showManagePeriodos && (
                                                    <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                                                        <p className="text-xs text-red-400 font-semibold">Periodos guardados en la base de datos:</p>
                                                        {periodos.length === 0 ? (
                                                            <p className="text-xs text-bb-text-secondary">No hay periodos guardados.</p>
                                                        ) : (
                                                            periodos.map(per => (
                                                                <div key={per} className="flex items-center justify-between bg-bb-card rounded-lg px-3 py-2">
                                                                    <span className="text-sm text-bb-text font-medium">{per}</span>
                                                                    <button
                                                                        onClick={() => handleDeletePeriodo(per)}
                                                                        disabled={uploading}
                                                                        className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                                    >
                                                                        Eliminar
                                                                    </button>
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
                                    placeholder="ej: 2026-I PERIODO-PRE"
                                />
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
                            <p className="text-lg font-semibold text-bb-text">¡Oferta subida exitosamente!</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && parsedData && parsedData.ofertas.length > 0 && (
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-between gap-3 pt-4 border-t border-bb-border">
                            <button
                                onClick={handleClearPeriod}
                                disabled={uploading}
                                className="px-6 py-2.5 rounded-xl font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2"
                            >
                                <AlertTriangle className="w-4 h-4" />
                                Limpiar Base de Datos
                            </button>

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
