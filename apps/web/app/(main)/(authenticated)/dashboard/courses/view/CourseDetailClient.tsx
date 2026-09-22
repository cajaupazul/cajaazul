'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/lib/supabase';
import CourseDetailContent from '@/components/courses/CourseDetailContent';

interface CourseDetailClientProps {
  initialCourseId?: string;
  initialCourse?: Course | null;
}

const MATERIAL_SELECT = `
  id, course_id, user_id, professor_id, titulo, descripcion, url_archivo, tipo,
  descargas, thumbnail_url, use_advanced_viewer, created_at, cycle_id, group_title,
  storage_path,
  professors(nombre),
  profiles(id, nombre, avatar_url, background_url, active_frame_key, role, es_vip,
    created_at, bio, link_instagram, puntos)
`;

const UPLOADER_PROFILE_SELECT = `
  id, nombre, avatar_url, background_url, active_frame_key, role, es_vip,
  created_at, bio, link_instagram, puntos
`;

export default function CourseDetailClient({ initialCourseId, initialCourse = null }: CourseDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = initialCourseId || searchParams.get('id');
  const [course, setCourse] = useState<Course | null>(initialCourse);
  const [materials, setMaterials] = useState<any[]>([]);
  const [blackboardContributions, setBlackboardContributions] = useState<any[]>([]);
  const [allProfessors, setAllProfessors] = useState<any[]>([]);
  const [topProfessor, setTopProfessor] = useState<any>(null);
  const [loading, setLoading] = useState(!initialCourse);
  const [courseCycles, setCourseCycles] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!courseId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        let courseData = initialCourse?.id === courseId ? initialCourse : null;

        if (!courseData) {
          const { data, error: courseError } = await supabase
            .from('courses')
            .select('id, nombre, codigo, facultad, carrera, ciclo, descripcion, imagen_url, syllabus_url, views, created_at, catalog_course_id')
            .eq('id', courseId)
            .maybeSingle();

          if (courseError || !data) {
            console.error('Course not found');
            if (!cancelled) setLoading(false);
            return;
          }
          courseData = data as Course;
        }

        if (cancelled) return;
        setCourse(courseData);

        // 2. Parallel fetch for associated data
        const catalogCourseId = courseData.catalog_course_id;

        const [
          { data: materialsData },
          { data: linkedData },
          { data: cyclesData },
          { data: blackboardSets }
        ] = await Promise.all([
          supabase.from('materials')
            .select(MATERIAL_SELECT)
            .eq('course_id', courseId)
            .order('created_at', { ascending: false }),
          catalogCourseId
            ? supabase.from('course_professors')
                .select(`
                  professor_id,
                  professors (
                    id, nombre, avatar_url,
                    professor_ratings (puntuacion, catalog_course_id)
                  )
                `)
                .eq('catalog_course_id', catalogCourseId)
            : Promise.resolve({ data: [] }),
          supabase.from('course_cycles')
            .select('id, course_id, ciclo_name, active_subfolders, created_at')
            .eq('course_id', courseId)
            .order('ciclo_name', { ascending: false }),
          supabase.from('bb_material_sets')
            .select('id, cycle_id, uploaded_by, created_at, professor_id, course_name, ciclo, professors(nombre)')
            .eq('course_id', courseId)
        ]);

        if (cancelled) return;
        setMaterials(materialsData || []);
        setCourseCycles(cyclesData || []);

        // 4. Unified Professor Merging
        const professorsMap = new Map();

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

        // Blackboard can contain dozens of files and uploader profiles. It is
        // useful in the unified list, but it must not block the first course paint.
        setLoading(false);

        const setIds = (blackboardSets || []).map((set: any) => set.id);
        if (setIds.length === 0) {
          setBlackboardContributions([]);
          return;
        }

        const { data: bbFilesData } = await supabase
          .from('bb_files')
          .select('id, set_id, folder_id, name, storage_path, size_bytes, mime_type, uploaded_by, created_at, relative_path, material_category')
          .in('set_id', setIds);

        if (cancelled) return;
        const setById = new Map((blackboardSets || []).map((set: any) => [set.id, set]));
        const uploaderIds = Array.from(new Set<string>(
          (bbFilesData || [])
            .map((file: any) => file.uploaded_by || (setById.get(file.set_id) as any)?.uploaded_by)
            .filter((id): id is string => Boolean(id))
        ));

        const { data: uploaderProfiles } = uploaderIds.length > 0
          ? await supabase.from('profiles').select(UPLOADER_PROFILE_SELECT).in('id', uploaderIds)
          : { data: [] as any[] };
        if (cancelled) return;

        const profileById = new Map((uploaderProfiles || []).map((profile: any) => [profile.id, profile]));
        setBlackboardContributions((bbFilesData || []).map((file: any) => {
          const set = setById.get(file.set_id) as any;
          const userId = file.uploaded_by || set?.uploaded_by;
          return {
            id: `bb-${file.id}`,
            bb_file_id: file.id,
            bb_set_id: file.set_id,
            source: 'blackboard',
            titulo: file.name,
            name: file.name,
            url_archivo: file.storage_path,
            storage_path: file.storage_path,
            size_bytes: file.size_bytes,
            mime_type: file.mime_type,
            relative_path: file.relative_path,
            material_category: file.material_category,
            cycle_id: set?.cycle_id || null,
            professor_id: set?.professor_id || null,
            professors: set?.professors || null,
            user_id: userId,
            created_at: file.created_at || set?.created_at,
            profiles: userId ? profileById.get(userId) : null,
          };
        }));

      } catch (err) {
        if (!cancelled) console.error('Error fetching course detail:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [courseId, initialCourse]);

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
      initialCourseCycles={courseCycles}
    />
  );
}
