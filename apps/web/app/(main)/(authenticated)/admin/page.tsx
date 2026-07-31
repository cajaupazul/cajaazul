'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ShoppingBag, 
  Plus, 
  Sparkles, 
  Tag, 
  Settings, 
  Library, 
  Layers, 
  Calculator,
  ArrowRight,
  Package,
  Wrench
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminDashboardPage() {
  const shopModules = [
    {
      title: 'Ver & Editar Productos',
      description: 'Administra el catálogo completo, precios, imágenes y stock de la tienda.',
      href: '/admin/shop',
      icon: Package,
      badge: 'Catálogo',
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400'
    },
    {
      title: 'Agregar Nuevo Producto',
      description: 'Publica un nuevo ítem, marco o accesorio digital para los estudiantes.',
      href: '/admin/shop/new',
      icon: Plus,
      badge: 'Crear',
      color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400'
    },
    {
      title: 'Marco Exclusivo VIP',
      description: 'Configura y asigna marcos especiales para usuarios con estatus VIP.',
      href: '/admin/shop/vip-frame',
      icon: Sparkles,
      badge: 'VIP',
      color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400'
    },
    {
      title: 'Categorías de Tienda',
      description: 'Organiza los productos por categorías y etiquetas de búsqueda.',
      href: '/admin/shop/categories',
      icon: Tag,
      badge: 'Filtros',
      color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400'
    },
    {
      title: 'Configuración de Tienda',
      description: 'Ajusta el diseño, avisos y disposición del layout de la tienda.',
      href: '/admin/store-config',
      icon: Settings,
      badge: 'Layout',
      color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400'
    }
  ];

  const academicModules = [
    {
      title: 'Moderación de Biblioteca',
      description: 'Revisa, aprueba o gestiona los materiales y documentos subidos por alumnos.',
      href: '/admin/library',
      icon: Library,
      badge: 'Recursos',
      color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-400'
    },
    {
      title: 'Flujogramas & Malla Curricular',
      description: 'Diseña y edita los flujogramas interactivos de cursos de la carrera.',
      href: '/admin/flowcharts/new',
      icon: Layers,
      badge: 'Malla',
      color: 'from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-400'
    },
    {
      title: 'Calculadoras Académicas',
      description: 'Gestiona las herramientas de cálculo y simuladores de la plataforma.',
      href: '/admin/calculators',
      icon: Calculator,
      badge: 'Herramientas',
      color: 'from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400'
    }
  ];

  return (
    <div className="min-h-screen bg-bb-dark p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-bb-sidebar via-bb-card to-bb-sidebar p-6 rounded-2xl border border-bb-border shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-blue-400 shadow-inner">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-bb-text tracking-tight flex items-center gap-2">
                Panel de Administración
              </h1>
              <p className="text-sm text-bb-text-secondary mt-0.5">
                Centro de control unificado para gestionar la plataforma, tienda y recursos educativos.
              </p>
            </div>
          </div>
        </div>

        {/* Sección: Administración de Tienda */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-bb-text font-bold text-lg border-b border-bb-border/50 pb-2">
            <ShoppingBag className="w-5 h-5 text-blue-400" />
            <h2>Administración de Tienda</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shopModules.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link key={idx} href={item.href} className="group">
                  <Card className="h-full bg-bb-card border-bb-border hover:border-blue-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5 group-hover:-translate-y-0.5">
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${item.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-bb-darker border border-bb-border text-bb-text-secondary">
                            {item.badge}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-bb-text group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-bb-text-secondary mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform pt-2 border-t border-bb-border/40">
                        <span>Acceder al módulo</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sección: Recursos Académicos & Herramientas */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-bb-text font-bold text-lg border-b border-bb-border/50 pb-2">
            <Wrench className="w-5 h-5 text-indigo-400" />
            <h2>Biblioteca & Contenido Académico</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {academicModules.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link key={idx} href={item.href} className="group">
                  <Card className="h-full bg-bb-card border-bb-border hover:border-indigo-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 group-hover:-translate-y-0.5">
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${item.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-bb-darker border border-bb-border text-bb-text-secondary">
                            {item.badge}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-bb-text group-hover:text-indigo-400 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-bb-text-secondary mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform pt-2 border-t border-bb-border/40">
                        <span>Acceder al módulo</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
