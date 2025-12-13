'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Star, Calendar, Users, TrendingUp, Award } from 'lucide-react';
import BouncingBalls from '@/components/BouncingBalls';

export default function HomePage() {
  return (
    <div className="relative w-full">
      <BouncingBalls />
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white relative z-20 pointer-events-auto">
        <nav className="border-b bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
                  CampusLink
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <Link href="/auth/login">
                  <Button variant="ghost">Iniciar Sesión</Button>
                </Link>
                <Link href="/auth/register">
                  <Button className="bg-gradient-to-r from-blue-600 to-teal-500">
                    Registrarse
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Tu espacio académico y social
              <span className="block bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent">
                universitario
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Encuentra materiales, califica profesores, descubre eventos y conecta con tu comunidad estudiantil.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/auth/register">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-teal-500">
                  Comenzar Gratis
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline">
                  Explorar
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Todo lo que necesitas en un solo lugar
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <BookOpen className="h-12 w-12 text-blue-600 mb-4" />
                  <CardTitle>Materiales Académicos</CardTitle>
                  <CardDescription>
                    Accede a apuntes, exámenes resueltos y recursos compartidos por tu comunidad.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Star className="h-12 w-12 text-yellow-600 mb-4" />
                  <CardTitle>Califica Profesores</CardTitle>
                  <CardDescription>
                    Comparte tu experiencia y ayuda a otros estudiantes a elegir sus cursos.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Calendar className="h-12 w-12 text-teal-600 mb-4" />
                  <CardTitle>Eventos Universitarios</CardTitle>
                  <CardDescription>
                    Descubre conferencias, talleres y actividades extracurriculares.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Users className="h-12 w-12 text-emerald-600 mb-4" />
                  <CardTitle>Comunidad Activa</CardTitle>
                  <CardDescription>
                    Conecta con compañeros, comparte tips y resuelve dudas juntos.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <TrendingUp className="h-12 w-12 text-cyan-600 mb-4" />
                  <CardTitle>Progreso Académico</CardTitle>
                  <CardDescription>
                    Organiza tus materiales y sigue tu avance en cada curso.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Award className="h-12 w-12 text-purple-600 mb-4" />
                  <CardTitle>Gamificación</CardTitle>
                  <CardDescription>
                    Gana puntos e insignias por contribuir a la comunidad.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <BookOpen className="h-6 w-6" />
              <span className="text-xl font-bold">CampusLink</span>
            </div>
            <p className="text-gray-400">Tu plataforma académica colaborativa</p>
          </div>
        </footer>
      </div>
    </div>
  );
}