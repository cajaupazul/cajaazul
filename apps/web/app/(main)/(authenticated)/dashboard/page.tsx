'use client';

import DashboardContent from '@/components/dashboard/DashboardContent';
import { useProfile } from '@/lib/profile-context';



export default function DashboardPage() {
  const { profile } = useProfile();

  return (
    <DashboardContent
      profile={profile}
    />
  );
}
