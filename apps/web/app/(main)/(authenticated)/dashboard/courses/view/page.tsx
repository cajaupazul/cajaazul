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

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // 1. Fetch course and materials
        const [
          { data: courseData, error: courseError },
          { data: materialsData }
        ] = await Promise.all([
          supabase.from('courses').select('*').eq('id', courseId).single(),
          supabase.from('materials')
            .select('*, professors(nombre), profiles(*)')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false })
        ]);

        if (courseError || !courseData) {
          console.error('Course not found');
          return;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          setCurrentUser(profile);
        }

        setCourse(courseData);
        setMaterials(materialsData || []);

        // 2. Fetch professors (junction table, fuzzy match, and contributors)
        const courseNameClean = courseData.nombre.trim();

        // Parallel fetch for all potential associations
        const [
          { data: cpData },
          { data: matchedProfs },
          { data: materialProfs }
        ] = await Promise.all([
          supabase.from('course_professors').select('professor_id').eq('course_id', courseId),
          supabase.from('professors')
            .select('*, professor_ratings(puntuacion)')
            .or(`especialidad.ilike.%${courseNameClean}%,otros_cursos.ilike.%${courseNameClean}%`),
          supabase.from('materials')
            .select('professor_id')
            .eq('course_id', courseId)
            .not('professor_id', 'is', null)
        ]);

        const professorsMap = new Map();

        // Helper to format and add professor to map
        const addProfToMap = (p: any) => {
          if (!p) return;
          const ratings = p.professor_ratings || [];
          const avg = ratings.length > 0 ? ratings.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / ratings.length : 0;
          professorsMap.set(p.id, { ...p, averageRating: avg });
        };

        // 1. Add direct matches from name search
        matchedProfs?.forEach(addProfToMap);

        // 2. Add professors explicitly linked in junction table
        const linkedProfIds = cpData?.map(cp => cp.professor_id) || [];
        if (linkedProfIds.length > 0) {
          const { data: linkedProfs } = await supabase
            .from('professors')
            .select('*, professor_ratings(puntuacion)')
            .in('id', linkedProfIds);
          linkedProfs?.forEach(addProfToMap);
        }

        // 3. Add professors who have contributed materials
        const contributorIds = Array.from(new Set(materialProfs?.map(m => m.professor_id).filter(Boolean)));
        if (contributorIds.length > 0) {
          const missingIds = contributorIds.filter(id => !professorsMap.has(id));
          if (missingIds.length > 0) {
            const { data: contriProfs } = await supabase
              .from('professors')
              .select('*, professor_ratings(puntuacion)')
              .in('id', missingIds);
            contriProfs?.forEach(addProfToMap);
          }
        }

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
