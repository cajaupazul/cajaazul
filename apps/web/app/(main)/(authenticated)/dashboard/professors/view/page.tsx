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
          .maybeSingle();

        if (profError || !currentProf) {
          console.error('Professor not found');
          setLoading(false);
          return;
        }
        setProfessor(currentProf);

        const { data: { user } } = await supabase.auth.getUser();

        // 1.5. Find all duplicate professors with the same name to consolidate their data
        const { data: duplicateProfs } = await supabase
          .from('professors')
          .select('id, especialidad, otros_cursos')
          .ilike('nombre', currentProf.nombre);
        
        const allProfIds = duplicateProfs && duplicateProfs.length > 0 
          ? duplicateProfs.map((p: any) => p.id) 
          : [professorId];

        // 2. Fetch all courses taught by any of these professor IDs
        const { data: coursesTaughtData } = await supabase
          .from('course_professors')
          .select('courses(id, nombre)')
          .in('professor_id', allProfIds);
        
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

        setCoursesTaught(finalCourses);

        // 3. Resolve effective course ID
        let currentEffectiveCourseId = contextCourseId;
        let currentEffectiveCourseName = selectedCourseName;
        
        // Fallback to name if ID is missing but name is present
        if (!currentEffectiveCourseId && currentEffectiveCourseName) {
          const matched = finalCourses.find(c => c.nombre.toLowerCase() === currentEffectiveCourseName?.toLowerCase());
          if (matched && !matched.id.startsWith('virtual-')) currentEffectiveCourseId = matched.id;
        }

        // Final fallback: auto-resolve to first course for display (ID needed for filtering)
        if (!currentEffectiveCourseId && !currentEffectiveCourseName && finalCourses.length > 0) {
          const first = finalCourses[0];
          currentEffectiveCourseName = first.nombre;
          if (!first.id.startsWith('virtual-')) currentEffectiveCourseId = first.id;
        }

        const isVirtualActive = finalCourses.find(c => c.nombre.toLowerCase() === currentEffectiveCourseName?.toLowerCase())?.id.startsWith('virtual-');
        
        setEffectiveCourseId(currentEffectiveCourseId);
        setEffectiveCourseName(currentEffectiveCourseName);

        // 4. Fetch context-specific data in parallel for ALL duplicate IDs
        const promises: any[] = [
          supabase.from('professor_ratings')
            .select('*, profiles(nombre, avatar_url, background_url, active_frame_key, bio, created_at, puntos, es_vip)')
            .in('professor_id', allProfIds)
            .order('created_at', { ascending: false }),
          supabase.from('materials')
            .select('*, courses(id, nombre)')
            .in('professor_id', allProfIds)
            .order('created_at', { ascending: false }),
          supabase.from('professor_comments')
            .select('*, profiles(nombre, avatar_url, background_url, active_frame_key, bio, created_at, puntos, es_vip)')
            .in('professor_id', allProfIds)
            .order('created_at', { ascending: false }),
          supabase.from('shop_items')
            .select('*')
            .eq('type', 'profile_frame')
            .eq('is_active', true)
        ];

        const isGuest = !user || !!user?.is_anonymous;
        if (user && !isGuest) {
          promises.push(supabase.from('profiles').select('*').eq('id', user.id).maybeSingle());
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

        // 5. Filter data strictly by course — each course is fully independent.
        // Also accepts ratings saved with course_id=null when course_name matches
        // For legacy ratings (no course context at all), we show them in all courses 
        // to prevent 5.0 professors appearing as 0.0 on every tab.
        const filteredRatings = (ratingsData || []).filter((r: any) => {
          if (!r.course_id && !r.course_name) return true; // Legacy global ratings

          if (currentEffectiveCourseId) {
            // Primary: exact course_id match
            if (r.course_id === currentEffectiveCourseId) return true;
            // Fallback: rating stored without course_id but with matching course_name
            if (r.course_id === null && currentEffectiveCourseName &&
                r.course_name?.toLowerCase() === currentEffectiveCourseName.toLowerCase()) return true;
            return false;
          }
          // Virtual course (text-based only): match by name
          if (isVirtualActive && currentEffectiveCourseName) {
            return r.course_name?.toLowerCase() === currentEffectiveCourseName.toLowerCase();
          }
          return true;
        });

        const filteredMaterials = (materialsData || []).filter((m: any) => {
          if (!m.course_id && !currentEffectiveCourseName) return true; // Legacy
          if (currentEffectiveCourseId) return m.course_id === currentEffectiveCourseId;
          return true;
        });

        const filteredComments = (commentsData || []).filter((c: any) => {
          if (!c.course_id && !c.course_name) return true; // Legacy global comments

          if (currentEffectiveCourseId) {
            if (c.course_id === currentEffectiveCourseId) return true;
            if (c.course_id === null && currentEffectiveCourseName &&
                c.course_name?.toLowerCase() === currentEffectiveCourseName.toLowerCase()) return true;
            return false;
          }
          if (isVirtualActive && currentEffectiveCourseName) {
            return c.course_name?.toLowerCase() === currentEffectiveCourseName.toLowerCase();
          }
          return true;
        });

        setRatings(filteredRatings);
        setMaterials(filteredMaterials);
        setComments(filteredComments);
        setProfile(userProfile);

        // Related professors - Restricted to same course
        let linkedProfessorsData: any[] = [];
        
        // Try the official relational table if it is a real DB Course ID
        if (currentEffectiveCourseId && !currentEffectiveCourseId.startsWith('virtual-')) {
          const { data: lpRes } = await supabase.from('course_professors')
            .select('professors(id, nombre, avatar_url, especialidad, facultad)')
            .eq('course_id', currentEffectiveCourseId)
            .not('professor_id', 'in', `(${allProfIds.join(',')})`)
            .limit(10);
            
          linkedProfessorsData = lpRes || [];
        }

        // If we didn't find any (maybe it's a virtual course), try text fallbacks
        if (linkedProfessorsData.length === 0 && currentEffectiveCourseName) {
           const { data: stringMatchRes } = await supabase.from('professors')
            .select('id, nombre, avatar_url, especialidad, facultad')
            .not('id', 'in', `(${allProfIds.join(',')})`)
            .or(`especialidad.ilike.%${currentEffectiveCourseName}%,otros_cursos.ilike.%${currentEffectiveCourseName}%`)
            .limit(10);
            
            // Map it back to the expected { professors: { ... } } shape
            if (stringMatchRes) {
                linkedProfessorsData = stringMatchRes.map((p: any) => ({ professors: p }));
            }
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
