'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Application } from '@splinetool/runtime';

export default function CampusLinkAIPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let app: Application | null = null;

    if (canvasRef.current) {
      // Inicializar el runtime de Spline en el canvas
      app = new Application(canvasRef.current);
      
      // Cargar la escena
      app.load('https://prod.spline.design/vCZzyjeuDqJKT0YE/scene.splinecode')
        .then(() => {
          setIsLoading(false);
          // Aquí podríamos hacer modificaciones por código al robot si fuera necesario,
          // por ejemplo, cambiar cámaras o acceder a variables.
        })
        .catch((err) => {
          console.error("Error cargando la escena de Spline:", err);
          setIsLoading(false);
        });
    }

    return () => {
      // Limpiar al desmontar el componente para evitar fugas de memoria
      if (app) {
        app.dispose();
      }
    };
  }, []);

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

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin mb-4" />
          <span className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
            Iniciando Robot...
          </span>
        </div>
      )}

      {/* Spline 3D Viewer Environment (Usando Runtime para evitar la marca de agua) */}
      <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
        <canvas 
          ref={canvasRef} 
          id="canvas3d" 
          className="w-full h-full block outline-none"
        />
      </div>

      {/* Decorative gradient at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0b0d] to-transparent pointer-events-none z-10" />
    </div>
  );
}
