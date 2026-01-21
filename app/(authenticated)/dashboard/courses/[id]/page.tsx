'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CourseDetailContent from '@/components/courses/CourseDetailContent';

export const runtime = 'edge';

export default function CourseDetailPage({ params }: { params: any }) {
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [allProfessors, setAllProfessors] = useState<any[]>([]);
  const [topProfessor, setTopProfessor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unwrappedParams, setUnwrappedParams] = useState<any>(null);

  useEffect(() => {
    async function unwrap() {
      const p = await params;
      setUnwrappedParams(p);
    }
    unwrap();
  }, [params]);

  useEffect(() => {
    if (!unwrappedParams?.id) return;

    async function fetchData() {
      try {
        const courseId = unwrappedParams.id;

        // 1. Fetch course and materials
        const [
          { data: courseData, error: courseError },
          { data: materialsData }
        ] = await Promise.all([
          supabase.from('courses').select('*').eq('id', courseId).single(),
          supabase.from('materials')
            .select('*, professors(nombre)')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false })
        ]);

        if (courseError || !courseData) {
          console.error('Course not found');
          return;
        }

        setCourse(courseData);
        setMaterials(materialsData || []);

        // 2. Fetch professors
        const { data: cpData } = await supabase
          .from('course_professors')
          .select('professor_id')
          .eq('course_id', courseId);

        if (cpData && cpData.length > 0) {
          const profIds = cpData.map(cp => cp.professor_id);
          const { data: profs } = await supabase
            .from('professors')
            .select('*, professor_ratings(puntuacion)')
            .in('id', profIds);

          if (profs) {
            const formattedProfs = profs.map(p => {
              const ratings = p.professor_ratings || [];
              const avg = ratings.length > 0 ? ratings.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / ratings.length : 0;
              return { ...p, averageRating: avg };
            });

            setAllProfessors(formattedProfs);
            const top = formattedProfs.reduce((prev, curr) => (prev.averageRating > curr.averageRating) ? prev : curr, formattedProfs[0]);
            setTopProfessor(top);
          }
        }
      } catch (err) {
        console.error('Error fetching course detail:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [unwrappedParams?.id]);

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
    />
  );
}