import { createClient } from './supabase/client';
import { getPublicFileUrl } from './r2-storage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient();

/**
 * Resolves a storage path or full URL to a valid public URL.
 * Detects if the input is already a full URL.
 */
export function getStorageUrl(path: string | null | undefined, bucket: string = 'profile-avatars', fallback?: string): string {
  if (!path) return fallback || '';

  // If it's already a full URL, return it
  if (path.startsWith('http')) {
    // FIX: Handle placeholder URLs from migrations
    if (path.includes('[tu-proyecto].supabase.co')) {
      return path.replace('https://[tu-proyecto].supabase.co', supabaseUrl);
    }

    return path;
  }

  // If it's a data URL, return it
  if (path.startsWith('data:')) return path;

  // If it's a public static asset, return it
  if (path.startsWith('/')) return path;

  // Ensure we don't have a double bucket in the URL if the path already starts with the bucket name
  let cleanPath = path;
  if (path.startsWith(`${bucket}/`)) {
    cleanPath = path.replace(`${bucket}/`, '');
  }

  // Use R2 Worker Proxy
  return getPublicFileUrl(bucket, cleanPath);
}

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
  email: string | null;
  es_vip: boolean;
  monedas: number;
  vip_hasta: string | null;
  active_frame_key: string | null;
  google_full_name: string | null;
  role: 'user' | 'admin' | 'superadmin';
};

export type ShopCategory = {
  id: string;
  name: string;
  icon: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type ShopItem = {
  id: string;
  name: string;
  description: string | null;
  type: 'profile_frame' | 'background' | 'badge' | 'sticker' | 'other';
  category_id: string | null;
  price_coins: number;
  image_url: string | null;
  frame_key: string | null;
  frame_settings: {
    profile: { scale: number; x: number; y: number };
    card: { scale: number; x: number; y: number };
    navbar: { scale: number; x: number; y: number };
    preview: { scale: number; x: number; y: number };
  } | null;
  is_active: boolean;
  max_uses: number | null;
  created_at: string;
};

export type UserInventoryItem = {
  id: string;
  user_id: string;
  item_id: string;
  is_equipped: boolean;
  remaining_uses: number | null;
  acquired_at: string;
  shop_items?: ShopItem;
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
  syllabus_url: string | null;
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
  professor_id: string | null;
  titulo: string;
  descripcion: string | null;
  url_archivo: string;
  tipo: string;
  descargas: number;
  thumbnail_url: string | null;
  created_at: string;
  profiles?: Profile;
  courses?: Course;
  professors?: Professor;
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

export type OfertaAcademica = {
  id: string;
  periodo: string;
  codigo_curso: string;
  nombre_curso: string;
  seccion: string;
  profesor: string | null;
  creditos: number;
  tipo: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  duracion: number;
  cupos: number;
  aula: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type UserSchedule = {
  id: string;
  user_id: string;
  periodo: string;
  nombre: string;
  secciones: string[];
  created_at: string;
  updated_at: string;
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