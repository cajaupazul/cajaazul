'use client';

import React, { useEffect, useState } from 'react';



export default function CampusLinkAIPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Dynamically add the Spline viewer script if it's not already on the page
    if (!document.querySelector('script[src="https://unpkg.com/@splinetool/viewer@1.12.97/build/spline-viewer.js"]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://unpkg.com/@splinetool/viewer@1.12.97/build/spline-viewer.js';
      document.body.appendChild(script);
    }
  }, []);

  if (!mounted) return null;

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

      {/* Spline 3D Viewer Environment */}
      <div 
        className="flex-1 w-full h-full relative"
        dangerouslySetInnerHTML={{
          __html: `
            <style>
              spline-viewer::part(logo) {
                display: none !important;
              }
            </style>
            <spline-viewer url="https://prod.spline.design/vCZzyjeuDqJKT0YE/scene.splinecode" class="w-full h-full"></spline-viewer>
          `
        }}
      />

      {/* Decorative gradient at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0b0d] to-transparent pointer-events-none z-10" />
    </div>
  );
}
