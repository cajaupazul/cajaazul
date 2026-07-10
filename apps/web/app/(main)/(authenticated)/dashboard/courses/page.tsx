'use client';

import React from 'react';
import CoursesContent from '@/components/courses/CoursesContent';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';



export default function CoursesPage() {
  const { profile } = useProfile();
  const { courses, fetchCourses } = useDashboardData();

  React.useEffect(() => {
    if (courses.length === 0) {
      fetchCourses();
    }
  }, [courses.length, fetchCourses]);

  return (
    <CoursesContent
      initialCourses={courses || []}
      profile={profile}
    />
  );
}
