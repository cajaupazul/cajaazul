'use client';

import React, { useMemo } from 'react';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';



export default function DashboardPage() {
  const { profile } = useProfile();
  const { courses } = useDashboardData();

  return (
    <DashboardContent
      profile={profile}
      courses={courses.slice(0, 3)}
    />
  );
}
