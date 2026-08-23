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
  const [blackboardContributions, setBlackboardContributions] = useState<any[]>([]);
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
        // courses.catalog_course_id is the FK to catalog_courses.id
        const catalogCourseId = courseData.catalog_course_id;

        const [
          { data: materialsData },
          { data: linkedData },
          { data: sessionData },
          { data: cyclesData },
          { data: blackboardSets }
        ] = await Promise.all([
          supabase.from('materials')
            .select('*, professors(nombre), profiles(*)')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false }),
          // ← Use catalog_course_id instead of course_id
          catalogCourseId
            ? supabase.from('course_professors')
                .select(`
                  professor_id,
                  professors (
                    *,
                    professor_ratings (puntuacion, catalog_course_id)
                  )
                `)
                .eq('catalog_course_id', catalogCourseId)
            : Promise.resolve({ data: [] }),
          supabase.auth.getUser(),
          supabase.from('course_cycles')
            .select('*')
            .eq('course_id', courseId)
            .order('ciclo_name', { ascending: false }),
          supabase.from('bb_material_sets')
            .select('id, cycle_id, uploaded_by, created_at')
            .eq('course_id', courseId)
        ]);

        setMaterials(materialsData || []);
        setCourseCycles(cyclesData || []);

        // Blackboard imports are stored in bb_files instead of materials. Include
        // them in the community attribution and resource total without duplicating
        // the physical files or inventing a second ownership model.
        const setIds = (blackboardSets || []).map((set: any) => set.id);
        if (setIds.length > 0) {
          const { data: bbFilesData } = await supabase
            .from('bb_files')
            .select('id, set_id, uploaded_by, created_at, relative_path')
            .in('set_id', setIds);

          const setById = new Map((blackboardSets || []).map((set: any) => [set.id, set]));
          const uploaderIds = Array.from(new Set(
            (bbFilesData || [])
              .map((file: any) => file.uploaded_by || setById.get(file.set_id)?.uploaded_by)
              .filter(Boolean)
          ));

          const { data: uploaderProfiles } = uploaderIds.length > 0
            ? await supabase.from('profiles').select('*').in('id', uploaderIds)
            : { data: [] as any[] };
          const profileById = new Map((uploaderProfiles || []).map((profile: any) => [profile.id, profile]));

          setBlackboardContributions((bbFilesData || []).map((file: any) => {
            const set = setById.get(file.set_id);
            const userId = file.uploaded_by || set?.uploaded_by;
            return {
              id: `bb-${file.id}`,
              bb_file_id: file.id,
              bb_set_id: file.set_id,
              cycle_id: set?.cycle_id || null,
              user_id: userId,
              created_at: file.created_at || set?.created_at,
              profiles: userId ? profileById.get(userId) : null,
            };
          }));
        } else {
          setBlackboardContributions([]);
        }

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

          // STRICT Rating Filter: Only include ratings for THIS catalog_course_id
          const courseSpecificRatings = catalogCourseId
            ? (p.professor_ratings || []).filter((r: any) => r.catalog_course_id === catalogCourseId)
            : [];
          
          const hasCourseRatings = courseSpecificRatings.length > 0;
          const avg = hasCourseRatings 
            ? courseSpecificRatings.reduce((sum: number, r: any) => sum + r.puntuacion, 0) / courseSpecificRatings.length 
            : 0;

          professorsMap.set(p.id, {
            ...p,
            catalogCourseId,
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
      initialBlackboardContributions={blackboardContributions}
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
