'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile-context';
import GrupoDetailContent from '@/components/grupos/GrupoDetailContent';

export const runtime = 'edge';

export default function GrupoDetailPage({ params }: { params: any }) {
  const router = useRouter();
  const { session, profile: currentProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<any>(null);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unwrappedParams, setUnwrappedParams] = useState<any>(null);

  useEffect(() => {
    async function unwrap() {
      const p = await params;
      setUnwrappedParams(p);
    }
    unwrap();
  }, [params]);

  useEffect(() => {
    if (!unwrappedParams?.id || !session?.user) return;

    async function fetchData() {
      try {
        const grupoId = unwrappedParams.id;

        // 1. Fetch group data
        const { data: grupoData, error: grupoError } = await supabase
          .from('grupos')
          .select('*')
          .eq('id', grupoId)
          .single();

        if (grupoError || !grupoData) {
          console.error('Group not found');
          return;
        }
        setGrupo(grupoData);
        setIsAdmin(grupoData.created_by === session?.user?.id || currentProfile?.role === 'admin' || currentProfile?.role === 'superadmin');

        // 2. Fetch members
        const { data: miembrosData } = await supabase
          .from('grupo_miembros')
          .select('user_id, joined_at')
          .eq('grupo_id', grupoId)
          .order('joined_at', { ascending: false });

        if (miembrosData && miembrosData.length > 0) {
          const userIds = miembrosData.map(m => m.user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);

          const fullMiembros = miembrosData.map(m => ({
            ...m,
            profile: profilesData?.find(p => p.id === m.user_id) || null,
          }));

          setMiembros(fullMiembros);
          setIsMember(miembrosData.some(m => m.user_id === session?.user?.id));
        }
      } catch (err) {
        console.error('Error fetching group detail:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [unwrappedParams?.id, session?.user?.id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bb-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!grupo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bb-dark text-bb-text">
        <h1 className="text-2xl font-bold">Grupo no encontrado</h1>
        <button onClick={() => router.back()} className="mt-4 text-blue-400 hover:underline">Volver atrás</button>
      </div>
    );
  }

  return (
    <GrupoDetailContent
      grupo={grupo}
      initialMiembros={miembros}
      initialIsMember={isMember}
      isAdmin={isAdmin}
      profile={currentProfile}
    />
  );
}