import { Suspense } from 'react';
import { AuthExperience } from '@/components/auth/AuthExperience';

export default function AuthEntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-[#f6f3eb]" />}>
      <AuthExperience />
      {children}
    </Suspense>
  );
}
