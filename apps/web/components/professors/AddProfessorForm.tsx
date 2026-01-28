'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase, Profile, Professor } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, Search, User, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { courseCatalog } from '@/lib/data/courseCatalog';
import { useDashboardData } from '@/lib/dashboard-data-context';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const FACULTADES = [
    'Facultad de Ciencias Empresariales',
    'Facultad de Derecho',
    'Facultad de Economía y Finanzas',
    'Facultad de Ingeniería',
];

interface AddProfessorFormProps {
    profile: Profile | null;
    onSuccess?: () => void;
    onCancel?: () => void;
    isModal?: boolean;
}

export default function AddProfessorForm({ profile, onSuccess, onCancel, isModal = false }: AddProfessorFormProps) {
    const router = useRouter();
    const { addProfessor } = useDashboardData();
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [searching, setSearching] = useState(false);
    const [duplicateError, setDuplicateError] = useState(false);
    const [suggestions, setSuggestions] = useState<Professor[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        nombre: '',
        especialidad: '', // Materia Principal
        facultad: '',
        email: '',
        otros_cursos: '',
    });

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search for matches/suggestions as user types name
    useEffect(() => {
        const searchProfessors = async () => {
            const query = formData.nombre.trim();
            if (query.length >= 1) { // Reduced from 2 to 1
                setSearching(true);

                // Search in multiple fields for better results
                const { data, error } = await supabase
                    .from('professors')
                    .select('*')
                    .or(`nombre.ilike.%${query}%,especialidad.ilike.%${query}%,facultad.ilike.%${query}%`)
                    .limit(20); // Increased from 6 to 20

                if (!error && data) {
                    // Sort results: prioritize matches in name field
                    const sorted = data.sort((a, b) => {
                        const aNameMatch = a.nombre.toLowerCase().includes(query.toLowerCase());
                        const bNameMatch = b.nombre.toLowerCase().includes(query.toLowerCase());

                        if (aNameMatch && !bNameMatch) return -1;
                        if (!aNameMatch && bNameMatch) return 1;

                        // If both match in name, sort alphabetically
                        return a.nombre.localeCompare(b.nombre);
                    });

                    setSuggestions(sorted);
                    setShowSuggestions(true);
                } else {
                    setSuggestions([]);
                }
                setSearching(false);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        const timer = setTimeout(searchProfessors, 150); // Faster search
        return () => clearTimeout(timer);
    }, [formData.nombre]);

    // Removed legacy course suggestion effect

    // Search for existing faculties as user types faculty (Unused in Select mode)

    // Check for exact duplicates (Super Strict)
    useEffect(() => {
        const checkDuplicate = async () => {
            const name = formData.nombre.trim();
            const specialty = formData.especialidad.trim();
            if (name.length > 3 && specialty.length > 2) {
                setChecking(true);

                const { data, error } = await supabase
                    .from('professors')
                    .select('id, especialidad')
                    .ilike('nombre', name)
                    .ilike('especialidad', specialty)
                    .limit(1);

                if (!error && data && data.length > 0) {
                    setDuplicateError(true);
                } else {
                    setDuplicateError(false);
                }
                setChecking(false);
            } else {
                setDuplicateError(false);
            }
        };

        const timer = setTimeout(checkDuplicate, 400);
        return () => clearTimeout(timer);
    }, [formData.nombre, formData.especialidad]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectSuggestion = (prof: Professor) => {
        setFormData({
            nombre: (prof.nombre || '').toUpperCase(),
            especialidad: (prof.especialidad || '').toUpperCase(),
            facultad: (prof.facultad || '').toUpperCase(),
            email: (prof.email || '').toUpperCase(),
            otros_cursos: (prof.otros_cursos || '').toUpperCase(),
        });
        setShowSuggestions(false);
    };

    // Removed unused handler

    // Removed unused handler

    const getRandomBackgroundImage = () => {
        const NATURE_BG_IDS = [
            'photo-1501854140801-50d01698950b',
            'photo-1470074184345-d97a063efcf9',
            'photo-1441974231531-c6227db76b6e',
            'photo-1501785888041-af3ef285b470',
            'photo-1472214103451-9374bd1c798e',
            'photo-1500382017468-9049fed747ef',
            'photo-1469474968028-56623f02e42e',
            'photo-1447752875215-b2761acb3c5d',
            'photo-1433086966358-54859d0ed716',
            'photo-1511497584788-8767ef7299b2',
        ];
        const randomId = NATURE_BG_IDS[Math.floor(Math.random() * NATURE_BG_IDS.length)];
        return `https://images.unsplash.com/${randomId}?auto=format&fit=crop&q=80&w=1600&h=900`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (duplicateError) return;

        // Manual validation to prevent accidental submissions from custom components
        if (!formData.nombre.trim()) {
            alert('Por favor, ingresa el nombre del profesor.');
            return;
        }
        if (!formData.especialidad.trim()) {
            alert('Por favor, selecciona o ingresa la materia principal.');
            return;
        }
        if (!formData.facultad.trim()) {
            alert('Por favor, selecciona una facultad.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.from('professors').insert({
                nombre: formData.nombre.trim().toUpperCase(),
                especialidad: formData.especialidad.trim().toUpperCase(),
                facultad: formData.facultad.trim().toUpperCase() || null,
                email: formData.email.trim() || null,
                otros_cursos: formData.otros_cursos.trim().toUpperCase() || null,
                background_image_url: getRandomBackgroundImage(),
                avatar_url: '/profes/tl.webp', // Default avatar
            }).select().single();

            if (error) throw error;

            if (data) {
                addProfessor(data);
            }

            if (onSuccess) {
                onSuccess();
            } else {
                router.push('/dashboard/professors');
                router.refresh();
            }
        } catch (error: any) {
            console.error('Error al guardar profesor:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={isModal ? "" : "max-w-4xl mx-auto py-4 md:py-8 px-4"}>
            {!isModal && (
                <Link
                    href="/dashboard/professors"
                    className="inline-flex items-center text-sm text-bb-text-secondary hover:text-bb-text mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    VOLVER A PROFESORES
                </Link>
            )}

            <Card className={`bg-bb-card border-bb-border shadow-xl ${isModal ? 'border-0 shadow-none' : ''}`}>
                <CardHeader className="border-b border-bb-border pb-6 md:pb-8">
                    <CardTitle className="text-xl md:text-3xl font-bold text-bb-text uppercase tracking-tight">AGREGAR NUEVO PROFESOR</CardTitle>
                    <CardDescription className="text-bb-text-secondary text-sm md:text-base mt-2 uppercase tracking-wide">
                        VERIFICA SI EL PROFESOR YA EXISTE PARA EVITAR DUPLICADOS. SI APARECE EN LAS SUGERENCIAS, SELECCIÓNALO PARA COMPLETAR SUS DATOS.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3 relative">
                                <Label htmlFor="nombre" className="text-bb-text text-sm font-bold uppercase tracking-wider">
                                    Nombre Completo *
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="nombre"
                                        value={formData.nombre}
                                        onChange={handleChange}
                                        onFocus={() => formData.nombre.length >= 1 && setShowSuggestions(true)}
                                        placeholder="ESCRIBE PARA BUSCAR..."
                                        required
                                        className="bg-bb-darker border-bb-border text-bb-text h-12 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all rounded-xl pl-10 uppercase"
                                        autoComplete="off"
                                    />
                                    <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                                    {searching && (
                                        <div className="absolute right-3 top-3.5">
                                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                        </div>
                                    )}
                                </div>

                                {/* Autocomplete Suggestions UI */}
                                <AnimatePresence>
                                    {showSuggestions && (formData.nombre.length >= 1) && (
                                        <motion.div
                                            ref={suggestionRef}
                                            initial={{ opacity: 0, y: -5, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -5, scale: 0.98 }}
                                            className="absolute z-[100] w-full mt-1 bg-bb-card border border-bb-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
                                        >
                                            <div className="p-3 border-b border-bb-border bg-bb-darker/80 flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">COINCIDENCIAS ENCONTRADAS</span>
                                                {searching && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                                            </div>

                                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                                {suggestions.length > 0 ? (
                                                    suggestions.map((prof) => (
                                                        <button
                                                            key={prof.id}
                                                            type="button"
                                                            onClick={() => handleSelectSuggestion(prof)}
                                                            className="w-full flex items-center gap-4 p-4 hover:bg-blue-500/10 transition-all text-left border-b border-bb-border last:border-0 group"
                                                        >
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-110 transition-transform">
                                                                <User className="w-5 h-5" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-bold text-bb-text truncate group-hover:text-blue-400 transition-colors uppercase">{prof.nombre}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase">{prof.especialidad}</span>
                                                                    <span className="text-[10px] text-bb-text-secondary truncate uppercase">{prof.facultad || 'FACULTAD GENERAL'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-[10px] font-bold text-blue-400/0 group-hover:text-blue-400/100 transition-all pr-2">
                                                                SELECCIONAR
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : !searching ? (
                                                    <div className="p-8 text-center bg-bb-darker/30">
                                                        <Info className="w-8 h-8 text-bb-text-secondary mx-auto mb-3 opacity-20" />
                                                        <p className="text-sm font-medium text-bb-text-secondary uppercase">No hay coincidencias exactas.</p>
                                                        <p className="text-[10px] text-bb-text-secondary/50 mt-1 uppercase">Puedes continuar creando uno nuevo.</p>
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="p-3 bg-bb-darker/50 border-t border-bb-border">
                                                <p className="text-[10px] text-center text-bb-text-secondary uppercase tracking-tighter">
                                                    Si no ves al profesor, termina de escribir para crearlo.
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="space-y-3 relative">
                                <Label htmlFor="facultad" className="text-bb-text text-sm font-bold uppercase tracking-wider">
                                    Facultad *
                                </Label>
                                <Select
                                    value={formData.facultad}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, facultad: val }))}
                                    required
                                >
                                    <SelectTrigger className="bg-bb-darker border-bb-border text-bb-text h-12 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all rounded-xl pl-4 uppercase">
                                        <SelectValue placeholder="SELECCIONA UNA FACULTAD" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                                        {FACULTADES.map((faculty) => (
                                            <SelectItem key={faculty} value={faculty} className="focus:bg-bb-hover focus:text-bb-text uppercase">
                                                {faculty}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Autocomplete
                                label="Materia Principal *"
                                placeholder="EJ: CÁLCULO I"
                                items={courseCatalog}
                                value={formData.especialidad}
                                onChange={(val) => {
                                    const e = { target: { id: 'especialidad', value: val } } as any;
                                    handleChange(e);
                                }}
                                className={`${duplicateError ? 'border-red-500/50 ring-red-500/10' : ''}`}
                            />

                            <div className="space-y-3">
                                <Label htmlFor="email" className="text-bb-text text-sm font-bold uppercase tracking-wider">
                                    Correo Electrónico
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="prof@universidad.edu"
                                    className="bg-bb-darker border-bb-border text-bb-text h-12 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-bb-text text-sm font-bold uppercase tracking-wider block">
                                OTROS CURSOS QUE DICTA (AUTO-COMPLETADO)
                            </Label>
                            <div className="bg-bb-darker/50 border border-bb-border rounded-2xl p-6 min-h-[80px] flex flex-wrap gap-2 items-center">
                                {suggestions.some(p => p.nombre.toUpperCase() === formData.nombre.toUpperCase()) ? (
                                    Array.from(new Set(
                                        suggestions
                                            .filter(p => p.nombre.toUpperCase() === formData.nombre.toUpperCase())
                                            .flatMap(p => [p.especialidad, ...(p.otros_cursos?.split(',') || [])])
                                            .filter(Boolean)
                                            .map(s => s?.trim())
                                    )).map((curso, i) => (
                                        <span key={i} className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold uppercase">
                                            {curso}
                                        </span>
                                    ))
                                ) : (
                                    <p className="text-bb-text-secondary text-xs uppercase italic opacity-50">
                                        No hay cursos adicionales registrados para este nombre.
                                    </p>
                                )}
                            </div>
                        </div>

                        <AnimatePresence>
                            {duplicateError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-400 rounded-2xl overflow-hidden p-4 md:p-6">
                                        <div className="flex gap-3 md:gap-4">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                                                <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-red-500" />
                                            </div>
                                            <div>
                                                <AlertTitle className="text-base md:text-lg font-bold uppercase">PROFESOR YA REGISTRADO</AlertTitle>
                                                <AlertDescription className="text-xs md:text-sm opacity-90 mt-1 uppercase">
                                                    YA EXISTE UN PROFESOR LLAMADO <span className="font-bold underline decoration-red-500/30">"{formData.nombre}"</span> PARA LA MATERIA <span className="font-bold underline decoration-red-500/30">"{formData.especialidad}"</span>.
                                                    <br className="hidden md:block" /> NO ES NECESARIO VOLVER A CREARLO.
                                                </AlertDescription>
                                            </div>
                                        </div>
                                    </Alert>
                                </motion.div>
                            )}

                            {!duplicateError && formData.nombre.trim().length > 3 && formData.especialidad.trim().length > 2 && !checking && !searching && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex items-center gap-3 text-green-400 text-sm font-bold bg-green-500/10 p-5 rounded-2xl border border-green-500/20 uppercase">
                                        <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        ESTE PROFESOR Y MATERIA ESTÁN DISPONIBLES PARA REGISTRO.
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="pt-6 border-t border-bb-border flex flex-col sm:flex-row gap-3 md:gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onCancel ? onCancel() : router.back()}
                                className="flex-1 h-12 md:h-14 border-bb-border bg-bb-darker hover:bg-bb-hover text-bb-text font-bold rounded-2xl transition-all uppercase"
                            >
                                CANCELAR
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || duplicateError || checking}
                                className="flex-1 h-12 md:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 transition-all border-0 text-base md:text-lg group uppercase"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                                        GUARDANDO...
                                    </>
                                ) : (
                                    'GUARDAR PROFESOR'
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
