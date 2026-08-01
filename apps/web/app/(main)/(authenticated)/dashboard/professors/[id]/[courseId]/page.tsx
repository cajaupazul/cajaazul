'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProfessorRatingsContent from '@/components/professors/ProfessorRatingsContent';
import { Loader2 } from 'lucide-react';

interface PageProps {
  params: Promise<{
    id: string;
    courseId: string;
  }>;
}

export default function ProfessorCourseProfilePage({ params }: PageProps) {
  const { id: professorId, courseId: catalogCourseId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [professor, setProfessor] = useState<any>(null);
  const [currentCourse, setCurrentCourse] = useState<any>(null);
  const [coursesTaught, setCoursesTaught] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [relatedProfessors, setRelatedProfessors] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [frameMap, setFrameMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!professorId || !catalogCourseId) return;

    async function fetchData() {
      try {
        setLoading(true);

        // 1. Fetch current logged-in user profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          setProfile(userProfile || null);
        }

        // 2. Fetch Professor details
        const { data: profData, error: profError } = await supabase
          .from('professors')
          .select('*')
          .eq('id', professorId)
          .single();

        if (profError || !profData) {
          console.error('Professor not found:', profError);
          setLoading(false);
          return;
        }
        setProfessor(profData);

        // 3. Fetch Current Catalog Course details
        const { data: courseData } = await supabase
          .from('catalog_courses')
          .select('id, nombre, codigo, facultad, ciclo')
          .eq('id', catalogCourseId)
          .maybeSingle();

        setCurrentCourse(courseData || null);

        // 4. Fetch ALL courses taught by this professor (from course_professors -> catalog_courses)
        const { data: cpData } = await supabase
          .from('course_professors')
          .select(`
            catalog_courses (
              id,
              nombre,
              codigo,
              facultad,
              ciclo
            )
          `)
          .eq('professor_id', professorId);

        const taughtList = (cpData || [])
          .map((item: any) => item.catalog_courses)
          .filter(Boolean);

        setCoursesTaught(taughtList);

        // 5. Fetch ratings for this specific professor + catalog_course_id
        const { data: ratingsData } = await supabase
          .from('professor_ratings')
          .select(`
            *,
            profiles (
              id,
              nombre,
              avatar_url,
              active_frame_key,
              background_url,
              bio,
              created_at,
              puntos,
              es_vip
            )
          `)
          .eq('professor_id', professorId)
          .eq('catalog_course_id', catalogCourseId);

        setRatings(ratingsData || []);

        // 6. Fetch comments for this specific professor + catalog_course_id
        const { data: commentsData } = await supabase
          .from('professor_comments')
          .select(`
            *,
            profiles (
              id,
              nombre,
              avatar_url,
              active_frame_key,
              background_url,
              bio,
              created_at,
              puntos,
              es_vip
            )
          `)
          .eq('professor_id', professorId)
          .eq('catalog_course_id', catalogCourseId)
          .order('created_at', { ascending: false });

        setComments(commentsData || []);

        // 7. Fetch materials for this course/professor if applicable
        const { data: materialsData } = await supabase
          .from('materials')
          .select('*')
          .eq('professor_id', professorId)
          .limit(20);

        setMaterials(materialsData || []);

        // 8. Fetch other professors teaching the SAME catalog_course_id (exclude current professor)
        const { data: relatedData } = await supabase
          .from('course_professors')
          .select('professors(id, nombre, avatar_url, facultad)')
          .eq('catalog_course_id', catalogCourseId)
          .neq('professor_id', professorId);

        const related = (relatedData || [])
          .map((item: any) => item.professors)
          .filter(Boolean);

        setRelatedProfessors(related);

        // 9. Fetch shop frames for user badges
        const { data: frames } = await supabase
          .from('shop_items')
          .select('*')
          .eq('type', 'profile_frame')
          .eq('is_active', true);
        if (frames) {
          const map: Record<string, any> = {};
          frames.forEach((f) => {
            map[f.frame_key] = f;
          });
          setFrameMap(map);
        }

      } catch (err) {
        console.error('Error loading professor course profile:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [professorId, catalogCourseId]);

  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center bg-bb-dark">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-bb-text-secondary animate-pulse">Cargando perfil del profesor...</p>
        </div>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center bg-bb-dark">
        <p className="text-bb-text-secondary">No se encontró el profesor solicitado.</p>
      </div>
    );
  }

  return (
    <ProfessorRatingsContent
      professor={professor}
      initialRatings={ratings}
      initialComments={comments}
      initialMaterials={materials}
      coursesTaught={coursesTaught}
      relatedProfessors={relatedProfessors}
      selectedCourse={currentCourse?.nombre || null}
      selectedCourseId={catalogCourseId}
      profile={profile}
      frameMap={frameMap}
    />
  );
}
