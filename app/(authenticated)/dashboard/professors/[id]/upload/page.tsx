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
                    .select('nombre')
                    .eq('id', professorId)
                    .single();

                if (profError || !profData) {
                    console.error('Professor not found');
                    return;
                }
                setProfessor(profData);

                // 2. Fetch courses taught by the professor
                const { data: cpData } = await supabase
                    .from('course_professors')
                    .select('courses(id, nombre)')
                    .eq('professor_id', professorId);

                const courses = cpData?.map((item: any) => ({
                    id: item.courses.id,
                    nombre: item.courses.nombre
                })) || [];

                setCoursesTaught(courses);

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
