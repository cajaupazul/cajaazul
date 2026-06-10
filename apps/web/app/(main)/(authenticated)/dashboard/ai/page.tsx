'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Importación dinámica para evitar que la librería pesada de Spline se incluya en el Worker del servidor
// Esto soluciona el error "Your Worker exceeded the size limit of 3 MiB" en Cloudflare Pages
const CampusLinkSpline = dynamic(() => import('./CampusLinkSpline'), { 
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
      <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin mb-4" />
      <span className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
        Cargando Motor 3D...
      </span>
    </div>
  )
});

export default function CampusLinkAIPage() {
  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col bg-[#0a0b0d] relative overflow-hidden">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 sm:p-8 z-10 pointer-events-none">
        <h1 className="text-3xl font-black text-white tracking-tighter">
          CAMPUS<span className="text-blue-500">LINK</span> <span className="opacity-50">AI</span>
        </h1>
        <p className="text-white/60 font-medium mt-1">
          Interactúa con nuestro asistente virtual
        </p>
      </div>

      {/* Spline 3D Viewer Environment (Cargado sin SSR para optimizar tamaño) */}
      <CampusLinkSpline />

      {/* Decorative gradient at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0b0d] to-transparent pointer-events-none z-10" />
    </div>
  );
}
