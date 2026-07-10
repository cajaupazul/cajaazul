'use client';

import React from 'react';
import GruposContent from '@/components/grupos/GruposContent';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';



export default function GruposPage() {
  const { profile } = useProfile();
  const { grupos, userGrupos, miembrosCuenta, fetchGrupos, fetchUserGrupos } = useDashboardData();

  React.useEffect(() => {
    if (grupos.length === 0) {
      fetchGrupos();
    }
    if (profile?.id && userGrupos.size === 0) {
      fetchUserGrupos(profile.id);
    }
  }, [grupos.length, userGrupos.size, profile?.id, fetchGrupos, fetchUserGrupos]);

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
