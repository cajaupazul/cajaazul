'use client';
import React from 'react';
import { useTheme } from '@/lib/theme-context';

export default function Header() {
  const { colors } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-bb-card border-b border-bb-border">
      {/* Barra superior de color de facultad */}
      <div 
        className="h-1"
        style={{ backgroundColor: colors?.primary }}
      />
      
      {/* Contenido header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-semibold">Bienvenido a CampusLink</h2>
          <p className="text-bb-text-secondary text-sm">Gestiona tu experiencia académica</p>
        </div>
        
        {/* Notificación y accesos rápidos */}
        <div className="flex items-center gap-4">
          <button className="relative p-2 hover:bg-bb-hover rounded-lg transition-colors duration-200">
            <span className="text-xl">🔔</span>
            <div 
              className="absolute top-0 right-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: colors?.primary }}
            />
          </button>
        </div>
      </div>
    </header>
  );
}