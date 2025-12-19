import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import AddProfessorForm from '@/components/professors/AddProfessorForm';

export const metadata = {
    title: 'Agregar Profesor | CampusLink',
    description: 'Agrega un nuevo profesor a la plataforma.',
};

export default async function NuevoProfessorPage() {
    const supabase = createClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        redirect('/auth/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    return (
        <div className="flex-1 overflow-auto bg-bb-dark">
            <AddProfessorForm profile={profile} />
        </div>
    );
}
