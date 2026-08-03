'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FlujogramaAdminInteractivo from '@/components/flowchart/FlujogramaAdminInteractivo';

export default function FlujogramaAdminPage() {
  return (
    <div className="min-h-screen bg-bb-dark p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard/herramientas/flujogramas">
          <Button variant="ghost" className="text-bb-text-secondary hover:text-white pl-0">
            <ArrowLeft className="w-5 h-5 mr-2" /> Volver a Flujogramas
          </Button>
        </Link>
      </div>

      <div className="max-w-7xl mx-auto">
        <FlujogramaAdminInteractivo />
      </div>
    </div>
  );
}
