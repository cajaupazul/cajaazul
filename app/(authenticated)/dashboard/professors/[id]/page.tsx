import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import ProfessorRatingsContent from '@/components/professors/ProfessorRatingsContent';

export const revalidate = 0;

export default async function ProfessorRatingsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const professorId = params.id;

  // 1. Check session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/auth/login');
  }

  // 2. Fetch professor and ratings
  const [
    { data: profData },
    { data: ratingsData }
  ] = await Promise.all([
    supabase.from('professors').select('*').eq('id', professorId).single(),
    supabase.from('professor_ratings')
      .select('*, profiles(nombre, avatar_url, background_url, bio, carrera, link_instagram)')
      .eq('professor_id', professorId)
      .order('created_at', { ascending: false })
  ]);

  if (!profData) {
    notFound();
  }

  return (
    <ProfessorRatingsContent
      professor={profData}
      initialRatings={ratingsData || []}
    />
  );
}