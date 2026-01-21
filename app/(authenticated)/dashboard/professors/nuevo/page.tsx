'use client';

import React from 'react';
import AddProfessorForm from '@/components/professors/AddProfessorForm';
import { useProfile } from '@/lib/profile-context';

export const runtime = 'edge';

export default function NuevoProfessorPage() {
    const { profile } = useProfile();

    return (
        <div className="flex-1 overflow-auto bg-bb-dark">
            <AddProfessorForm profile={profile} />
        </div>
    );
}
