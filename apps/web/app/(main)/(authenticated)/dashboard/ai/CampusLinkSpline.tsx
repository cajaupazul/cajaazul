'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Application } from '@splinetool/runtime';

export default function CampusLinkSpline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let app: Application | null = null;

    if (canvasRef.current) {
      app = new Application(canvasRef.current);
      
      app.load('https://prod.spline.design/vCZzyjeuDqJKT0YE/scene.splinecode')
        .then(() => {
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Error cargando la escena de Spline:", err);
          setIsLoading(false);
        });
    }

    return () => {
      if (app) {
        app.dispose();
      }
    };
  }, []);

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <div className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin mb-4" />
          <span className="text-white/50 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
            Iniciando Robot...
          </span>
        </div>
      )}
      <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
        <canvas 
          ref={canvasRef} 
          id="canvas3d" 
          className="w-full h-full block outline-none"
        />
      </div>
    </>
  );
}
