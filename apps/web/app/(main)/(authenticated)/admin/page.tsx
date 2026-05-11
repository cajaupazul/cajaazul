'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the default admin view (Library Management)
    router.replace('/admin/library');
  }, [router]);

  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-faculty-primary" />
        <p className="text-bb-text-secondary text-sm animate-pulse">Cargando panel administrativo...</p>
      </div>
    </div>
  );
}
