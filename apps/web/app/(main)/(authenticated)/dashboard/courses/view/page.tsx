import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import CourseDetailClient from './CourseDetailClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
    const { data: course } = await supabase
      .from('courses')
      .select('nombre, facultad, ciclo, codigo, imagen_url')
      .eq('id', id)
      .maybeSingle();

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

  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-bb-dark">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <CourseDetailClient initialCourseId={id} />
    </Suspense>
  );
}
