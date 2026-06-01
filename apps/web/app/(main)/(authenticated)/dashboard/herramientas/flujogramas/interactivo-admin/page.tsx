'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InteractiveFlowchart from '@/components/flowchart/InteractiveFlowchart';

export default function AdministracionInteractivoPage() {
  return (
    <div className="min-h-screen bg-bb-darker p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/herramientas/flujogramas">
              <Button variant="ghost" size="icon" className="rounded-full bg-bb-sidebar/50 hover:bg-bb-sidebar">
                <ChevronLeft className="w-6 h-6 text-white" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-bb-text tracking-tight flex items-center gap-3">
                Administración <span className="text-emerald-500 text-sm border border-emerald-500 px-2 py-0.5 rounded-full">BETA INTERACTIVO</span>
              </h1>
              <p className="text-bb-text-secondary">Prueba interactiva del nuevo sistema de flujogramas por código.</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3 text-blue-200 text-sm items-start">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <p>
            Haz clic en un curso para marcarlo como <strong>Aprobado</strong> (Amarillo). Si todos los pre-requisitos de un curso están aprobados, automáticamente se desbloqueará (Verde).
          </p>
        </div>

        {/* Engine */}
        <InteractiveFlowchart />
      </div>
    </div>
  );
}
