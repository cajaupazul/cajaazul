'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Trash2,
    Image as ImageIcon,
    Wrench,
    ChevronLeft,
    FileText,
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { extractSupabaseStoragePath } from '@/lib/supabase-storage-cleanup';

interface Flowchart {
    id: string;
    name: string;
    faculty: string;
    image_url: string;
    created_at: string;
}

export default function AdminFlowchartsPage() {
    const { colors } = useTheme();
    const { profile } = useProfile();
    const router = useRouter();
    const [flowcharts, setFlowcharts] = useState<Flowchart[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile && profile.role !== 'admin' && profile.role !== 'superadmin') {
            router.push('/dashboard');
        } else {
            fetchFlowcharts();
        }
    }, [profile, router]);

    async function fetchFlowcharts() {
        setLoading(true);
        const { data, error } = await supabase
            .from('flowcharts')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setFlowcharts(data);
        }
        setLoading(false);
    }

    async function handleDelete(id: string, imageUrl: string) {
        if (!confirm('¿Estás seguro de eliminar este flujograma?')) return;

        try {
            // 1. Delete from storage if it's in our bucket
            const storagePath = extractSupabaseStoragePath(imageUrl, 'flowcharts');
            if (storagePath) {
                const { error: storageError } = await supabase.storage.from('flowcharts').remove([storagePath]);
                if (storageError) throw storageError;
            }

            // 2. Delete from DB
            const { error } = await supabase.from('flowcharts').delete().eq('id', id);
            if (error) throw error;

            setFlowcharts(flowcharts.filter(f => f.id !== id));
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-bb-darker flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent animate-spin rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bb-darker p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/herramientas">
                            <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                                <ChevronLeft className="w-6 h-6" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                                <FileText className="text-blue-400" /> Gestión de Flujogramas
                            </h1>
                            <p className="text-bb-text-secondary">Administra los mapas curriculares interactivos</p>
                        </div>
                    </div>
                    <Link href="/admin/flowcharts/new">
                        <Button className="h-12 px-6 rounded-xl font-bold flex items-center gap-2 shadow-lg" style={{ backgroundColor: colors?.primary }}>
                            <Plus className="w-5 h-5" /> Subir Nuevo
                        </Button>
                    </Link>
                </div>

                {/* List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {flowcharts.map(flow => (
                        <div key={flow.id} className="bg-bb-card border border-bb-border rounded-3xl overflow-hidden group hover:border-blue-500/50 transition-all duration-300 shadow-xl">
                            <div className="aspect-video relative overflow-hidden bg-black/20">
                                <img src={flow.image_url} alt={flow.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button
                                        onClick={() => handleDelete(flow.id, flow.image_url)}
                                        className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl backdrop-blur-md border border-red-500/20 transition-all shadow-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                                        {flow.faculty}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-4 line-clamp-1">{flow.name}</h3>
                                <div className="flex gap-2">
                                    <Link href={`/dashboard/herramientas/flujogramas/${flow.id}`} className="flex-1">
                                        <Button variant="outline" className="w-full h-10 rounded-xl border-bb-border hover:bg-bb-sidebar font-bold text-xs">
                                            <ExternalLink className="w-3.5 h-3.5 mr-2" /> Previsualizar
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}

                    {flowcharts.length === 0 && (
                        <div className="col-span-full py-20 bg-bb-card/30 border-2 border-dashed border-bb-border rounded-3xl flex flex-col items-center justify-center text-center px-4">
                            <div className="w-20 h-20 rounded-full bg-bb-sidebar/50 flex items-center justify-center mb-4">
                                <ImageIcon className="w-10 h-10 text-bb-text-secondary" />
                            </div>
                            <h3 className="text-xl font-bold text-bb-text">No hay flujogramas aún</h3>
                            <p className="text-bb-text-secondary mt-2 max-w-xs">Comienza subiendo el primer flujograma oficial para que los estudiantes puedan usarlo.</p>
                            <Link href="/admin/flowcharts/new" className="mt-6">
                                <Button className="px-8" style={{ backgroundColor: colors?.primary }}>Subir el primero</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
