import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import GruposContent from '@/components/grupos/GruposContent';

export const revalidate = 0;

export default async function GruposPage() {
  const supabase = createClient();

  // 1. Check session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/auth/login');
  }

  // 2. Fetch data in parallel
  const [
    { data: profile },
    { data: grupos },
    { data: userGruposData },
    { data: miembrosData }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase.from('grupos').select('*').order('created_at', { ascending: false }),
    supabase.from('grupo_miembros').select('grupo_id').eq('user_id', session.user.id),
    supabase.from('grupo_miembros').select('grupo_id')
  ]);

  // 3. Process data
  const userGruposIds = (userGruposData || []).map(ug => ug.grupo_id);
  const miembrosCounts: Record<string, number> = {};
  (miembrosData || []).forEach(m => {
    miembrosCounts[m.grupo_id] = (miembrosCounts[m.grupo_id] || 0) + 1;
  });

  return (
    <GruposContent
      initialGrupos={grupos || []}
      userGruposIds={userGruposIds}
      miembrosCounts={miembrosCounts}
      profile={profile}
    />
  );
}