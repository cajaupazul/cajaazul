import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  nombre: string;
  universidad: string | null;
  carrera: string | null;
  avatar_url: string | null;
  bio: string | null;
  puntos: number;
  background_url: string | null;
  link_instagram: string | null;
  created_at: string;
  updated_at: string;
};

export type Course = {
  id: string;
  nombre: string;
  codigo: string | null;
  facultad: string | null;
  carrera: string | null;
  ciclo: number | null;
  descripcion: string | null;
  imagen_url: string | null;
  created_at: string;
};

export type CourseProfessor = {
  id: string;
  course_id: string;
  professor_id: string;
  created_at: string;
};

export type Material = {
  id: string;
  course_id: string;
  user_id: string;
  titulo: string;
  descripcion: string | null;
  url_archivo: string;
  tipo: string;
  descargas: number;
  created_at: string;
  profiles?: Profile;
  courses?: Course;
};

export type Professor = {
  id: string;
  nombre: string;
  especialidad: string | null;
  facultad: string | null;
  avatar_url: string | null;
  background_image_url: string | null;
  email: string | null;
  otros_cursos: string | null;
  created_at: string;
  averageRating?: number;
};

export type Rating = {
  id: string;
  professor_id: string;
  user_id: string;
  puntuacion: number;
  comentario: string | null;
  facilidad: number | null;
  claridad: number | null;
  created_at: string;
  profiles?: Profile;
};

export type Event = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  lugar: string | null;
  tipo: string;
  imagen_url: string | null;
  created_by: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  contenido: string;
  hashtags: string[] | null;
  likes: number;
  created_at: string;
  profiles?: Profile;
};

export type ProfessorRating = {
  id: string;
  professor_id: string;
  user_id: string;
  puntuacion: number;
  comentario: string | null;
  claridad: number | null;
  facilidad: number | null;
  created_at: string;
  profiles?: Profile;
};

// Funciones helper para obtener profesores de un curso
export async function getProfessorsForCourse(courseId: string) {
  const { data, error } = await supabase
    .from('course_professors')
    .select(`
      *,
      professors (*)
    `)
    .eq('course_id', courseId);

  if (error) {
    console.error('Error fetching professors:', error);
    return [];
  }

  return data;
}

// Obtener el profesor mejor calificado de un curso
export async function getTopRatedProfessorForCourse(courseId: string) {
  const { data, error } = await supabase
    .from('course_professors')
    .select(`
      *,
      professors (*),
      professor_ratings (puntuacion)
    `)
    .eq('course_id', courseId);

  if (error) {
    console.error('Error fetching top professor:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Calcular promedio de calificación para cada profesor
  const professorsWithAvg = data.map((cp) => {
    const ratings = cp.professor_ratings || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / ratings.length
      : 0;

    return {
      ...cp,
      averageRating: avgRating,
    };
  });

  // Retornar el profesor con mejor calificación
  return professorsWithAvg.reduce((prev, current) =>
    prev.averageRating > current.averageRating ? prev : current
  );
}