import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import CourseDetailContent from '@/components/courses/CourseDetailContent';

export const revalidate = 0;

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const courseId = params.id;

  // 1. Check session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/auth/login');
  }

  // 2. Fetch course and materials
  const [
    { data: course },
    { data: materials }
  ] = await Promise.all([
    supabase.from('courses').select('*').eq('id', courseId).single(),
    supabase.from('materials').select('*').eq('course_id', courseId).order('created_at', { ascending: false })
  ]);

  if (!course) {
    notFound();
  }

  // 3. Fetch professors
  const { data: cpData } = await supabase
    .from('course_professors')
    .select('professor_id')
    .eq('course_id', courseId);

  let topProfessor = null;
  let allProfessors: any[] = [];

  if (cpData && cpData.length > 0) {
    const profIds = cpData.map(cp => cp.professor_id);
    const { data: profs } = await supabase
      .from('professors')
      .select('*, professor_ratings(puntuacion)')
      .in('id', profIds);

    if (profs) {
      allProfessors = profs.map(p => {
        const ratings = p.professor_ratings || [];
        const avg = ratings.length > 0 ? ratings.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / ratings.length : 0;
        return { ...p, averageRating: avg };
      });

      topProfessor = allProfessors.reduce((prev, curr) => (prev.averageRating > curr.averageRating) ? prev : curr, allProfessors[0]);
    }
  }

  return (
    <CourseDetailContent
      course={course}
      materials={materials || []}
      topProfessor={topProfessor}
      allProfessors={allProfessors}
      initialMaterials={materials || []}
    />
  );
}