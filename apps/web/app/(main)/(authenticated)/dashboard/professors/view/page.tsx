'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProfessorRatingsContent from '@/components/professors/ProfessorRatingsContent';

function ProfessorRatingsWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const professorId = searchParams.get('id');
  const contextCourseId = searchParams.get('courseId');
  const selectedCourseName = searchParams.get('course'); // Fallback/Legacy
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
  const [effectiveCourseId, setEffectiveCourseId] = useState<string | null>(null);
  const [effectiveCourseName, setEffectiveCourseName] = useState<string | null>(null);

  useEffect(() => {
    if (!professorId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        // 1. Fetch professor details
        const { data: currentProf, error: profError } = await supabase
          .from('professors')
          .select('*')
          .eq('id', professorId)
          .single();

        if (profError || !currentProf) {
          console.error('Professor not found');
          setLoading(false);
          return;
        }
        setProfessor(currentProf);

        const { data: { user } } = await supabase.auth.getUser();

        // 2. Fetch all courses taught by this professor (to find effective course)
        const { data: coursesTaughtData } = await supabase
          .from('course_professors')
          .select('courses(id, nombre)')
          .eq('professor_id', professorId);
        
        const finalCourses: {id: string, nombre: string}[] = [];
        const seenNames = new Set<string>();

        if (coursesTaughtData) {
          coursesTaughtData.forEach((ct: any) => {
            if (ct.courses && !seenNames.has(ct.courses.nombre.toLowerCase().trim())) {
              seenNames.add(ct.courses.nombre.toLowerCase().trim());
              finalCourses.push(ct.courses);
            }
          });
        }

        // Add text-based courses from especialidad and otros_cursos
        if (currentProf.especialidad && !seenNames.has(currentProf.especialidad.trim().toLowerCase())) {
          seenNames.add(currentProf.especialidad.trim().toLowerCase());
          finalCourses.push({ id: `virtual-esp`, nombre: currentProf.especialidad.trim() });
        }
        
        if (currentProf.otros_cursos) {
          const others = currentProf.otros_cursos.split(',').map((c: string) => c.trim()).filter(Boolean);
          others.forEach((o: string, idx: number) => {
            if (!seenNames.has(o.toLowerCase())) {
              seenNames.add(o.toLowerCase());
              finalCourses.push({ id: `virtual-oth-${idx}`, nombre: o });
            }
          });
        }
        
        setCoursesTaught(finalCourses);

        // 3. Resolve effective course ID
        let currentEffectiveCourseId = contextCourseId;
        let currentEffectiveCourseName = selectedCourseName;
        
        // Fallback to name if ID is missing but name is present
        if (!currentEffectiveCourseId && currentEffectiveCourseName) {
          const matched = finalCourses.find(c => c.nombre.toLowerCase() === currentEffectiveCourseName?.toLowerCase());
          if (matched && !matched.id.startsWith('virtual-')) currentEffectiveCourseId = matched.id;
        }

        // Final fallback: use the first course they teach or whatever is available
        if (!currentEffectiveCourseId && !currentEffectiveCourseName && finalCourses.length > 0) {
          const first = finalCourses[0];
          currentEffectiveCourseName = first.nombre;
          if (!first.id.startsWith('virtual-')) currentEffectiveCourseId = first.id;
        }

        const isVirtualActive = finalCourses.find(c => c.nombre.toLowerCase() === currentEffectiveCourseName?.toLowerCase())?.id.startsWith('virtual-');
        
        setEffectiveCourseId(currentEffectiveCourseId);
        setEffectiveCourseName(currentEffectiveCourseName);

        // 4. Fetch context-specific data in parallel
        const promises: any[] = [
          supabase.from('professor_ratings')
            .select('*, profiles(nombre, avatar_url, background_url, active_frame_key, bio, created_at, puntos, es_vip)')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false }),
          supabase.from('materials')
            .select('*, courses(id, nombre)')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false }),
          supabase.from('professor_comments')
            .select('*, profiles(nombre, avatar_url, background_url, active_frame_key, bio, created_at, puntos, es_vip)')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false }),
          supabase.from('shop_items')
            .select('*')
            .eq('type', 'profile_frame')
            .eq('is_active', true)
        ];

        if (user) {
          promises.push(supabase.from('profiles').select('*').eq('id', user.id).single());
        } else {
          promises.push(Promise.resolve({ data: null }));
        }

        const [
          { data: ratingsData },
          { data: materialsData },
          { data: commentsData },
          { data: framesData },
          { data: userProfile }
        ] = await Promise.all(promises);

        // 5. Filter data by effectiveCourseId
        // This ensures the independent profile feel
        const filteredRatings = (ratingsData || []).filter((r: any) => {
          if (currentEffectiveCourseId) return r.course_id === currentEffectiveCourseId;
          if (isVirtualActive && currentEffectiveCourseName) return r.course_name?.toLowerCase() === currentEffectiveCourseName.toLowerCase();
          return true;
        });
        
        const filteredMaterials = (materialsData || []).filter((m: any) => {
          if (currentEffectiveCourseId) return m.course_id === currentEffectiveCourseId;
          return false;
        });
        
        const filteredComments = (commentsData || []).filter((c: any) => {
          if (currentEffectiveCourseId) return c.course_id === currentEffectiveCourseId;
          if (isVirtualActive && currentEffectiveCourseName) return c.course_name?.toLowerCase() === currentEffectiveCourseName.toLowerCase();
          return true;
        });

        setRatings(filteredRatings);
        setMaterials(filteredMaterials);
        setComments(filteredComments);
        setProfile(userProfile);

        // Related professors - Restricted to same course
        let linkedProfessorsData: any[] = [];
        if (effectiveCourseId) {
          const { data: lpRes } = await supabase.from('course_professors')
            .select('professors(id, nombre, avatar_url, especialidad, facultad)')
            .eq('course_id', effectiveCourseId)
            .neq('professor_id', professorId)
            .limit(10);
          linkedProfessorsData = lpRes || [];
        }

        const relatedMap = new Map();
        linkedProfessorsData.forEach((lp: any) => {
          const p = lp.professors;
          if (p) relatedMap.set(p.id, p);
        });
        setRelatedProfessors(Array.from(relatedMap.values()).slice(0, 10));

        // Frame map
        const fMap: Record<string, any> = {};
        framesData?.forEach((f: any) => {
          if (f.frame_key) fMap[f.frame_key] = f;
        });
        setFrameMap(fMap);

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
  }, [professorId, contextCourseId, selectedCourseName]);

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
      selectedCourse={effectiveCourseName}
      selectedCourseId={effectiveCourseId}
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
