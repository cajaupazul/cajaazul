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

  // Helper to normalize strings (remove accents, lowercase, trim)
  const normalizeString = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  // Helper function to perform ultra-strict matching on course names
  const isCleanMatch = (professorCourses: string[], targetCourse: string) => {
    if (!targetCourse) return false;
    const targetNorm = normalizeString(targetCourse);

    return professorCourses.some(course => {
      const courseNorm = normalizeString(course);
      if (courseNorm === targetNorm) return true;

      // Split professor courses by common delimiters and check for exact segment match
      const segments = courseNorm.split(/[,;|•]/).map(s => s.trim()).filter(Boolean);
      return segments.some(segment => segment === targetNorm);
    });
  };

  // Helper function to add professors to the local map, checking for strict course name matches
  const addProfToMap = (profs: any[], map: Map<string, any>, courseNameClean: string, forceInclude: boolean = false) => {
    profs.forEach(p => {
      if (!p || map.has(p.id)) return; // Skip if null/undefined or already added

      // If it's explicitly linked (e.g., junction table), we skip the name check
      if (forceInclude) {
        map.set(p.id, p);
        return;
      }

      // For other sources, apply strict clean match logic
      const allProfCourses = [
        p.especialidad,
        ...(p.otros_cursos ? (Array.isArray(p.otros_cursos) ? p.otros_cursos : [p.otros_cursos]) : [])
      ].filter(Boolean);

      if (isCleanMatch(allProfCourses, courseNameClean)) {
        map.set(p.id, p);
      }
    });
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
          .single();

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
          { data: junctionData },
          { data: profsData },
          { data: sessionData }
        ] = await Promise.all([
          supabase.from('materials')
            .select('*, professors(nombre), profiles(*)')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false }),
          supabase.from('course_professors')
            .select('professor_id')
            .eq('course_id', courseId),
          supabase.from('professors')
            .select('*, professor_ratings(puntuacion)')
            .limit(1000), // Fetch a good pool for matching
          supabase.auth.getUser()
        ]);

        setMaterials(materialsData || []);

        // 3. Handle User Permissions
        if (sessionData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', sessionData.user.id)
            .single();
          setCurrentUser(profile);
        }

        // 4. Unified Professor Merging
        const professorsMap = new Map();
        const linkedProfIds = new Set(junctionData?.map(cp => cp.professor_id) || []);

        // Count materials per professor for THIS course
        const materialsPerProf = new Map<string, number>();
        (materialsData || []).forEach(m => {
          if (m.professor_id) {
            materialsPerProf.set(m.professor_id, (materialsPerProf.get(m.professor_id) || 0) + 1);
          }
        });

        (profsData || []).forEach(p => {
          const isLinked = linkedProfIds.has(p.id);
          const materialCount = materialsPerProf.get(p.id) || 0;
          const isContributor = materialCount > 0;

          const profCourses = [
            p.especialidad,
            ...(p.otros_cursos ? (Array.isArray(p.otros_cursos) ? p.otros_cursos : [p.otros_cursos]) : [])
          ].filter(Boolean);

          const matchesName = isCleanMatch(profCourses, courseNameClean);

          // Inclusion Logic:
          // - Always include if linked in junction table (manual link)
          // - Include if match by name OR if they have materials for this course
          if (isLinked || matchesName || isContributor) {
            const ratings = p.professor_ratings || [];
            const avg = ratings.length > 0 ? ratings.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / ratings.length : 0;
            professorsMap.set(p.id, {
              ...p,
              averageRating: avg,
              hasMaterials: isContributor // This professor has active materials for this course
            });
          }
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
