'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import { useProfile } from '@/lib/profile-context';
import {
    ChevronLeft,
    Map,
    Download,
    Share2,
    Info,
    CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import FlowchartCanvas from '@/components/herramientas/FlowchartCanvas';

interface Flowchart {
    id: string;
    name: string;
    faculty: string;
    image_url: string;
}

export default function FlowchartDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: flowchartId } = use(params);
    const { colors } = useTheme();
    const { profile } = useProfile();

    const [flowchart, setFlowchart] = useState<Flowchart | null>(null);
    const [initialDrawing, setInitialDrawing] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    useEffect(() => {
        if (flowchartId) {
            fetchData();
        }
    }, [flowchartId, profile?.id]);

    async function fetchData() {
        setLoading(true);
        try {
            // 1. Fetch Flowchart Metadata
            const { data: flow, error: flowErr } = await supabase
                .from('flowcharts')
                .select('*')
                .eq('id', flowchartId)
                .single();

            if (flowErr) throw flowErr;
            setFlowchart(flow);

            // 2. Fetch User's Drawing (if exists)
            if (profile?.id) {
                const { data: draw, error: drawErr } = await supabase
                    .from('user_flowchart_drawings')
                    .select('drawing_data, updated_at')
                    .eq('user_id', profile.id)
                    .eq('flowchart_id', flowchartId)
                    .maybeSingle();

                if (draw) {
                    setInitialDrawing(draw.drawing_data);
                    setLastSaved(new Date(draw.updated_at));
                }
            }
        } catch (error: any) {
            console.error('Error fetching flowchart data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(drawingData: any[]) {
        if (!profile?.id || !flowchartId) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('user_flowchart_drawings')
                .upsert({
                    user_id: profile.id,
                    flowchart_id: flowchartId,
                    drawing_data: drawingData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,flowchart_id'
                });

            if (error) throw error;
            setLastSaved(new Date());
        } catch (error: any) {
            alert('Error al guardar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="h-[calc(100vh-80px)] bg-bb-darker flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full shadow-lg shadow-emerald-500/20"></div>
                    <p className="text-bb-text-secondary font-bold animate-pulse uppercase tracking-widest text-xs">Cargando Mapa...</p>
                </div>
            </div>
        );
    }

    if (!flowchart) {
        return (
            <div className="h-[calc(100vh-80px)] bg-bb-darker flex flex-col items-center justify-center p-8 text-center">
                <Info className="w-16 h-16 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-black text-white italic uppercase tracking-tight">Flujograma no encontrado</h1>
                <p className="text-bb-text-secondary mt-2 max-w-sm">Lo sentimos, no pudimos cargar el mapa curricular solicitado.</p>
                <Link href="/dashboard/herramientas/flujogramas" className="mt-8">
                    <Button className="h-12 px-8 rounded-xl bg-bb-card border border-bb-border font-bold">Volver al listado</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col bg-bb-darker">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-bb-card border-b border-bb-border shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/herramientas/flujogramas">
                        <Button variant="ghost" size="icon" className="group h-10 w-10 rounded-xl bg-bb-sidebar/40 border border-bb-border hover:bg-bb-sidebar">
                            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        </Button>
                    </Link>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-black text-white italic uppercase tracking-tight leading-none truncate max-w-[200px] sm:max-w-md">
                            {flowchart.name}
                        </h1>
                        {lastSaved && (
                            <div className="flex items-center gap-1.5 text-[9px] text-bb-text-secondary mt-1">
                                <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />
                                Guardado: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                        {flowchart.faculty}
                    </span>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border border-bb-border text-bb-text-secondary hover:text-white">
                        <Share2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Main Interactive Area */}
            <div className="flex-1 overflow-hidden">
                <div className="h-full relative">
                    <FlowchartCanvas
                        imageUrl={flowchart.image_url}
                        initialData={initialDrawing}
                        onSave={handleSave}
                        isSaving={isSaving}
                    />
                </div>
            </div>
        </div>
    );
}
