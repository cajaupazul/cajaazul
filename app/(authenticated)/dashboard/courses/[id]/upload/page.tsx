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
    // Estrategia híbrida:
    // A. Buscar por relación estricta en course_professors
    const { data: cpData } = await supabase
        .from('course_professors')
        .select('professor_id')
        .eq('course_id', courseId);

    const linkedProfIds = cpData?.map(cp => cp.professor_id) || [];

    // B. Buscar por coincidencia de nombre (especialidad u otros_cursos)
    // Normalizamos el nombre del curso para mejorar la búsqueda
    const courseNameClean = course.nombre.trim();

    const { data: matchedProfs } = await supabase
        .from('professors')
        .select('*')
        .or(`especialidad.ilike.%${courseNameClean}%,otros_cursos.ilike.%${courseNameClean}%`);

    // Combinar resultados sin duplicados
    const professorsMap = new Map();

    // Agregar los de relación estricta (si existen, los traemos por ID)
    if (linkedProfIds.length > 0) {
        const { data: linkedProfs } = await supabase
            .from('professors')
            .select('*')
            .in('id', linkedProfIds);

        linkedProfs?.forEach(p => professorsMap.set(p.id, p));
    }

    // Agregar los encontrados por texto
    matchedProfs?.forEach(p => professorsMap.set(p.id, p));

    let initialProfessors = Array.from(professorsMap.values());

    // Filter duplicates by name, prioritizing the one with exact specialty match
    const uniqueProfessorsByName = new Map();

    initialProfessors.forEach((p: any) => {
        const normalizedName = p.nombre.toLowerCase().trim();
        const existing = uniqueProfessorsByName.get(normalizedName);

        const isExactMatch = p.especialidad?.toLowerCase().trim() === courseNameClean.toLowerCase();

        if (!existing) {
            uniqueProfessorsByName.set(normalizedName, p);
        } else {
            // Replace if current has exact specialty match and existing doesn't
            const existingIsExact = existing.especialidad?.toLowerCase().trim() === courseNameClean.toLowerCase();
            if (isExactMatch && !existingIsExact) {
                uniqueProfessorsByName.set(normalizedName, p);
            }
        }
    });

    const allProfessors = Array.from(uniqueProfessorsByName.values());


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
