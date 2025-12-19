import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import ProfessorRatingsContent from '@/components/professors/ProfessorRatingsContent';

export const revalidate = 0;

export default async function ProfessorRatingsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const professorId = params.id;

  // 1. Check session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/auth/login');
  }

  // 2. Fetch professor details
  const { data: currentProf } = await supabase
    .from('professors')
    .select('*')
    .eq('id', professorId)
    .single();

  if (!currentProf) {
    notFound();
  }

  // 3. Fetch all records for the same professor name to consolidate courses
  const [
    { data: allProfRecords },
    { data: ratingsData }
  ] = await Promise.all([
    supabase.from('professors')
      .select('especialidad, otros_cursos')
      .ilike('nombre', currentProf.nombre),
    supabase.from('professor_ratings')
      .select('*, profiles(nombre, avatar_url, background_url, bio, carrera, link_instagram)')
      .eq('professor_id', professorId)
      .order('created_at', { ascending: false })
  ]);

  // 4. Aggregate unique courses across all records
  const uniqueCourses = new Set<string>();
  if (allProfRecords) {
    allProfRecords.forEach(rec => {
      if (rec.especialidad) uniqueCourses.add(rec.especialidad.trim());
      if (rec.otros_cursos) {
        rec.otros_cursos.split(',').forEach((c: string) => {
          const trimmed = c.trim();
          if (trimmed) uniqueCourses.add(trimmed);
        });
      }
    });
  }

  // Remove the current specialty from the set to avoid duplication in UI
  if (currentProf.especialidad) {
    uniqueCourses.delete(currentProf.especialidad.trim());
  }

  const aggregatedOtherCourses = Array.from(uniqueCourses);

  // 5. Fetch course mapping for linking
  const courseNamesToQuery = [
    currentProf.especialidad,
    ...aggregatedOtherCourses
  ].filter(Boolean);

  const { data: matchedCourses } = await supabase
    .from('courses')
    .select('id, nombre')
    .in('nombre', courseNamesToQuery);

  const courseMapping: Record<string, string> = {};
  matchedCourses?.forEach(c => {
    courseMapping[c.nombre] = c.id;
  });

  return (
    <ProfessorRatingsContent
      professor={currentProf}
      initialRatings={ratingsData || []}
      courseMapping={courseMapping}
      aggregatedOtherCourses={aggregatedOtherCourses}
    />
  );
}