'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProfessorRatingsContent from '@/components/professors/ProfessorRatingsContent';

function ProfessorRatingsWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const professorId = searchParams.get('id');
  const selectedCourse = searchParams.get('course');
  const [loading, setLoading] = useState(true);
  const [professor, setProfessor] = useState<any>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [courseMapping, setCourseMapping] = useState<Record<string, string>>({});
  const [professorLinkMapping, setProfessorLinkMapping] = useState<Record<string, string>>({});
  const [aggregatedOtherCourses, setAggregatedOtherCourses] = useState<string[]>([]);
  const [relatedProfessors, setRelatedProfessors] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [coursesTaught, setCoursesTaught] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [frameMap, setFrameMap] = useState<Record<string, any>>({});

  // Helper to normalize strings (remove accents, lowercase, trim)
  const normalizeStringStatic = (str: string) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  useEffect(() => {
    if (!professorId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // 1. Fetch professor details
        const { data: currentProf, error: profError } = await supabase
          .from('professors')
          .select('*')
          .eq('id', professorId)
          .single();

        if (profError || !currentProf) {
          console.error('Professor not found');
          return;
        }
        setProfessor(currentProf);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 2. Fetch data in parallel
        // Resolve course ID if context is provided
        let targetCourseId = null;
        if (selectedCourse) {
          const { data: matchedCourse } = await supabase
            .from('courses')
            .select('id')
            .ilike('nombre', selectedCourse)
            .single();
          if (matchedCourse) targetCourseId = matchedCourse.id;
        }

        const [
          { data: ratingsData },
          { data: materialsData },
          { data: coursesTaughtData },
          { data: commentsData },
          { data: userProfile },
          { data: framesData }
        ] = await Promise.all([
          supabase.from('professor_ratings')
            .select('*, profiles(nombre, avatar_url, background_url, active_frame_key, bio, created_at, puntos, es_vip)')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false }),
          supabase.from('materials')
            .select('*, courses(id, nombre)')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false }),
          supabase.from('course_professors')
            .select('courses(id, nombre)')
            .eq('professor_id', professorId),
          supabase.from('professor_comments')
            .select('*, profiles(nombre, avatar_url, background_url, active_frame_key, bio, created_at, puntos, es_vip)')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false }),
          supabase.from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),
          supabase.from('shop_items')
            .select('*')
            .eq('type', 'profile_frame')
            .eq('is_active', true)
        ]);

        // If no course context was provided per URL, pick the first course they teach for "Related Professors"
        const effectiveCourseId = targetCourseId || (coursesTaughtData as any)?.[0]?.courses?.id;

        let linkedProfessorsData: any[] = [];
        if (effectiveCourseId) {
          const { data: lpRes } = await supabase.from('course_professors')
            .select('professors(id, nombre, avatar_url, especialidad, facultad)')
            .eq('course_id', effectiveCourseId)
            .neq('professor_id', professorId)
            .limit(10);
          linkedProfessorsData = lpRes || [];
        }

        // Process data
        setRatings(ratingsData || []);
        setMaterials(materialsData || []);
        setComments(commentsData || []);
        setProfile(userProfile);
        setCoursesTaught(coursesTaughtData?.map((ct: any) => ct.courses).filter(Boolean) || []);

        // Related professors - Strictly Relational
        const relatedMap = new Map();
        linkedProfessorsData.forEach((lp: any) => {
          const p = lp.professors;
          if (p) relatedMap.set(p.id, p);
        });
        setRelatedProfessors(Array.from(relatedMap.values()).slice(0, 10));

        // Frame map
        const fMap: Record<string, any> = {};
        framesData?.forEach(f => {
          if (f.frame_key) fMap[f.frame_key] = f;
        });
        setFrameMap(fMap);

        // Course & Professor link mapping - Strictly Relational
        const finalCourses = coursesTaughtData?.map((ct: any) => ct.courses).filter(Boolean) || [];
        setCoursesTaught(finalCourses);

        const cMapping: Record<string, string> = {};
        finalCourses.forEach((c: any) => {
          cMapping[c.nombre.toLowerCase()] = c.id;
        });
        setCourseMapping(cMapping);

        setProfessorLinkMapping({}); 
        setAggregatedOtherCourses([]);

      } catch (err) {
        console.error('Error fetching professor detail:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [professorId, selectedCourse]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bb-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bb-dark text-bb-text">
        <h1 className="text-2xl font-bold">Profesor no encontrado</h1>
        <button onClick={() => router.back()} className="mt-4 text-blue-400 hover:underline">Volver atrás</button>
      </div>
    );
  }

  return (
    <ProfessorRatingsContent
      professor={professor}
      initialRatings={ratings}
      courseMapping={courseMapping}
      professorLinkMapping={professorLinkMapping}
      aggregatedOtherCourses={aggregatedOtherCourses}
      relatedProfessors={relatedProfessors}
      initialMaterials={materials}
      coursesTaught={coursesTaught}
      initialComments={comments}
      selectedCourse={selectedCourse}
      profile={profile}
      frameMap={frameMap}
    />
  );
}

export default function ProfessorRatingsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-bb-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <ProfessorRatingsWrapper />
    </Suspense>
  );
}
