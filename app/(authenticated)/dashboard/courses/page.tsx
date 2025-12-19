import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import CoursesContent from '@/components/courses/CoursesContent';

export const revalidate = 0;

export default async function CoursesPage() {
  const supabase = createClient();

  // 1. Check session
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/login');
  }

  // 2. Fetch data
  const [
    { data: profile },
    { data: courses }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).single(),
    supabase.from('courses').select('*').order('nombre', { ascending: true })
  ]);

  return (
    <CoursesContent
      initialCourses={courses || []}
      profile={profile}
    />
  );
}