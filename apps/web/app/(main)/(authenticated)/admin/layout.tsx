'use client';

import { useProfile } from '@/lib/profile-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        router.replace('/auth/login');
        return;
      }
      
      const isAdmin = profile.role === 'admin' || profile.role === 'superadmin';
      if (!isAdmin) {
        console.warn('[ADMIN_ACCESS] Unauthorized access attempt by', profile.email);
        router.replace('/dashboard');
      }
    }
  }, [profile, loading, router]);

  if (loading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-faculty-primary" />
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  
  // Prevent flashing content while redirecting
  if (!isAdmin) return null;

  return <>{children}</>;
}
