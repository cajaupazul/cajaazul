'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProfessorRatingsContent from '@/components/professors/ProfessorRatingsContent';

export const runtime = 'edge';

export default function ProfessorRatingsPage({ params }: { params: any }) {
  const router = useRouter();
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
        const professorId = unwrappedParams.id;

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
        const specialty = currentProf.especialidad;
        const orQuery = specialty
          ? `especialidad.eq."${specialty}",otros_cursos.ilike.%${specialty}%`
          : null;

        const [
          { data: allProfRecords },
          { data: ratingsData },
          relatedProfessorsRes,
          { data: materialsData },
          { data: coursesTaughtData },
          { data: commentsData },
          { data: userProfile },
          { data: framesData }
        ] = await Promise.all([
          supabase.from('professors')
            .select('id, especialidad, otros_cursos')
            .ilike('nombre', currentProf.nombre),
          supabase.from('professor_ratings')
            .select('*, profiles(nombre, avatar_url, background_url, active_frame_key)')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false }),
          orQuery
            ? supabase.from('professors')
              .select('id, nombre, especialidad, facultad')
              .or(orQuery)
              .neq('id', professorId)
              .limit(20)
            : Promise.resolve({ data: [] as any[], error: null }),
          supabase.from('materials')
            .select('*, courses(id, nombre)')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false }),
          supabase.from('course_professors')
            .select('courses(id, nombre)')
            .eq('professor_id', professorId),
          supabase.from('professor_comments')
            .select('*, profiles(nombre, avatar_url, background_url, active_frame_key)')
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

        // Process data
        setRatings(ratingsData || []);
        setMaterials(materialsData || []);
        setComments(commentsData || []);
        setProfile(userProfile);
        setCoursesTaught(coursesTaughtData?.map((ct: any) => ct.courses).filter(Boolean) || []);

        // Related professors
        const relatedMap = new Map();
        (relatedProfessorsRes?.data || []).forEach((p: any) => {
          const normalizedName = p.nombre.trim().toLowerCase();
          if (normalizedName !== currentProf.nombre.trim().toLowerCase() && !relatedMap.has(normalizedName)) {
            relatedMap.set(normalizedName, p);
          }
        });
        setRelatedProfessors(Array.from(relatedMap.values()).slice(0, 10));

        // Frame map
        const fMap: Record<string, any> = {};
        framesData?.forEach(f => {
          if (f.frame_key) fMap[f.frame_key] = f;
        });
        setFrameMap(fMap);

        // Course & Professor link mapping
        const uniqueCoursesMap = new Map<string, string>();
        const profLinkMapping: Record<string, string> = {};

        const processCourseName = (name: string) => {
          const trimmed = name.trim();
          if (trimmed) uniqueCoursesMap.set(trimmed.toLowerCase(), trimmed);
        };

        if (allProfRecords) {
          allProfRecords.forEach((rec: any) => {
            if (rec.especialidad) {
              const especialidadLower = rec.especialidad.trim().toLowerCase();
              profLinkMapping[especialidadLower] = rec.id;
              processCourseName(rec.especialidad);
            }
            if (rec.otros_cursos) {
              rec.otros_cursos.split(',').forEach((c: string) => processCourseName(c));
            }
          });
        }
        setProfessorLinkMapping(profLinkMapping);

        const allUniqueCourseOriginalNames = Array.from(uniqueCoursesMap.values());
        const { data: matchedCourses } = await supabase
          .from('courses')
          .select('id, nombre')
          .in('nombre', allUniqueCourseOriginalNames);

        const cMapping: Record<string, string> = {};
        matchedCourses?.forEach(c => {
          cMapping[c.nombre.toLowerCase()] = c.id;
        });
        setCourseMapping(cMapping);

        const currentSpecialtyLower = currentProf.especialidad?.trim().toLowerCase();
        setAggregatedOtherCourses(allUniqueCourseOriginalNames.filter(name =>
          name.toLowerCase() !== currentSpecialtyLower
        ));

      } catch (err) {
        console.error('Error fetching professor detail:', err);
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
      profile={profile}
      frameMap={frameMap}
    />
  );
}
