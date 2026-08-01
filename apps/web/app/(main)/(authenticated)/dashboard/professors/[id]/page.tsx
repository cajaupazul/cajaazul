'use client';

import React, { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProfessorFallbackRedirectPage({ params }: PageProps) {
  const { id: professorId } = use(params);
  const router = useRouter();

  useEffect(() => {
    if (!professorId) return;

    async function redirectFirstCourse() {
      // Query first catalog course for this professor
      const { data } = await supabase
        .from('course_professors')
        .select('catalog_course_id')
        .eq('professor_id', professorId)
        .limit(1);

      if (data && data.length > 0 && data[0].catalog_course_id) {
        router.replace(`/dashboard/professors/${professorId}/${data[0].catalog_course_id}`);
      } else {
        // Fallback to query param view page if no course is linked yet
        router.replace(`/dashboard/professors/view?id=${professorId}`);
      }
    }

    redirectFirstCourse();
  }, [professorId, router]);

  return (
    <div className="flex h-[80vh] w-full items-center justify-center bg-bb-dark">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <p className="text-sm text-bb-text-secondary animate-pulse">Redirigiendo al perfil del profesor...</p>
      </div>
    </div>
  );
}
