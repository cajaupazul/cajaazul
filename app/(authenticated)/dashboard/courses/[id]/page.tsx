'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Course, Professor } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, Mail } from 'lucide-react';
import UploadMaterialsForm from './upload-materials-form';

type TabType = 'presentaciones' | 'examenes' | 'otros';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [topProfessor, setTopProfessor] = useState<any>(null);
  const [allProfessors, setAllProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('presentaciones');

  useEffect(() => {
    fetchCourseDetails();
    fetchMaterials();
  }, [courseId]);

  const fetchCourseDetails = async () => {
    try {
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) {
        console.error('Error fetching course:', courseError);
        setLoading(false);
        return;
      }

      setCourse(courseData);

      const { data: courseProfessorsData, error: professorsError } = await supabase
        .from('course_professors')
        .select('professor_id')
        .eq('course_id', courseId);

      if (professorsError) {
        console.error('Error fetching course professors:', professorsError);
      } else if (courseProfessorsData && courseProfessorsData.length > 0) {
        const professorIds = courseProfessorsData.map((cp) => cp.professor_id);

        const { data: professorsData, error: profError } = await supabase
          .from('professors')
          .select('*')
          .in('id', professorIds);

        if (profError) {
          console.error('Error fetching professor details:', profError);
        } else if (professorsData) {
          setAllProfessors(professorsData);

          let bestProfessor: any = null;
          let bestRating = -1;

          for (const prof of professorsData) {
            const { data: ratingsData, error: ratingsError } = await supabase
              .from('professor_ratings')
              .select('puntuacion')
              .eq('professor_id', prof.id);

            if (ratingsError) {
              console.error('Error fetching ratings for professor:', ratingsError);
            }

            const avgRating = ratingsData && ratingsData.length > 0
              ? ratingsData.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / ratingsData.length
              : 0;

            if (avgRating > bestRating) {
              bestRating = avgRating;
              bestProfessor = {
                ...prof,
                averageRating: avgRating,
              };
            }
          }

          if (bestProfessor) {
            setTopProfessor(bestProfessor);
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching materials:', error);
      } else if (data) {
        setMaterials(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Filtrar materiales por tipo
  const presentaciones = materials.filter(
    (m) => m.tipo?.toLowerCase().includes('ppt') || m.tipo?.toLowerCase().includes('presentacion')
  );

  const examenes = materials.filter((m) => m.tipo?.toLowerCase().includes('examen'));

  const otros = materials.filter(
    (m) =>
      !m.tipo?.toLowerCase().includes('ppt') &&
      !m.tipo?.toLowerCase().includes('presentacion') &&
      !m.tipo?.toLowerCase().includes('examen')
  );

  const tabs = [
    { id: 'presentaciones' as TabType, label: '📊 Presentaciones', count: presentaciones.length },
    { id: 'examenes' as TabType, label: '📝 Exámenes Pasados', count: examenes.length },
    { id: 'otros' as TabType, label: '📚 Otros Recursos', count: otros.length },
  ];

  const renderMaterialGrid = (materials: any[]) => {
    if (materials.length === 0) {
      return <p className="text-slate-500 text-center py-8">No hay materiales en esta categoría</p>;
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {materials.map((material) => {
          let bgColor = 'bg-blue-50';
          let borderColor = 'border-blue-200';
          let icon = '📎';

          if (activeTab === 'presentaciones') {
            bgColor = 'bg-orange-50';
            borderColor = 'border-orange-200';
            icon = '📊';
          } else if (activeTab === 'examenes') {
            bgColor = 'bg-red-50';
            borderColor = 'border-red-200';
            icon = '📋';
          }

          return (
            <a
              key={material.id}
              href={material.url_archivo}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-4 ${bgColor} rounded-lg hover:shadow-md transition-all border ${borderColor} flex flex-col items-center gap-2 group cursor-pointer`}
            >
              <span className="text-4xl group-hover:scale-110 transition-transform">{icon}</span>
              <p className="text-xs font-medium text-slate-700 text-center line-clamp-2 group-hover:text-slate-900">
                {material.titulo}
              </p>
            </a>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex-1 p-8 bg-slate-50">
        <div className="text-center py-12">
          <p className="text-slate-500 text-lg">Curso no encontrado</p>
          <Button onClick={() => router.back()} className="mt-4">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* Header con imagen */}
      <div className="relative h-64 bg-gradient-to-br from-blue-400 to-blue-600">
        {course.imagen_url ? (
          <img
            src={course.imagen_url}
            alt={course.nombre}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 via-blue-500 to-teal-600" />
        )}

        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 left-4 bg-white hover:bg-slate-100"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Contenido principal */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna izquierda - Tabs */}
          <div className="lg:col-span-2">
            {/* Información del curso */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-blue-600 uppercase mb-2">
                    {course.codigo}
                  </p>
                  <h1 className="text-4xl font-bold text-slate-900">
                    {course.nombre}
                  </h1>
                </div>
                <Badge className="bg-green-50 text-green-700 border-0">
                  Abierto
                </Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-6">
                {course.facultad && (
                  <div>
                    <span className="font-semibold">Facultad:</span> {course.facultad}
                  </div>
                )}
                {course.carrera && (
                  <div>
                    <span className="font-semibold">Carrera:</span> {course.carrera}
                  </div>
                )}
                {course.ciclo && (
                  <div>
                    <span className="font-semibold">Ciclo:</span> {course.ciclo}
                  </div>
                )}
              </div>

              {course.descripcion && (
                <p className="text-slate-600 leading-relaxed">
                  {course.descripcion}
                </p>
              )}
            </div>

            {/* Tabs mejorados */}
            <div className="w-full">
              <div className="flex items-center justify-between gap-4 mb-6">
                {/* Tabs */}
                <div className="flex gap-2 border-b border-slate-200 flex-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 font-medium text-sm transition-all relative whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'text-blue-600'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {tab.label}
                        <span className="bg-slate-200 text-slate-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {tab.count}
                        </span>
                      </span>
                      {activeTab === tab.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Botón de subir */}
                <UploadMaterialsForm
                  courseId={courseId}
                  onMaterialUploaded={fetchMaterials}
                />
              </div>

              {/* Contenido de materiales */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                {activeTab === 'presentaciones' && renderMaterialGrid(presentaciones)}
                {activeTab === 'examenes' && renderMaterialGrid(examenes)}
                {activeTab === 'otros' && renderMaterialGrid(otros)}
              </div>
            </div>
          </div>

          {/* Columna derecha - Profesor mejor calificado */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Profesor destacado */}
              {topProfessor ? (
                <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-24"></div>

                  <div className="px-6 pb-6">
                    <div className="-mt-12 mb-4">
                      {topProfessor.avatar_url ? (
                        <img
                          src={topProfessor.avatar_url}
                          alt={topProfessor.nombre}
                          className="w-20 h-20 rounded-full border-4 border-white object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full border-4 border-white bg-slate-300 flex items-center justify-center">
                          <span className="text-2xl font-bold text-slate-600">
                            {topProfessor.nombre.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-lg mb-1">
                      {topProfessor.nombre}
                    </h3>

                    <p className="text-xs text-slate-500 mb-3">
                      {topProfessor.especialidad || 'Especialidad no especificada'}
                    </p>

                    {/* Calificación */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.round(topProfessor.averageRating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        {topProfessor.averageRating.toFixed(1)}
                      </span>
                    </div>

                    <Button className="w-full bg-blue-600 hover:bg-blue-700 mb-3">
                      <Mail className="h-4 w-4 mr-2" />
                      Contactar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
                  <p className="text-slate-500 text-center">
                    No hay profesores asignados a este curso
                  </p>
                </div>
              )}

              {/* Otros profesores */}
              {allProfessors.length > 1 && (
                <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
                  <h4 className="font-semibold text-slate-900 mb-4">
                    Otros profesores
                  </h4>
                  <div className="space-y-3">
                    {allProfessors.map((prof) => (
                      prof.id !== topProfessor?.id && (
                        <div key={prof.id} className="p-3 bg-slate-50 rounded-lg">
                          <p className="font-medium text-sm text-slate-900">
                            {prof.nombre}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {prof.especialidad || 'Especialidad no especificada'}
                          </p>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}