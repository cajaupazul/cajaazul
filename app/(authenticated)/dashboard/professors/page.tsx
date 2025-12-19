import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import ProfessorsContent from '@/components/professors/ProfessorsContent';

export const revalidate = 0;

export default async function ProfessorsPage() {
  const supabase = createClient();

  // 1. Check session
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/login');
  }

  // 2. Fetch professors with ratings in parallel
  const [
    { data: profile },
    { data: professorsData },
    { data: savedProfsData }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase.from('professors').select('*, professor_ratings(puntuacion)').order('nombre', { ascending: true }),
    supabase.from('user_professors').select('professor_id').eq('user_id', session.user.id)
  ]);

  // 3. Format professors with average rating
  const formattedProfessors = (professorsData || []).map((prof: any) => {
    const ratings = prof.professor_ratings || [];
    const averageRating = ratings.length > 0
      ? (ratings.reduce((sum: number, r: any) => sum + (r.puntuacion || 0), 0) / ratings.length)
      : 0;

    return {
      ...prof,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingCount: ratings.length,
    };
  });

  const savedIds = (savedProfsData || []).map(p => p.professor_id);

  return (
    <ProfessorsContent
      initialProfessors={formattedProfessors}
      initialSavedProfessors={savedIds}
      profile={profile}
    />
  );
}