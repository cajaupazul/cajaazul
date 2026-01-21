'use client';

import React from 'react';
import CoursesContent from '@/components/courses/CoursesContent';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';

export const runtime = 'edge';

export default function CoursesPage() {
  const { profile } = useProfile();
  const { courses } = useDashboardData();

  return (
    <CoursesContent
      initialCourses={courses || []}
      profile={profile}
    />
  );
}