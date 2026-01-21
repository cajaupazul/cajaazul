'use client';

import React from 'react';
import GruposContent from '@/components/grupos/GruposContent';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';

export const runtime = 'edge';

export default function GruposPage() {
  const { profile } = useProfile();
  const { grupos, userGrupos, miembrosCuenta } = useDashboardData();

  const userGruposIds = Array.from(userGrupos);

  return (
    <GruposContent
      initialGrupos={grupos || []}
      userGruposIds={userGruposIds}
      miembrosCounts={miembrosCuenta}
      profile={profile}
    />
  );
}