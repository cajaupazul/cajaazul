'use client';

import React from 'react';
import { Wrench } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

export default function HerramientasPage() {
    const { colors } = useTheme();

    return (
        <div className="p-6 sm:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-bb-text">Herramientas</h1>
                <p className="text-bb-text-secondary mt-1">Recursos y herramientas útiles para tu vida universitaria</p>
            </div>

            {/* Placeholder - Content coming soon */}
            <div
                className="flex flex-col items-center justify-center py-20 rounded-2xl border border-bb-border bg-bb-card/50"
            >
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: colors?.primary + '20' }}
                >
                    <Wrench className="w-8 h-8" style={{ color: colors?.primary }} />
                </div>
                <h2 className="text-lg font-semibold text-bb-text mb-2">Próximamente</h2>
                <p className="text-bb-text-secondary text-sm text-center max-w-md">
                    Esta sección estará disponible pronto con herramientas útiles para ti.
                </p>
            </div>
        </div>
    );
}
