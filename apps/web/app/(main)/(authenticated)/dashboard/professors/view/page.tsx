'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Legacy redirect page: /dashboard/professors/view?id=X&courseId=Y
 * Redirects to the new dynamic route: /dashboard/professors/[id]/[courseId]
 */
function ProfessorViewRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const professorId = searchParams.get('id');
  const contextCourseId = searchParams.get('courseId');

  useEffect(() => {
    if (professorId && contextCourseId) {
      router.replace(`/dashboard/professors/${professorId}/${contextCourseId}`);
    } else if (professorId) {
      router.replace(`/dashboard/professors/${professorId}`);
    } else {
      router.replace('/dashboard/professors');
    }
  }, [professorId, contextCourseId, router]);

  return (
    <div className="flex-1 flex items-center justify-center bg-bb-dark">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );
}

export default function ProfessorRatingsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-bb-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    }>
      <ProfessorViewRedirect />
    </Suspense>
  );
}
