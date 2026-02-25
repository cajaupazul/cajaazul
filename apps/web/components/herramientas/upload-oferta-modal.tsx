'use client';

import React, { useState, useCallback } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { parseOfertaFile, ParsedOferta } from '@/lib/pdf-schedule-parser';
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
    const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'docx', 'doc'].includes(ext || '')) return;
        setFile(f);
        setParsing(true);

        try {
            const result = await parseOfertaFile(f);
            setParsedData(result);
            setPeriodoOverride(result.periodo);
            setStep('preview');
        } catch (err: any) {
            setParsedData({ periodo: '', ofertas: [], errors: [`Error al parsear: ${err.message}`] });
        } finally {
            setParsing(false);
        }
    }, []);

    const handleConfirmUpload = async () => {
        if (!parsedData || !profile) return;
        setUploading(true);

        try {
            const periodo = periodoOverride || parsedData.periodo;

            // Delete existing data for this periodo to avoid duplicates
            await supabase
                .from('oferta_academica')
                .delete()
                .eq('periodo', periodo);

            // Insert in batches of 500
            const batchSize = 500;
            const rows = parsedData.ofertas.map(o => ({
                periodo,
                codigo_curso: o.codigo_curso,
                nombre_curso: o.nombre_curso,
                seccion: o.seccion,
                profesor: o.profesor || null,
                creditos: o.creditos,
                tipo: o.tipo,
                dia: o.dia,
                hora_inicio: o.hora_inicio,
                hora_fin: o.hora_fin,
                duracion: o.duracion,
                cupos: o.cupos,
                aula: o.aula || null,
                uploaded_by: profile.id,
            }));

            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                const { error } = await supabase.from('oferta_academica').insert(batch);
                if (error) throw error;
            }

            setStep('done');
            setTimeout(() => {
                onSuccess();
                handleReset();
            }, 1500);
        } catch (err: any) {
            alert('Error al subir: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setParsedData(null);
        setPeriodoOverride('');
        setStep('upload');
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
                        <div className="flex flex-col items-center gap-6 py-10">
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
                                        Sube el PDF o Word (.docx) de la oferta académica. El sistema leerá automáticamente los cursos, secciones, horarios y profesores.
                                    </p>
                                    <label
                                        className="cursor-pointer px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                                        style={{ backgroundColor: colors?.primary }}
                                    >
                                        Seleccionar PDF o Word
                                        <input
                                            type="file"
                                            accept=".pdf,.docx,.doc"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                </>
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
                                                <tr key={i} className="border-t border-bb-border/50 hover:bg-bb-hover/50">
                                                    <td className="px-3 py-1.5 text-bb-text">{o.codigo_curso}</td>
                                                    <td className="px-3 py-1.5 text-bb-text truncate max-w-[150px]">{o.nombre_curso}</td>
                                                    <td className="px-3 py-1.5 text-bb-text">{o.seccion}</td>
                                                    <td className="px-3 py-1.5 text-bb-text-secondary truncate max-w-[120px]">{o.profesor || '—'}</td>
                                                    <td className="px-3 py-1.5 text-bb-text-secondary">{o.tipo}</td>
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
                    <div className="border-t border-bb-border px-6 py-4 flex items-center justify-end gap-3">
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 rounded-xl text-sm text-bb-text-secondary hover:text-bb-text border border-bb-border hover:bg-bb-hover transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmUpload}
                            disabled={uploading}
                            className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            style={{ backgroundColor: colors?.primary }}
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {uploading ? 'Subiendo...' : `Confirmar (${parsedData.ofertas.length} registros)`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
