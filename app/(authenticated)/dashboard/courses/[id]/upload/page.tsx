'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import FullPageUploadForm from '@/components/courses/full-page-upload-form';

export const runtime = 'edge';

export default function UploadPage({ params }: { params: any }) {
    const router = useRouter();
    const [course, setCourse] = useState<any>(null);
    const [professors, setProfessors] = useState<any[]>([]);
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

                // 1. Fetch course details
                const { data: courseData, error: courseError } = await supabase
                    .from('courses')
                    .select('*')
                    .eq('id', courseId)
                    .single();

                if (courseError || !courseData) {
                    console.error('Course not found');
                    return;
                }
                setCourse(courseData);

                // 2. Fetch professors
                const courseNameClean = courseData.nombre.trim();

                const [
                    { data: cpData },
                    { data: matchedProfs }
                ] = await Promise.all([
                    supabase.from('course_professors').select('professor_id').eq('course_id', courseId),
                    supabase.from('professors')
                        .select('*')
                        .or(`especialidad.ilike.%${courseNameClean}%,otros_cursos.ilike.%${courseNameClean}%`)
                ]);

                const linkedProfIds = cpData?.map(cp => cp.professor_id) || [];
                const professorsMap = new Map();

                if (linkedProfIds.length > 0) {
                    const { data: linkedProfs } = await supabase
                        .from('professors')
                        .select('*')
                        .in('id', linkedProfIds);
                    linkedProfs?.forEach(p => professorsMap.set(p.id, p));
                }

                matchedProfs?.forEach(p => professorsMap.set(p.id, p));

                const initialProfessors = Array.from(professorsMap.values());
                const uniqueProfessorsByName = new Map();

                initialProfessors.forEach((p: any) => {
                    const normalizedName = p.nombre.toLowerCase().trim();
                    const existing = uniqueProfessorsByName.get(normalizedName);
                    const isExactMatch = p.especialidad?.toLowerCase().trim() === courseNameClean.toLowerCase();

                    if (!existing || (isExactMatch && !(existing.especialidad?.toLowerCase().trim() === courseNameClean.toLowerCase()))) {
                        uniqueProfessorsByName.set(normalizedName, p);
                    }
                });

                setProfessors(Array.from(uniqueProfessorsByName.values()));

            } catch (err) {
                console.error('Error fetching upload data:', err);
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
                <button onClick={() => router.back()} className="mt-4 text-blue-400 hover:underline">Volver atrás</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bb-dark">
            <FullPageUploadForm
                courseId={course.id}
                courseName={course.nombre}
                allProfessors={professors}
            />
        </div>
    );
}
