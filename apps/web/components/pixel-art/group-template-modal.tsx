'use client';

import React, { useState } from 'react';
import { X, Users, Upload, Key, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface GroupTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentGuidanceImage: string | null;
    currentSettings: any;
    onJoinGroup: (templateData: any) => void;
}

export function GroupTemplateModal({
    isOpen,
    onClose,
    currentGuidanceImage,
    currentSettings,
    onJoinGroup
}: GroupTemplateModalProps) {
    const [mode, setMode] = useState<'select' | 'create' | 'join' | 'success'>('select');
    const [isLoading, setIsLoading] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [createdCode, setCreatedCode] = useState('');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const generateCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const handleCreateGroup = async () => {
        if (!currentGuidanceImage) {
            setErrorMsg('No tienes ninguna plantilla guía activa. Sube una primero en el lienzo.');
            return;
        }

        try {
            setIsLoading(true);
            setErrorMsg('');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Debes iniciar sesión para crear un grupo.');

            // Convert base64 to blob
            const res = await fetch(currentGuidanceImage);
            const blob = await res.blob();

            const code = generateCode();
            const filePath = `groups/${session.user.id}_${code}_${Date.now()}.jpg`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('r2-images')
                .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage.from('r2-images').getPublicUrl(filePath);

            // Save to database
            const { error: dbError } = await supabase
                .from('pixel_group_templates')
                .insert({
                    invite_code: code,
                    owner_id: session.user.id,
                    event_id: 'a0000000-0000-0000-0000-000000002025',
                    image_url: publicUrl,
                    settings: currentSettings
                });

            if (dbError) throw dbError;

            setCreatedCode(code);
            setMode('success');
        } catch (err: any) {
            console.error('[GROUP] Error creating group:', err);
            setErrorMsg(err.message || 'Ocurrió un error al crear el grupo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinGroup = async () => {
        if (!inviteCode || inviteCode.length < 4) {
            setErrorMsg('Ingresa un código válido.');
            return;
        }

        try {
            setIsLoading(true);
            setErrorMsg('');

            const { data, error } = await supabase
                .from('pixel_group_templates')
                .select('*')
                .eq('invite_code', inviteCode.toUpperCase())
                .single();

            if (error || !data) {
                throw new Error('Código no encontrado o el grupo no existe.');
            }

            onJoinGroup({
                image: data.image_url,
                settings: data.settings
            });
            onClose();
        } catch (err: any) {
            console.error('[GROUP] Error joining:', err);
            setErrorMsg(err.message || 'Error al unirse al grupo.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(createdCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white relative">
                    <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-md transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md">
                            <Users className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-wider">Comunidad</h2>
                    </div>
                    <p className="text-white/80 text-sm font-medium">Crea lienzos colaborativos con tus amigos.</p>
                </div>

                <div className="p-6">
                    {mode === 'select' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setMode('create')}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
                            >
                                <div className="bg-indigo-100 text-indigo-600 p-3 rounded-xl group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Crear Grupo</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Comparte tu plantilla actual con otros.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setMode('join')}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-purple-100 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
                            >
                                <div className="bg-purple-100 text-purple-600 p-3 rounded-xl group-hover:scale-110 transition-transform">
                                    <Key className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Unirse con Código</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Ingresa el código que te compartieron.</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {mode === 'create' && (
                        <div className="space-y-5">
                            <button onClick={() => setMode('select')} className="text-sm text-indigo-600 font-bold hover:underline mb-2 flex items-center gap-1">← Volver</button>
                            
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-sm text-slate-600 font-medium">
                                    Esta acción subirá la plantilla guía que tienes actualmente activa en tu lienzo y generará un código para que tus amigos puedan sincronizarse contigo.
                                </p>
                            </div>

                            {errorMsg && <p className="text-rose-500 text-sm font-bold bg-rose-50 p-3 rounded-xl">{errorMsg}</p>}

                            <button
                                onClick={handleCreateGroup}
                                disabled={isLoading || !currentGuidanceImage}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                                {isLoading ? "Creando..." : "Generar Código de Grupo"}
                            </button>
                            
                            {!currentGuidanceImage && (
                                <p className="text-xs text-center text-rose-500 font-medium mt-2">No tienes una plantilla cargada.</p>
                            )}
                        </div>
                    )}

                    {mode === 'join' && (
                        <div className="space-y-5">
                            <button onClick={() => setMode('select')} className="text-sm text-indigo-600 font-bold hover:underline mb-2 flex items-center gap-1">← Volver</button>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Código de Invitación</label>
                                <input
                                    type="text"
                                    placeholder="Ej: X8K2M1"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    className="w-full text-center text-3xl font-black tracking-[0.2em] uppercase py-4 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all outline-none"
                                />
                            </div>

                            {errorMsg && <p className="text-rose-500 text-sm font-bold text-center bg-rose-50 p-3 rounded-xl">{errorMsg}</p>}

                            <button
                                onClick={handleJoinGroup}
                                disabled={isLoading || inviteCode.length < 4}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-purple-200 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                                {isLoading ? "Buscando..." : "Unirse al Grupo"}
                            </button>
                        </div>
                    )}

                    {mode === 'success' && (
                        <div className="text-center space-y-6 py-4">
                            <div className="mx-auto w-16 h-16 bg-green-100 text-green-500 flex items-center justify-center rounded-full">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            
                            <div>
                                <h3 className="text-xl font-black text-slate-800">¡Grupo Creado!</h3>
                                <p className="text-slate-500 font-medium text-sm mt-1">Comparte este código con tus amigos.</p>
                            </div>

                            <div 
                                onClick={copyToClipboard}
                                className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group relative"
                            >
                                <div className="text-4xl font-black text-indigo-600 tracking-[0.2em]">{createdCode}</div>
                                <div className="absolute top-2 right-2 text-slate-400 group-hover:text-indigo-500">
                                    <Copy className="w-5 h-5" />
                                </div>
                            </div>
                            {copied && <p className="text-green-500 font-bold text-sm">¡Código copiado al portapapeles!</p>}

                            <button
                                onClick={onClose}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
                            >
                                Listo, empezar a pintar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
