'use client';

import React, { useMemo } from 'react';
import DashboardContent from '@/components/dashboard/DashboardContent';
import { useProfile } from '@/lib/profile-context';
import { useDashboardData } from '@/lib/dashboard-data-context';



const motivationalQuotes = [
  "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
  "La educación es el arma más poderosa que puedes usar para cambiar el mundo.",
  "Cree en ti mismo y en todo lo que eres.",
  "La única forma de hacer un gran trabajo es amar lo que haces.",
  "No cuentes los días, haz que los días cuenten.",
  "El futuro pertenece a quienes creen en la belleza de sus sueños."
];

export default function DashboardPage() {
  const { profile } = useProfile();
  const { courses } = useDashboardData();

  const motivational = useMemo(() =>
    motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)],
    []);

  return (
    <DashboardContent
      profile={profile}
      courses={courses.slice(0, 3)}
      materialsCount={0}
      communityCount={0}
      motivational={motivational}
    />
  );
}
