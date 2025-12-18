'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/lib/profile-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Search, Plus } from 'lucide-react';
import { supabase, Course } from '@/lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const FACULTADES = [
  'Facultad de Ciencias Empresariales',
  'Facultad de Derecho',
  'Facultad de Economía y Finanzas',
  'Facultad de Ingeniería',
];

const CICLOS = Array.from({ length: 13 }, (_, i) => i.toString());

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('todos');
  const [selectedCareer, setSelectedCareer] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [savedCourses, setSavedCourses] = useState<string[]>([]);
  const isFetching = useRef(false); // Prevenir peticiones duplicadas
  const hasLoadedOnce = useRef(false); // Mantener datos visibles
  const router = useRouter();
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    facultad: '',
    ciclo: '',
    descripcion: '',
    imagen: null as File | null,
  });

  const { profile, loading: profileLoading } = useProfile();
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setDebugLog(prev => [msg, ...prev].slice(0, 5));
    console.log(`[DEBUG] ${msg}`);
  };

  useEffect(() => {
    // Solo cargamos si no se está cargando ya
    if (!hasLoadedOnce.current) {
      fetchCourses();
    }

    if (!profileLoading && !profile) {
      router.push('/auth/login');
    }

    // El timeout de seguridad ahora es más corto ya que fetchCourses es la fuente de verdad
    const timer = setTimeout(() => {
      if (!hasLoadedOnce.current) setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [profile?.id, profileLoading]); // Dependency profile.id instead of profile object

  const fetchCourses = async () => {
    if (isFetching.current) return;

    try {
      isFetching.current = true;
      addLog('Iniciando fetchCourses...');

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        addLog(`Error: ${error.message}`);
        console.error('Error fetching courses:', error);
      } else {
        addLog(`Éxito: ${data?.length || 0} cursos.`);
        setCourses(data || []);
        hasLoadedOnce.current = true;
      }
    } catch (err) {
      addLog(`Catch Error: ${err instanceof Error ? err.message : '?'}`);
      console.error('Catch error:', err);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  };

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

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre.trim() || !formData.codigo.trim() || !formData.facultad || !formData.ciclo) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    setCreatingCourse(true);
    let imagenUrl = '';

    try {
      if (formData.imagen) {
        if (!formData.imagen.type.startsWith('image/')) {
          alert('Por favor selecciona un archivo de imagen válido');
          setCreatingCourse(false);
          return;
        }

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
          alert(`Error al subir la imagen: ${uploadError.message}`);
          setCreatingCourse(false);
          return;
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
          codigo: formData.codigo.trim().toUpperCase(),
          facultad: formData.facultad,
          ciclo: parseInt(formData.ciclo),
          descripcion: formData.descripcion.trim() || null,
          carrera: 'Ingeniería de Sistemas',
          imagen_url: imagenUrl || null,
        });

      if (error) {
        alert(`Error al crear el curso: ${error.message}`);
        setCreatingCourse(false);
        return;
      }

      setCreateDialogOpen(false);
      setFormData({
        nombre: '',
        codigo: '',
        facultad: '',
        ciclo: '',
        descripcion: '',
        imagen: null,
      });
      setImagePreview('');
      await fetchCourses();
      alert('¡Curso creado exitosamente!');

    } catch (error) {
      console.error('Error general:', error);
      alert('Error al crear el curso');
    } finally {
      setCreatingCourse(false);
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.codigo?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCycle = selectedCycle === 'todos' || course.ciclo?.toString() === selectedCycle;
    const matchesCareer = selectedCareer === 'todos' || course.carrera === selectedCareer;

    return matchesSearch && matchesCycle && matchesCareer;
  });

  const toggleSavedCourse = (courseId: string) => {
    setSavedCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const cycles = Array.from(new Set(courses.map((c) => c.ciclo))).sort();
  const careers = Array.from(new Set(courses.map((c) => c.carrera)));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bb-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8 bg-bb-dark transition-colors duration-300">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-bb-text">Cursos</h1>
          <p className="text-bb-text-secondary mt-2">
            {filteredCourses.length} {filteredCourses.length === 1 ? 'curso' : 'cursos'} disponibles
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 h-11 text-white shadow-lg shadow-blue-500/20">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Curso
            </Button>
          </DialogTrigger>

          {/* Panel de Diagnóstico Temporal */}
          <div className="fixed bottom-4 right-4 p-4 bg-black/80 border border-blue-500 rounded-lg text-[10px] text-blue-300 z-[100] w-64 shadow-2xl backdrop-blur-md">
            <p className="font-bold border-b border-blue-500/30 mb-2 pb-1 text-blue-400">DEBUG PANEL</p>
            <p>Auth: {profileLoading ? 'Loading...' : (profile ? `Ok (${profile.id.slice(0, 5)})` : 'No Profile')}</p>
            <p>Courses State: {courses.length}</p>
            <div className="mt-2 text-gray-400">
              {debugLog.map((log, i) => <div key={i} className="truncate">• {log}</div>)}
            </div>
            <Button size="sm" onClick={() => fetchCourses()} className="mt-2 h-6 text-[10px] w-full bg-blue-900/50 hover:bg-blue-800">Forzar Recarga</Button>
          </div>

          <DialogContent className="bg-bb-card border-bb-border text-bb-text max-w-md max-h-screen overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Curso</DialogTitle>
              <DialogDescription className="text-bb-text-secondary">
                Completa los datos del nuevo curso
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <Label htmlFor="nombre" className="text-bb-text">Nombre del Curso *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value.toUpperCase() })}
                  placeholder="Ej: Algoritmos y Estructuras de Datos"
                  required
                  className="mt-2 bg-bb-darker border-bb-border text-bb-text"
                />
              </div>

              <div>
                <Label htmlFor="codigo" className="text-bb-text">Código del Curso *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ej: CS101"
                  required
                  className="mt-2 bg-bb-darker border-bb-border text-bb-text"
                  maxLength={10}
                />
              </div>

              <div>
                <Label htmlFor="facultad" className="text-bb-text">Facultad *</Label>
                <Select value={formData.facultad} onValueChange={(value) => setFormData({ ...formData, facultad: value })}>
                  <SelectTrigger className="mt-2 bg-bb-darker border-bb-border text-bb-text">
                    <SelectValue placeholder="Selecciona una facultad" />
                  </SelectTrigger>
                  <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                    {FACULTADES.map((fac) => (
                      <SelectItem key={fac} value={fac} className="focus:bg-bb-hover focus:text-bb-text">
                        {fac}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ciclo" className="text-bb-text">Ciclo *</Label>
                <Select value={formData.ciclo} onValueChange={(value) => setFormData({ ...formData, ciclo: value })}>
                  <SelectTrigger className="mt-2 bg-bb-darker border-bb-border text-bb-text">
                    <SelectValue placeholder="Selecciona un ciclo" />
                  </SelectTrigger>
                  <SelectContent className="bg-bb-card border-bb-border text-bb-text">
                    {CICLOS.map((ciclo) => (
                      <SelectItem key={ciclo} value={ciclo} className="focus:bg-bb-hover focus:text-bb-text">
                        Ciclo {ciclo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="descripcion" className="text-bb-text">Descripción</Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción del curso (opcional)"
                  className="mt-2 bg-bb-darker border-bb-border text-bb-text"
                />
              </div>

              <div>
                <Label htmlFor="imagen" className="text-bb-text">Imagen del Curso</Label>
                <Input
                  id="imagen"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mt-2 bg-bb-darker border-bb-border text-bb-text"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img src={imagePreview} alt="Preview" className="h-24 w-full object-cover rounded" />
                  </div>
                )}
                {formData.imagen && (
                  <p className="text-xs text-green-500 mt-1">✓ Imagen seleccionada: {formData.imagen.name}</p>
                )}
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={creatingCourse}>
                {creatingCourse ? 'Creando...' : 'Agregar Curso'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-bb-text-secondary h-5 w-5" />
        <Input
          placeholder="Busque sus cursos"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 py-6 text-base bg-bb-card border-bb-border text-bb-text rounded-lg shadow-sm placeholder:text-bb-text-secondary/50"
        />
      </div>

      <div className="mb-8 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-bb-text-secondary">Períodos</span>
          <Select value={selectedCycle} onValueChange={setSelectedCycle}>
            <SelectTrigger className="w-40 bg-bb-card border-bb-border text-bb-text">
              <SelectValue placeholder="Todos los períodos" />
            </SelectTrigger>
            <SelectContent className="bg-bb-card border-bb-border text-bb-text">
              <SelectItem value="todos" className="focus:bg-bb-hover focus:text-bb-text">Todos los períodos</SelectItem>
              {cycles.map((cycle) => (
                <SelectItem key={cycle} value={cycle?.toString() || 'otros'} className="focus:bg-bb-hover focus:text-bb-text">
                  Ciclo {cycle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-bb-text-secondary">Filtros</span>
          <Select value={selectedCareer} onValueChange={setSelectedCareer}>
            <SelectTrigger className="w-40 bg-bb-card border-bb-border text-bb-text">
              <SelectValue placeholder="Todas las carreras" />
            </SelectTrigger>
            <SelectContent className="bg-bb-card border-bb-border text-bb-text">
              <SelectItem value="todos" className="focus:bg-bb-hover focus:text-bb-text">Todas las carreras</SelectItem>
              {careers.map((career) => (
                <SelectItem key={career} value={career || 'otros'} className="focus:bg-bb-hover focus:text-bb-text">
                  {career}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-sm text-bb-text-secondary ml-auto">
          {Math.min(itemsPerPage, filteredCourses.length)} de {filteredCourses.length} elementos
        </span>
      </div>

      {
        filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="group cursor-pointer overflow-hidden rounded-lg shadow-md glass-card transition-all hover:shadow-lg hover:border-blue-500/30"
                onClick={() => router.push(`/dashboard/courses/${course.id}`)}
              >
                <div className="relative h-40 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600">
                  {course.imagen_url ? (
                    <img
                      src={course.imagen_url}
                      alt={course.nombre}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-blue-400 via-blue-500 to-teal-600 transition-transform group-hover:scale-105" />
                  )}
                </div>

                <div className="p-4">
                  <span className="text-xs font-semibold text-bb-text-secondary uppercase">
                    {course.codigo}
                  </span>

                  <h3 className="mt-2 line-clamp-2 text-sm font-bold text-bb-text group-hover:text-blue-400 transition-colors">
                    {course.nombre}
                  </h3>

                  <div className="mt-2 text-xs text-bb-text-secondary space-y-1">
                    {course.carrera && <div>{course.carrera}</div>}
                    {course.ciclo && <div>Ciclo {course.ciclo}</div>}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-bb-border">
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                      Abierto
                    </Badge>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSavedCourse(course.id);
                        }}
                        className={`text-lg transition-colors ${savedCourses.includes(course.id)
                          ? 'text-yellow-400'
                          : 'text-bb-text-secondary hover:text-yellow-400'
                          }`}
                        aria-label="Guardar curso"
                      >
                        ★
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/courses/${course.id}`);
                        }}
                        className="text-blue-500 hover:bg-blue-500/10 hover:text-blue-400"
                      >
                        Ver más
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-bb-text-secondary text-lg">
              {searchQuery ? 'No se encontraron cursos' : 'No hay cursos disponibles'}
            </p>
          </div>
        )
      }
    </div >
  );
}