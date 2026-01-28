'use client';

import React, { useMemo } from 'react';
import ProfessorsContent from '@/components/professors/ProfessorsContent';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';



export default function ProfessorsPage() {
  const { profile } = useProfile();
  const { professors } = useDashboardData();

  const formattedProfessors = useMemo(() => {
    const groupedProfessorsMap = new Map();

    professors.forEach((prof: any) => {
      const normalizedName = prof.nombre.trim().toLowerCase();

      if (!groupedProfessorsMap.has(normalizedName)) {
        groupedProfessorsMap.set(normalizedName, {
          ...prof,
          // ratings and averageRating are already calculated in the context, 
          // but we might want to re-consolidate if there are duplicates by name
          ratingsCount: prof.ratingCount || 0,
          totalRating: (prof.averageRating || 0) * (prof.ratingCount || 0),
          courses: new Set(prof.especialidad ? [prof.especialidad] : [])
        });
      } else {
        const existing = groupedProfessorsMap.get(normalizedName);
        existing.ratingsCount += (prof.ratingCount || 0);
        existing.totalRating += (prof.averageRating || 0) * (prof.ratingCount || 0);

        if (prof.especialidad) {
          existing.courses.add(prof.especialidad);
        }
        if (prof.otros_cursos) {
          prof.otros_cursos.split(',').forEach((c: string) => existing.courses.add(c.trim()));
        }
      }
    });

    return Array.from(groupedProfessorsMap.values()).map((prof: any) => {
      const avg = prof.ratingsCount > 0 ? prof.totalRating / prof.ratingsCount : 0;
      return {
        ...prof,
        averageRating: Math.round(avg * 10) / 10,
        ratingCount: prof.ratingsCount,
        courses: Array.from(prof.courses)
      };
    });
  }, [professors]);

  return (
    <ProfessorsContent
      initialProfessors={formattedProfessors}
      initialSavedProfessors={[]} // This would need user_professors fetch if we want it preserved
      profile={profile}
    />
  );
}
