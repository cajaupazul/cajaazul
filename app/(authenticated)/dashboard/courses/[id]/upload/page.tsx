import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import FullPageUploadForm from '@/components/courses/full-page-upload-form';

export const revalidate = 0;

export default async function UploadPage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const courseId = params.id;

    // 1. Verificar sesión
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        redirect('/auth/login');
    }

    // 2. Obtener datos del curso
    const { data: course, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

    if (error || !course) {
        notFound();
    }

    // 3. Obtener profesores vinculados al curso
    // Primero obtenemos los IDs de la relación course_professors
    const { data: cpData } = await supabase
        .from('course_professors')
        .select('professor_id')
        .eq('course_id', courseId);

    let allProfessors: any[] = [];

    if (cpData && cpData.length > 0) {
        const profIds = cpData.map(cp => cp.professor_id);

        // Luego obtenemos los detalles completos de esos profesores
        const { data: profs } = await supabase
            .from('professors')
            .select('*')
            .in('id', profIds)
            .order('nombre');

        if (profs) {
            allProfessors = profs;
        }
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <FullPageUploadForm
                courseId={course.id}
                courseName={course.nombre}
                allProfessors={allProfessors}
            />
        </div>
    );
}
