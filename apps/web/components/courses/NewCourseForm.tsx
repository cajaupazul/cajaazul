'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Image as ImageIcon, CheckCircle } from 'lucide-react';
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
import { useDashboardData } from '@/lib/dashboard-data-context';

const FACULTADES = [
    'Facultad de Ciencias Empresariales',
    'Facultad de Derecho',
    'Facultad de Economía y Finanzas',
    'Facultad de Ingeniería',
];

const CICLOS = Array.from({ length: 13 }, (_, i) => i.toString());

export default function NewCourseForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get('id');
    const isEditing = !!courseId;

    const { addCourse } = useDashboardData();

    const [creatingCourse, setCreatingCourse] = useState(false);
    const [imagePreview, setImagePreview] = useState<string>('');

    const [catalogItems, setCatalogItems] = useState<string[]>([]);
    const [catalogCourses, setCatalogCourses] = useState<{ id: string; nombre: string; codigo: string | null }[]>([]);

    const [formData, setFormData] = useState({
        nombre: '',
        codigo: '',
        facultad: '',
        ciclo: '',
        descripcion: '',
        imagen: null as File | null,
        currentImageUrl: '',
        catalog_course_id: null as string | null,
    });

    useEffect(() => {
        const fetchCatalog = async () => {
            const { data } = await supabase
                .from('catalog_courses')
                .select('id, nombre, codigo')
                .order('nombre');

            if (data && data.length > 0) {
                setCatalogCourses(data);
                setCatalogItems(data.map((c) => c.nombre));
            }
        };
        fetchCatalog();
    }, []);

    useEffect(() => {
        const loadCourseData = async () => {
            if (!courseId) return;

            try {
                const { data, error } = await supabase
                    .from('courses')
                    .select('*')
                    .eq('id', courseId)
                    .single();

                if (error) throw error;
                if (data) {
                    setFormData({
                        nombre: data.nombre,
                        codigo: data.codigo || '',
                        facultad: data.facultad || '',
                        ciclo: data.ciclo?.toString() || '',
                        descripcion: data.descripcion || '',
                        imagen: null,
                        currentImageUrl: data.imagen_url || '',
                        catalog_course_id: data.catalog_course_id || null
                    });
                    if (data.imagen_url) {
                        setImagePreview(data.imagen_url);
                    }
                }
            } catch (err) {
                console.error('Error loading course:', err);
                alert('Error al cargar los datos del curso');
                router.push('/dashboard/courses');
            }
        };

        if (isEditing) {
            loadCourseData();
        }
    }, [courseId, isEditing]);

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

        if (!formData.nombre.trim() || !formData.facultad || !formData.ciclo) {
            alert('Por favor completa los campos requeridos (Nombre, Facultad y Ciclo)');
            return;
        }

        setCreatingCourse(true);
        let imagenUrl = formData.currentImageUrl;

        try {
            if (formData.imagen) {
                const fileExt = formData.imagen.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

                const { uploadFileToR2 } = await import('@/lib/r2-storage');
                imagenUrl = await uploadFileToR2('course-images', fileName, formData.imagen);
            }

            if (isEditing) {
                const { error } = await supabase
                    .from('courses')
                    .update({
                        nombre: formData.nombre.trim().toUpperCase(),
                        codigo: formData.codigo ? formData.codigo.toUpperCase() : null,
                        facultad: formData.facultad,
                        ciclo: parseInt(formData.ciclo),
                        descripcion: formData.descripcion.trim() || null,
                        carrera: formData.facultad,
                        imagen_url: imagenUrl || null,
                        catalog_course_id: formData.catalog_course_id
                    })
                    .eq('id', courseId);

                if (error) throw error;
                alert('¡Curso actualizado exitosamente!');
            } else {
                const { data, error } = await supabase
                    .from('courses')
                    .insert({
                        nombre: formData.nombre.trim().toUpperCase(),
                        codigo: formData.codigo ? formData.codigo.toUpperCase() : null,
                        facultad: formData.facultad,
                        ciclo: parseInt(formData.ciclo),
                        descripcion: formData.descripcion.trim() || null,
                        carrera: formData.facultad,
                        imagen_url: imagenUrl || null,
                        catalog_course_id: formData.catalog_course_id
                    })
                    .select()
                    .single();

                if (error) throw error;
                if (data) addCourse(data);
                alert('¡Curso creado exitosamente!');
            }

            router.push('/dashboard/courses');
            router.refresh();

        } catch (error: any) {
            console.error('Error:', error);
            alert(error.message || 'Error al procesar el curso');
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
                    <h1 className="text-4xl font-black text-bb-text">{isEditing ? 'Editar Curso' : 'Crear Nuevo Curso'}</h1>
                    <p className="text-bb-text-secondary mt-2">{isEditing ? 'Modifica los detalles del curso existente.' : 'Registra un nuevo curso en la plataforma CampusLink.'}</p>
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
                                    items={catalogItems.length > 0 ? catalogItems : courseCatalog}
                                    value={formData.nombre}
                                    onChange={(val) => {
                                        const match = catalogCourses.find(
                                            (c) => c.nombre.trim().toLowerCase() === val.trim().toLowerCase()
                                        );
                                        setFormData((prev) => ({
                                            ...prev,
                                            nombre: val,
                                            codigo: match?.codigo || prev.codigo,
                                            catalog_course_id: match?.id || null,
                                        }));
                                    }}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="codigo" className="text-bb-text font-bold">Código Oficial del Curso</Label>
                                <Input
                                    id="codigo"
                                    value={formData.codigo}
                                    readOnly
                                    placeholder="Selecciona un curso del catálogo"
                                    className="bg-bb-darker border-bb-border text-blue-400 h-12 font-mono text-xl tracking-widest cursor-not-allowed"
                                />
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
                                        Al crear este curso, el código oficial se asigna automáticamente desde el catálogo institucional para garantizar integridad referencial.
                                    </p>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-white text-lg font-black shadow-2xl shadow-blue-600/20 mt-4"
                                disabled={creatingCourse}
                            >
                                {creatingCourse ? (isEditing ? 'ACTUALIZANDO...' : 'CREANDO CURSO...') : (isEditing ? 'ACTUALIZAR CURSO' : 'AGREGAR CURSO')}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
