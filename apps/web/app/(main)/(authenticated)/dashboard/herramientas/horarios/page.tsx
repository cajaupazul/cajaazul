'use client';

import React from 'react';
import ScheduleBuilder from '@/components/herramientas/ScheduleBuilder';

export default function HorariosPage() {
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-bb-text">Armador de Horarios</h1>
                <p className="text-bb-text-secondary mt-1 text-sm">Selecciona tus cursos y arma tu horario ideal</p>
            </div>
            <ScheduleBuilder />
        </div>
    );
}
