import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import DashboardContent from '@/components/dashboard/DashboardContent';

export const revalidate = 0;

const motivationalQuotes = [
  "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
  "La educación es el arma más poderosa que puedes usar para cambiar el mundo.",
  "Cree en ti mismo y en todo lo que eres.",
  "La única forma de hacer un gran trabajo es amar lo que haces.",
  "No cuentes los días, haz que los días cuenten.",
  "El futuro pertenece a quienes creen en la belleza de sus sueños."
];

export default async function DashboardPage() {
  const supabase = createClient();

  // 1. Check session
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/login');
  }

  // 2. Fetch data in parallel
  const [
    { data: profile },
    { data: courses },
    { count: materialsCount },
    { count: communityCount }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase.from('courses').select('*').limit(3).order('nombre', { ascending: true }),
    supabase.from('materials').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true })
  ]);

  const motivational = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];

  return (
    <DashboardContent
      profile={profile}
      courses={courses || []}
      materialsCount={materialsCount || 0}
      communityCount={communityCount || 0}
      motivational={motivational}
    />
  );
}