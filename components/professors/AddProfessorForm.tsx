'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase, Profile, Professor } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, Search, User } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface AddProfessorFormProps {
    profile: Profile | null;
}

export default function AddProfessorForm({ profile }: AddProfessorFormProps) {
    const router = useRouter();
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
            if (formData.nombre.trim().length >= 3) {
                setSearching(true);
                const { data, error } = await supabase
                    .from('professors')
                    .select('*')
                    .ilike('nombre', `%${formData.nombre.trim()}%`)
                    .limit(5);

                if (!error && data) {
                    setSuggestions(data);
                    setShowSuggestions(data.length > 0);
                }
                setSearching(false);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        const timer = setTimeout(searchProfessors, 300);
        return () => clearTimeout(timer);
    }, [formData.nombre]);

    // Check for exact duplicates (name + specialty)
    useEffect(() => {
        const checkDuplicate = async () => {
            if (formData.nombre.trim().length > 3 && formData.especialidad.trim().length > 2) {
                setChecking(true);
                const { data, error } = await supabase
                    .from('professors')
                    .select('id')
                    .ilike('nombre', formData.nombre.trim())
                    .ilike('especialidad', formData.especialidad.trim())
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

        const timer = setTimeout(checkDuplicate, 500);
        return () => clearTimeout(timer);
    }, [formData.nombre, formData.especialidad]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
        if (id === 'nombre') setShowSuggestions(true);
    };

    const handleSelectSuggestion = (prof: Professor) => {
        setFormData({
            nombre: prof.nombre,
            especialidad: prof.especialidad || '',
            facultad: prof.facultad || '',
            email: prof.email || '',
            otros_cursos: prof.otros_cursos || '',
        });
        setShowSuggestions(false);
    };

    const getRandomBackgroundImage = () => {
        const randomId = Math.floor(Math.random() * 100000);
        return `https://picsum.photos/500/200?random=${randomId}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (duplicateError) return;

        setLoading(true);
        try {
            const { error } = await supabase.from('professors').insert({
                nombre: formData.nombre.trim(),
                especialidad: formData.especialidad.trim(),
                facultad: formData.facultad.trim() || null,
                email: formData.email.trim() || null,
                otros_cursos: formData.otros_cursos.trim() || null,
                background_image_url: getRandomBackgroundImage(),
            });

            if (error) throw error;

            router.push('/dashboard/professors');
            router.refresh();
        } catch (error: any) {
            console.error('Error al guardar profesor:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <Link
                href="/dashboard/professors"
                className="inline-flex items-center text-sm text-bb-text-secondary hover:text-bb-text mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Profesores
            </Link>

            <Card className="bg-bb-card border-bb-border shadow-xl">
                <CardHeader className="border-b border-bb-border pb-8">
                    <CardTitle className="text-3xl font-bold text-bb-text">Agregar Nuevo Profesor</CardTitle>
                    <CardDescription className="text-bb-text-secondary text-base mt-2">
                        Completa la información del profesor para que otros estudiantes puedan encontrar sus referencias y calificar su desempeño.
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
                                        onFocus={() => formData.nombre.length >= 3 && setShowSuggestions(true)}
                                        placeholder="Ej: Dr. Juan García"
                                        required
                                        className="bg-bb-darker border-bb-border text-bb-text h-12 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all rounded-lg pl-10"
                                        autoComplete="off"
                                    />
                                    <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                                    {searching && (
                                        <div className="absolute right-3 top-3.5">
                                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                        </div>
                                    )}
                                </div>

                                {/* Autocomplete Suggestions */}
                                <AnimatePresence>
                                    {showSuggestions && suggestions.length > 0 && (
                                        <motion.div
                                            ref={suggestionRef}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute z-50 w-full mt-2 bg-bb-card border border-bb-border rounded-xl shadow-2xl overflow-hidden"
                                        >
                                            <div className="p-2 border-b border-bb-border bg-bb-darker/50">
                                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest px-2">¿Es alguno de estos profesores?</p>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto">
                                                {suggestions.map((prof) => (
                                                    <button
                                                        key={prof.id}
                                                        type="button"
                                                        onClick={() => handleSelectSuggestion(prof)}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-bb-hover transition-colors text-left border-b border-bb-border last:border-0"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-bb-text truncate">{prof.nombre}</p>
                                                            <p className="text-xs text-bb-text-secondary truncate">{prof.especialidad} • {prof.facultad || 'Facultad General'}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="facultad" className="text-bb-text text-sm font-bold uppercase tracking-wider">
                                    Facultad
                                </Label>
                                <Input
                                    id="facultad"
                                    value={formData.facultad}
                                    onChange={handleChange}
                                    placeholder="Ej: Ingeniería"
                                    className="bg-bb-darker border-bb-border text-bb-text h-12 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all rounded-lg"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="especialidad" className="text-bb-text text-sm font-bold uppercase tracking-wider">
                                    Materia Principal *
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="especialidad"
                                        value={formData.especialidad}
                                        onChange={handleChange}
                                        placeholder="Ej: Cálculo I"
                                        required
                                        className={`bg-bb-darker border-bb-border text-bb-text h-12 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all rounded-lg pr-10 ${duplicateError ? 'border-red-500/50 ring-red-500/10' : ''}`}
                                    />
                                    {checking && (
                                        <div className="absolute right-3 top-3">
                                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                        </div>
                                    )}
                                </div>
                            </div>

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
                                    className="bg-bb-darker border-bb-border text-bb-text h-12 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="otros_cursos" className="text-bb-text text-sm font-bold uppercase tracking-wider">
                                Otros Cursos que Dicta
                            </Label>
                            <Input
                                id="otros_cursos"
                                value={formData.otros_cursos}
                                onChange={handleChange}
                                placeholder="Ej: Álgebra, Estadística, Física I (Separados por comas)"
                                className="bg-bb-darker border-bb-border text-bb-text h-12 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all rounded-lg"
                            />
                        </div>

                        <AnimatePresence>
                            {duplicateError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-400 rounded-xl">
                                        <AlertCircle className="h-5 w-5" />
                                        <AlertTitle className="font-bold">Profesor ya registrado</AlertTitle>
                                        <AlertDescription className="text-sm opacity-90">
                                            Ya existe un profesor con el nombre "{formData.nombre}" para la materia "{formData.especialidad}". Verifica si es la misma persona antes de continuar.
                                        </AlertDescription>
                                    </Alert>
                                </motion.div>
                            )}

                            {!duplicateError && formData.nombre.trim().length > 3 && formData.especialidad.trim().length > 2 && !checking && !searching && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex items-center gap-2 text-green-400 text-sm font-medium bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                                        <CheckCircle2 className="w-4 h-4" />
                                        La combinación de profesor y materia parece estar disponible.
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="pt-6 border-t border-bb-border flex flex-col sm:flex-row gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.back()}
                                className="flex-1 h-12 border-bb-border bg-bb-darker hover:bg-bb-hover text-bb-text font-bold rounded-xl transition-all"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || duplicateError || checking}
                                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all border-0"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    'Guardar Profesor'
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
