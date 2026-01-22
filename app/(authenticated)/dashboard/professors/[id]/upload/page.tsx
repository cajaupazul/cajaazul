'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import FullPageProfessorUploadForm from '@/components/professors/FullPageProfessorUploadForm';

export const runtime = 'edge';

export default function ProfessorUploadPage({ params }: { params: any }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedCourseId = searchParams.get('courseId');
    const [loading, setLoading] = useState(true);
    const [professor, setProfessor] = useState<any>(null);
    const [coursesTaught, setCoursesTaught] = useState<any[]>([]);
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
                const { data: profData, error: profError } = await supabase
                    .from('professors')
                    .select('nombre, especialidad, otros_cursos')
                    .eq('id', professorId)
                    .single();

                if (profError || !profData) {
                    console.error('Professor not found');
                    return;
                }
                setProfessor(profData);

                // 2. Fetch courses taught by the professor (strict and fuzzy)
                const { data: cpData } = await supabase
                    .from('course_professors')
                    .select('courses(id, nombre)')
                    .eq('professor_id', professorId);

                const coursesMap = new Map();

                // Add strict links
                cpData?.forEach((item: any) => {
                    if (item.courses) {
                        const courseArr = Array.isArray(item.courses) ? item.courses : [item.courses];
                        courseArr.forEach((c: any) => {
                            if (c) coursesMap.set(c.id, c);
                        });
                    }
                });

                // Fuzzy matches based on specialty and other courses
                const searchTerms = new Set<string>();
                if (profData.especialidad) searchTerms.add(profData.especialidad.trim());
                if (profData.otros_cursos) {
                    profData.otros_cursos.split(',').forEach((c: string) => {
                        const trimmed = c.trim();
                        if (trimmed) searchTerms.add(trimmed);
                    });
                }

                if (searchTerms.size > 0) {
                    const fuzzyTerms = Array.from(searchTerms);
                    for (const term of fuzzyTerms) {
                        const { data: fuzzyResult } = await supabase
                            .from('courses')
                            .select('id, nombre')
                            .ilike('nombre', `%${term}%`);

                        fuzzyResult?.forEach((c: any) => {
                            coursesMap.set(c.id, c);
                        });
                    }
                }

                setCoursesTaught(Array.from(coursesMap.values()));

            } catch (err) {
                console.error('Error fetching professor upload data:', err);
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
        <div className="flex-1 overflow-auto bg-bb-dark">
            <FullPageProfessorUploadForm
                professorId={unwrappedParams.id}
                professorName={professor.nombre}
                coursesTaught={coursesTaught}
                preselectedCourseId={preselectedCourseId}
            />
        </div>
    );
}
