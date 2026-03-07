'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import FullPageUploadForm from '@/components/courses/full-page-upload-form';

function UploadWrapper() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');
    const [course, setCourse] = useState<any>(null);
    const [professors, setProfessors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!courseId) {
            setLoading(false);
            return;
        }

        async function fetchData() {
            try {
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

                const normalizeStr = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
                const targetNorm = normalizeStr(courseNameClean);

                const getMatchedCourse = (professorCoursesStr: string | null) => {
                    if (!professorCoursesStr) return null;
                    // Split by common separators: comma, semicolon, pipe, bullet, newline
                    const segments = professorCoursesStr.split(/[,;|•\n]/).map(s => s.trim()).filter(Boolean);

                    // Return the FIRST segment that matches exactly after normalization
                    return segments.find(segment => normalizeStr(segment) === targetNorm) || null;
                };

                initialProfessors.forEach((p: any) => {
                    const matchedSpecialty = getMatchedCourse(p.especialidad);
                    const matchedOthers = getMatchedCourse(p.otros_cursos);
                    const isExplicitlyLinked = linkedProfIds.includes(p.id);

                    if (!isExplicitlyLinked && !matchedSpecialty && !matchedOthers) {
                        return; // Skip if no clear match exists
                    }

                    // Attach which course matched for UI purposes
                    const displayMatch = matchedSpecialty || matchedOthers || courseNameClean;
                    const professorWithMatch = { ...p, matchedCourse: displayMatch };

                    const normalizedName = p.nombre.toLowerCase().trim();
                    const existing = uniqueProfessorsByName.get(normalizedName);

                    // Priority: Explicitly linked > Specialty match > Other match
                    if (!existing || isExplicitlyLinked || (matchedSpecialty && !getMatchedCourse(existing.especialidad))) {
                        uniqueProfessorsByName.set(normalizedName, professorWithMatch);
                    }
                });

                const finalProfessors = Array.from(uniqueProfessorsByName.values());
                setProfessors(finalProfessors);

            } catch (err) {
                console.error('Error fetching upload data:', err);
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

export default function UploadPage() {
    return (
        <Suspense fallback={
            <div className="flex-1 flex items-center justify-center bg-bb-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        }>
            <UploadWrapper />
        </Suspense>
    );
}
