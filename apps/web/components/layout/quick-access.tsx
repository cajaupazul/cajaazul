'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/lib/theme-context';
import { BookOpen, Users, Calendar, MessageSquare } from 'lucide-react';

const quickAccessItems = [
  { label: 'Cursos', icon: BookOpen, href: '/dashboard/courses' },
  { label: 'Profesores', icon: Users, href: '/dashboard/professors' },
  { label: 'Eventos', icon: Calendar, href: '/dashboard/events' },
  { label: 'Comunidad', icon: MessageSquare, href: '/dashboard/community' },
];

export default function QuickAccess({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { colors } = useTheme();

  return (
    <>
      {/* Quick Access Panel - Floats on mobile, static on desktop */}
      <div
        className={`fixed md:static inset-y-0 right-0 z-50 w-80 transition-transform duration-300 overflow-y-auto md:transform-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
        style={{
          backgroundColor: '#242424',
          borderLeft: `1px solid ${colors?.primary}40`,
        }}
      >
        <div className="p-6 mt-20 md:mt-0">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span style={{ color: colors?.primary }}>⚡</span>
            Acceso Rápido
          </h3>

          <div className="space-y-3">
            {quickAccessItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-lg"
                  style={{
                    backgroundColor: '#1a1a1a',
                    borderColor: colors?.primary + '40',
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: colors?.primary }} />
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{item.label}</p>
                    <p className="text-bb-text-secondary text-xs">Accede rápidamente</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Overlay on mobile - Click to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}