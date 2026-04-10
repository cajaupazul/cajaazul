'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CourseDetailContent from '@/components/courses/CourseDetailContent';

function CourseDetailWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('id');
  const [course, setCourse] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [allProfessors, setAllProfessors] = useState<any[]>([]);
  const [topProfessor, setTopProfessor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [courseCycles, setCourseCycles] = useState<any[]>([]);

  // Helper to normalize strings (remove accents, lowercase, trim)
  const normalizeString = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        // 1. Fetch course data
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .maybeSingle();

        if (courseError || !courseData) {
          console.error('Course not found');
          setLoading(false);
          return;
        }
        setCourse(courseData);
        const courseNameClean = courseData.nombre.trim();

        // 2. Parallel fetch for associated data
        const [
          { data: materialsData },
          { data: linkedData },
          { data: sessionData },
          { data: cyclesData }
        ] = await Promise.all([
          supabase.from('materials')
            .select('*, professors(nombre), profiles(*)')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false }),
          supabase.from('course_professors')
            .select(`
              professor_id,
              professors (
                *,
                professor_ratings (puntuacion, course_name)
              )
            `)
            .eq('course_id', courseId),
          supabase.auth.getUser(),
          supabase.from('course_cycles')
            .select('*')
            .eq('course_id', courseId)
            .order('ciclo_name', { ascending: false })
        ]);

        setMaterials(materialsData || []);
        setCourseCycles(cyclesData || []);

        // 3. Handle User Permissions - ONLY if not guest
        const isGuest = !sessionData?.user || !!sessionData?.user?.is_anonymous;
        if (sessionData?.user && !isGuest) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', sessionData.user.id)
            .maybeSingle();
          setCurrentUser(profile);
        }

        // 4. Unified Professor Merging
        const professorsMap = new Map();

        // Count materials per professor for THIS course
        const materialsPerProf = new Map<string, number>();
        (materialsData || []).forEach(m => {
          if (m.professor_id) {
            materialsPerProf.set(m.professor_id, (materialsPerProf.get(m.professor_id) || 0) + 1);
          }
        });

        (linkedData || []).forEach((item: any) => {
          const p = item.professors;
          if (!p) return;

          const materialCount = materialsPerProf.get(p.id) || 0;
          const isContributor = materialCount > 0;

          // STRICT Rating Filter: Only include ratings for THIS course
          const courseSpecificRatings = (p.professor_ratings || []).filter((r: any) => 
            r.course_name && normalizeString(r.course_name) === normalizeString(courseNameClean)
          );
          
          const hasCourseRatings = courseSpecificRatings.length > 0;
          const avg = hasCourseRatings 
            ? courseSpecificRatings.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / courseSpecificRatings.length 
            : 0;

          professorsMap.set(p.id, {
            ...p,
            averageRating: avg,
            hasMaterials: isContributor
          });
        });

        const finalProfs = Array.from(professorsMap.values());
        setAllProfessors(finalProfs);

        if (finalProfs.length > 0) {
          const top = finalProfs.reduce((prev, curr) => (prev.averageRating > curr.averageRating) ? prev : curr, finalProfs[0]);
          setTopProfessor(top);
        } else {
          setTopProfessor(null);
        }

      } catch (err) {
        console.error('Error fetching course detail:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bb-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bb-dark text-bb-text">
        <h1 className="text-2xl font-bold">Curso no encontrado</h1>
        <button
          onClick={() => router.back()}
          className="mt-4 text-blue-400 hover:underline"
        >
          Volver atrás
        </button>
      </div>
    );
  }

  return (
    <CourseDetailContent
      course={course}
      topProfessor={topProfessor}
      allProfessors={allProfessors}
      initialMaterials={materials}
      currentUser={currentUser}
      initialCourseCycles={courseCycles}
    />
  );
}

export default function CourseDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-bb-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <CourseDetailWrapper />
    </Suspense>
  );
}
