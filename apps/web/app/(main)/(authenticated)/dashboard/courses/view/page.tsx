import type { Metadata } from 'next';
import { cache, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Course } from '@/lib/supabase';
import CourseDetailClient from './CourseDetailClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getCourse = cache(async (id: string): Promise<Course | null> => {
  const { data, error } = await supabase
    .from('courses')
    .select('id, nombre, codigo, facultad, carrera, ciclo, descripcion, imagen_url, syllabus_url, views, created_at, catalog_course_id')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error loading course:', error);
    return null;
  }

  return data as Course | null;
});

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const id = typeof params?.id === 'string' ? params.id : undefined;

  if (!id) {
    return {
      title: 'Cursos | CajaAzul',
      description: 'Materiales, profesores, grupos y herramientas académicas en CajaAzul.',
    };
  }

  try {
    const course = await getCourse(id);

    if (course) {
      const title = `${course.nombre} | CajaAzul`;
      const descDetails = [
        course.facultad ? `Facultad: ${course.facultad}` : null,
        course.ciclo ? `Ciclo: ${course.ciclo}` : null,
        'Materiales, profesores y apuntes en CajaAzul',
      ].filter(Boolean).join(' · ');

      const rawImageUrl = course.imagen_url ? course.imagen_url.trim().replace(/[\r\n\s]+/g, '') : undefined;
      const imageUrl = rawImageUrl || 'https://cajaazul.pages.dev/favicon.png';
      const pageUrl = `https://cajaazul.pages.dev/dashboard/courses/view?id=${id}`;

      return {
        title,
        description: descDetails,
        openGraph: {
          title,
          description: descDetails,
          url: pageUrl,
          siteName: 'CajaAzul',
          type: 'website',
          images: [
            {
              url: imageUrl,
              secureUrl: imageUrl,
              width: 1200,
              height: 630,
              alt: course.nombre,
            },
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description: descDetails,
          images: [imageUrl],
        },
      };
    }
  } catch (err) {
    console.error('Error in course generateMetadata:', err);
  }

  return {
    title: 'Cursos | CajaAzul',
    description: 'Materiales, profesores, grupos y herramientas académicas en CajaAzul.',
  };
}

export default async function CourseDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const id = typeof params?.id === 'string' ? params.id : undefined;
  const initialCourse = id ? await getCourse(id) : null;

  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-bb-dark">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <CourseDetailClient initialCourseId={id} initialCourse={initialCourse} />
    </Suspense>
  );
}
