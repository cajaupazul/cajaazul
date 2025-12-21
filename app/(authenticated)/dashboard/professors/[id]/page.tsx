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
    { data: ratingsData },
    { data: relatedProfessors }
  ] = await Promise.all([
    supabase.from('professors')
      .select('id, especialidad, otros_cursos')
      .ilike('nombre', currentProf.nombre),
    supabase.from('professor_ratings')
      .select('*, profiles(nombre, avatar_url, background_url, bio, carrera, link_instagram)')
      .eq('professor_id', professorId)
      .order('created_at', { ascending: false }),
    // NEW: Fetch professors teaching the same course
    currentProf.especialidad
      ? supabase.from('professors')
        .select('id, nombre, especialidad, facultad')
        .ilike('especialidad', currentProf.especialidad)
        .neq('id', professorId) // Exclude current professor
        .limit(10)
      : Promise.resolve({ data: null, error: null })
  ]);

  // 4. Aggregate unique courses across all records (case-insensitive for uniqueness)
  const uniqueCoursesMap = new Map<string, string>(); // Original Name -> Lowercase Version

  // NEW: Create professor link mapping (especialidad -> professor ID)
  const professorLinkMapping: Record<string, string> = {};

  const processCourseName = (name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      uniqueCoursesMap.set(trimmed.toLowerCase(), trimmed);
    }
  };

  if (allProfRecords) {
    allProfRecords.forEach(rec => {
      // Map especialidad to professor ID for interlinking
      if (rec.especialidad) {
        const especialidadLower = rec.especialidad.trim().toLowerCase();
        professorLinkMapping[especialidadLower] = rec.id;
        processCourseName(rec.especialidad);
      }

      if (rec.otros_cursos) {
        rec.otros_cursos.split(',').forEach((c: string) => processCourseName(c));
      }
    });
  }

  // Get original names for display, but keep track of lowercase for matching
  const allUniqueCourseOriginalNames = Array.from(uniqueCoursesMap.values());
  const allUniqueCourseLowerNames = Array.from(uniqueCoursesMap.keys());

  // 5. Fetch course mapping (Case-insensitive matching) - as fallback
  const { data: matchedCourses } = await supabase
    .from('courses')
    .select('id, nombre')
    .in('nombre', allUniqueCourseOriginalNames); // Direct match first

  const courseMapping: Record<string, string> = {};
  matchedCourses?.forEach(c => {
    courseMapping[c.nombre.toLowerCase()] = c.id;
  });

  // If some are missing, maybe they have different casing. 
  const missingLowerNames = allUniqueCourseLowerNames.filter(name => !courseMapping[name]);

  if (missingLowerNames.length > 0) {
    // Try a more flexible search for missing ones
    const orQuery = missingLowerNames.map(name => `nombre.ilike.${name}`).join(',');
    const { data: extraMatches } = await supabase
      .from('courses')
      .select('id, nombre')
      .or(orQuery);

    extraMatches?.forEach(c => {
      courseMapping[c.nombre.toLowerCase()] = c.id;
    });
  }

  // Prepare final list for UI (excluding current specialty)
  const currentSpecialtyLower = currentProf.especialidad?.trim().toLowerCase();
  const aggregatedOtherCourses = allUniqueCourseOriginalNames.filter(name =>
    name.toLowerCase() !== currentSpecialtyLower
  );

  return (
    <ProfessorRatingsContent
      professor={currentProf}
      initialRatings={ratingsData || []}
      courseMapping={courseMapping}
      professorLinkMapping={professorLinkMapping}
      aggregatedOtherCourses={aggregatedOtherCourses}
      relatedProfessors={relatedProfessors || []}
    />
  );
}