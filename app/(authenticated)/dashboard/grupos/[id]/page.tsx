import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import GrupoDetailContent from '@/components/grupos/GrupoDetailContent';

export const revalidate = 0;

export default async function GrupoDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const grupoId = params.id;

  // 1. Check session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/auth/login');
  }

  // 2. Fetch data in parallel
  const [
    { data: grupoData },
    { data: profile },
    { data: miembrosData }
  ] = await Promise.all([
    supabase.from('grupos').select('*').eq('id', grupoId).single(),
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase.from('grupo_miembros')
      .select('user_id, joined_at')
      .eq('grupo_id', grupoId)
      .order('joined_at', { ascending: false })
  ]);

  if (!grupoData) {
    notFound();
  }

  // 3. Process members and fetch their profiles
  let miembrosConInfo: any[] = [];
  let isMember = false;

  if (miembrosData && miembrosData.length > 0) {
    const userIds = miembrosData.map(m => m.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    miembrosConInfo = miembrosData.map(m => {
      const perfil = profilesData?.find(p => p.id === m.user_id);
      return {
        ...m,
        profile: perfil || null,
      };
    });

    isMember = miembrosData.some(m => m.user_id === session.user.id);
  }

  const isAdmin = grupoData.created_by === session.user.id;

  return (
    <GrupoDetailContent
      grupo={grupoData}
      initialMiembros={miembrosConInfo}
      initialIsMember={isMember}
      isAdmin={isAdmin}
      profile={profile}
    />
  );
}