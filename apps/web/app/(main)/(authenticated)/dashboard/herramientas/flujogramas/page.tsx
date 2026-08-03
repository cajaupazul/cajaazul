'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme-context';
import {
    ChevronLeft, FileText, Search, ArrowRight, Map
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Flowchart {
    id: string;
    name: string;
    faculty: string;
    image_url: string;
}

// Lazy image card — only fetches the image when it enters the viewport
function LazyFlowchartCard({ flow }: { flow: Flowchart }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
            { rootMargin: '200px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className="bg-bb-card border border-bb-border rounded-3xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 shadow-xl relative">
            <div className="aspect-[16/10] relative overflow-hidden bg-bb-sidebar/30">
                {visible ? (
                    <img
                        src={flow.image_url}
                        alt={flow.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                ) : (
                    <div className="w-full h-full animate-pulse bg-bb-sidebar/60 flex items-center justify-center">
                        <Map className="w-10 h-10 text-bb-text-secondary/20" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-wider text-white">
                        {flow.faculty}
                    </span>
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-xl font-black text-white italic tracking-tight mb-2 group-hover:text-emerald-400 transition-colors uppercase leading-tight line-clamp-2">
                        {flow.name}
                    </h3>
                    <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                        Comenzar a pintar <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function FlowchartsListPage() {
    const { colors } = useTheme();
    const [flowcharts, setFlowcharts] = useState<Flowchart[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);

    useEffect(() => { fetchFlowcharts(); }, []);

    async function fetchFlowcharts() {
        setLoading(true);
        const { data, error } = await supabase
            .from('flowcharts')
            .select('id, name, faculty, image_url')  // only fetch needed columns
            .order('name', { ascending: true });
        if (!error && data) setFlowcharts(data);
        setLoading(false);
    }

    const faculties = Array.from(new Set(flowcharts.map(f => f.faculty)));
    const filtered = flowcharts.filter(f => {
        const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase()) ||
            f.faculty.toLowerCase().includes(search.toLowerCase());
        const matchesFaculty = !selectedFaculty || f.faculty === selectedFaculty;
        return matchesSearch && matchesFaculty;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-bb-darker flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bb-darker p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/herramientas">
                            <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                                <ChevronLeft className="w-6 h-6" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                                <Map className="text-emerald-500" /> Flujogramas
                            </h1>
                            <p className="text-bb-text-secondary">Elige tu carrera para comenzar a mapear tu camino</p>
                        </div>
                    </div>

                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bb-text-secondary" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar carrera o facultad..."
                            className="bg-bb-card border-bb-border pl-10 h-11 rounded-xl shadow-lg focus:ring-emerald-500/20"
                        />
                    </div>
                </div>

                {/* Banner Interactivo BETA */}
                <Link href="/dashboard/herramientas/flujograma/admin" className="block">
                    <div className="w-full bg-gradient-to-r from-emerald-900/40 to-blue-900/40 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-emerald-500/60 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <Map className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    Nuevo Flujograma Interactivo (Beta)
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] uppercase font-black">Nuevo</span>
                                </h3>
                                <p className="text-bb-text-secondary text-sm">Prueba el nuevo sistema con código inteligente para Administración.</p>
                            </div>
                        </div>
                        <Button className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 font-bold px-6">
                            Probar Beta <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </div>
                </Link>

                {/* Faculty Filters */}
                {faculties.length > 0 && (
                    <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                        <Button
                            variant={selectedFaculty === null ? 'default' : 'ghost'}
                            onClick={() => setSelectedFaculty(null)}
                            className={`rounded-full px-5 h-9 text-xs font-bold transition-all ${selectedFaculty === null ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-bb-card/50 text-bb-text-secondary hover:text-white'}`}
                        >
                            Todos
                        </Button>
                        {faculties.map(faculty => (
                            <Button
                                key={faculty}
                                variant={selectedFaculty === faculty ? 'default' : 'ghost'}
                                onClick={() => setSelectedFaculty(faculty)}
                                className={`rounded-full px-5 h-9 text-xs font-bold whitespace-nowrap transition-all ${selectedFaculty === faculty ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-bb-card/50 text-bb-text-secondary hover:text-white'}`}
                            >
                                {faculty}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((flow, index) => (
                        <motion.div
                            key={flow.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.04, 0.25) }}
                        >
                            <Link href={`/dashboard/herramientas/flujogramas/${flow.id}`} className="block group">
                                <LazyFlowchartCard flow={flow} />
                            </Link>
                        </motion.div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="col-span-full py-20 bg-bb-card/30 border-2 border-dashed border-bb-border rounded-3xl flex flex-col items-center justify-center text-center px-4">
                            <div className="w-20 h-20 rounded-full bg-bb-sidebar/50 flex items-center justify-center mb-4">
                                <FileText className="w-10 h-10 text-bb-text-secondary" />
                            </div>
                            <h3 className="text-xl font-bold text-bb-text">No se encontraron resultados</h3>
                            <p className="text-bb-text-secondary mt-2 max-w-xs">Intenta con otro término de búsqueda o selecciona otra facultad.</p>
                            <Button variant="ghost" className="mt-6 text-emerald-500" onClick={() => { setSearch(''); setSelectedFaculty(null); }}>Ver todos</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
