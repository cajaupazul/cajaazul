'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Image as ImageIcon, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { courseCatalog } from '@/lib/data/courseCatalog';

const FACULTADES = [
    'Facultad de Ciencias Empresariales',
    'Facultad de Derecho',
    'Facultad de Economía y Finanzas',
    'Facultad de Ingeniería',
];

const CICLOS = Array.from({ length: 13 }, (_, i) => i.toString());

const generateRandomCode = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export default function NewCourseForm() {
    const router = useRouter();
    const [creatingCourse, setCreatingCourse] = useState(false);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [isGeneratingCode, setIsGeneratingCode] = useState(true);

    const [formData, setFormData] = useState({
        nombre: '',
        codigo: '',
        facultad: '',
        ciclo: '',
        descripcion: '',
        imagen: null as File | null,
    });

    useEffect(() => {
        const initCode = async () => {
            setIsGeneratingCode(true);
            let code = generateRandomCode();
            let isUnique = false;
            let attempts = 0;

            while (!isUnique && attempts < 10) {
                const { data } = await supabase
                    .from('courses')
                    .select('codigo')
                    .eq('codigo', code)
                    .maybeSingle();

                if (!data) {
                    isUnique = true;
                } else {
                    code = generateRandomCode();
                    attempts++;
                }
            }

            setFormData(prev => ({ ...prev, codigo: code }));
            setIsGeneratingCode(false);
        };

        initCode();
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormData({ ...formData, imagen: file });
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nombre.trim() || !formData.codigo || !formData.facultad || !formData.ciclo) {
            alert('Por favor completa los campos requeridos');
            return;
        }

        setCreatingCourse(true);
        let imagenUrl = '';

        try {
            if (formData.imagen) {
                const fileExt = formData.imagen.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('course_images')
                    .upload(fileName, formData.imagen, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: formData.imagen.type
                    });

                if (uploadError) {
                    throw new Error(`Error al subir la imagen: ${uploadError.message}`);
                }

                const { data: publicUrlData } = supabase.storage
                    .from('course_images')
                    .getPublicUrl(fileName);

                imagenUrl = publicUrlData.publicUrl;
            }

            const { error } = await supabase
                .from('courses')
                .insert({
                    nombre: formData.nombre.trim().toUpperCase(),
                    codigo: formData.codigo.toUpperCase(),
                    facultad: formData.facultad,
                    ciclo: parseInt(formData.ciclo),
                    descripcion: formData.descripcion.trim() || null,
                    carrera: formData.facultad, // We'll store the faculty in carrera for now to maintain compatibility with existing fields
                    imagen_url: imagenUrl || null,
                });

            if (error) throw error;

            alert('¡Curso creado exitosamente!');
            router.push('/dashboard/courses');
            router.refresh();

        } catch (error: any) {
            console.error('Error:', error);
            alert(error.message || 'Error al crear el curso');
        } finally {
            setCreatingCourse(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-10 px-6">
            <div className="mb-10 flex items-center justify-between">
                <div>
                    <Button
                        variant="ghost"
                        className="pl-0 text-bb-text-secondary hover:text-bb-text hover:bg-transparent mb-4"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-5 w-5 mr-1" /> Volver a cursos
                    </Button>
                    <h1 className="text-4xl font-black text-bb-text">Crear Nuevo Curso</h1>
                    <p className="text-bb-text-secondary mt-2">Registra un nuevo curso en la plataforma CampusLink.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Form Fields */}
                    <div className="space-y-6">
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-8 space-y-6 shadow-xl">
                            <h2 className="text-xl font-bold text-bb-text flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-400" /> Información Básica
                            </h2>

                            <div className="space-y-2">
                                <Autocomplete
                                    label="Nombre del Curso *"
                                    placeholder="EJ: CÁLCULO DIFERENCIAL"
                                    items={courseCatalog}
                                    value={formData.nombre}
                                    onChange={(val) => setFormData({ ...formData, nombre: val.toUpperCase() })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="codigo" className="text-bb-text font-bold">Código del Curso (Autogenerado)</Label>
                                <div className="relative">
                                    <Input
                                        id="codigo"
                                        value={formData.codigo}
                                        readOnly
                                        className="bg-bb-darker border-bb-border text-blue-400 h-12 font-mono text-xl tracking-widest cursor-not-allowed"
                                    />
                                    {isGeneratingCode && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-bb-text-secondary/60 italic">Este código es único y se asigna automáticamente.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="facultad" className="text-bb-text font-bold">Facultad *</Label>
                                    <Select value={formData.facultad} onValueChange={(v) => setFormData(prev => ({ ...prev, facultad: v }))}>
                                        <SelectTrigger className="bg-bb-darker border-bb-border text-bb-text h-11">
                                            <SelectValue placeholder="Seleccionar" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                                            {FACULTADES.map((f) => (
                                                <SelectItem key={f} value={f}>{f}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ciclo" className="text-bb-text font-bold">Ciclo *</Label>
                                    <Select value={formData.ciclo} onValueChange={(v) => setFormData(prev => ({ ...prev, ciclo: v }))}>
                                        <SelectTrigger className="bg-bb-darker border-bb-border text-bb-text h-11">
                                            <SelectValue placeholder="Ciclo" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                                            {CICLOS.map((c) => (
                                                <SelectItem key={c} value={c}>Ciclo {c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="descripcion" className="text-bb-text font-bold">Descripción (Opcional)</Label>
                                <Textarea
                                    id="descripcion"
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    placeholder="Describe brevemente el objetivo del curso..."
                                    className="bg-bb-darker border-bb-border text-bb-text min-h-[120px]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visuals & Submission */}
                    <div className="space-y-6">
                        <div className="bg-bb-card border border-bb-border rounded-3xl p-8 space-y-6 shadow-xl">
                            <h2 className="text-xl font-bold text-bb-text flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-purple-400" /> Imagen de Portada
                            </h2>

                            <div
                                className={`relative h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden ${imagePreview ? 'border-blue-500 bg-blue-500/5' : 'border-bb-border hover:border-bb-text-secondary bg-bb-darker/50'
                                    }`}
                            >
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Label htmlFor="imagen" className="cursor-pointer bg-white text-black px-4 py-2 rounded-full font-bold">Cambiar Imagen</Label>
                                        </div>
                                    </>
                                ) : (
                                    <label htmlFor="imagen" className="cursor-pointer flex flex-col items-center group">
                                        <div className="w-16 h-16 rounded-full bg-bb-border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <ImageIcon className="w-8 h-8 text-bb-text-secondary" />
                                        </div>
                                        <p className="font-bold text-bb-text">Sube una imagen representativa</p>
                                        <p className="text-xs text-bb-text-secondary mt-1">Soporta JPG, PNG (Max 5MB)</p>
                                    </label>
                                )}
                                <input
                                    id="imagen"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <div className="bg-blue-600/5 border border-blue-500/20 rounded-3xl p-8 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <CheckCircle className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-bb-text font-medium">Revisión de Seguridad</p>
                                    <p className="text-[11px] text-bb-text-secondary leading-relaxed mt-1">
                                        Al crear este curso, asegúrate de que el nombre y el código sean precisos según el plan de estudios oficial. El código generado garantiza integridad referencial.
                                    </p>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-white text-lg font-black shadow-2xl shadow-blue-600/20 mt-4"
                                disabled={creatingCourse || isGeneratingCode}
                            >
                                {creatingCourse ? 'CREANDO CURSO...' : 'AGREGAR CURSO'}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
