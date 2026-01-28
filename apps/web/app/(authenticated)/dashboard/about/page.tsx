'use client';

import { Users, Target, Lightbulb, Heart } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-auto bg-bb-dark">
      {/* Header Banner */}
      <div className="relative h-48 md:h-72 bg-gradient-to-br from-blue-600/90 to-indigo-800/90 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-bb-dark to-transparent" />
        <div className="relative z-10 h-full flex items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-3xl md:text-6xl font-black text-white mb-2 md:mb-4 tracking-tight">Sobre <span className="text-blue-300">CampusLink</span></h1>
            <p className="text-sm md:text-xl text-blue-100 font-medium tracking-wide">Transformando la educación universitaria</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12 max-w-full">
        {/* Nuestra Misión */}
        <div className="max-w-5xl mx-auto mb-16 md:mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-blue-500/10 rounded-2xl mb-6 border border-blue-500/20">
                <Target className="w-7 h-7 md:w-8 md:h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-bb-text mb-4 md:mb-6 tracking-tight">Nuestra Misión</h2>
              <p className="text-base md:text-xl text-bb-text-secondary leading-relaxed font-medium">
                Crear una plataforma integral que transforme la experiencia educativa universitaria,
                conectando estudiantes, profesores y recursos en un ecosistema colaborativo y accesible.
              </p>
            </div>
            <div className="order-1 md:order-2 bg-bb-card border border-bb-border rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/20">
                    <span className="font-black text-lg">✓</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-bb-text md:text-lg">Accesibilidad</h4>
                    <p className="text-xs md:text-sm text-bb-text-secondary">Educación sin barreras para todos.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-600/20">
                    <span className="font-black text-lg">✓</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-bb-text md:text-lg">Colaboración</h4>
                    <p className="text-xs md:text-sm text-bb-text-secondary">Conectando mentes brillantes.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nuestra Visión */}
        <div className="max-w-5xl mx-auto mb-16 md:mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="bg-bb-card border border-bb-border rounded-3xl p-6 md:p-10 shadow-2xl md:order-2 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-teal-500/5 rounded-full -ml-16 -mt-16 group-hover:scale-110 transition-transform" />
              <div className="space-y-6 relative z-10">
                <p className="text-base md:text-lg text-bb-text font-bold leading-relaxed mb-4">
                  Imaginamos un futuro con acceso a:
                </p>
                <ul className="space-y-4 font-medium">
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                    <span className="text-bb-text-secondary text-sm md:text-base">Materiales educativos organizados</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <span className="text-bb-text-secondary text-sm md:text-base">Comunidad colaborativa activa</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                    <span className="text-bb-text-secondary text-sm md:text-base">Conexión directa con mentores</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="md:order-1">
              <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 bg-teal-500/10 rounded-2xl mb-6 border border-teal-500/20">
                <Lightbulb className="w-7 h-7 md:w-8 md:h-8 text-teal-400" />
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-bb-text mb-4 md:mb-6 tracking-tight">Nuestra Visión</h2>
              <p className="text-base md:text-xl text-bb-text-secondary leading-relaxed font-medium">
                Ser la plataforma educativa más confiable y utilizada,
                impactando positivamente en el desempeño académico y creando una comunidad
                global de aprendizaje.
              </p>
            </div>
          </div>
        </div>

        {/* Valores */}
        <div className="max-w-5xl mx-auto mb-16 md:mb-24">
          <h2 className="text-2xl md:text-4xl font-black text-bb-text mb-8 md:mb-12 text-center tracking-tight">Nuestros Valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="bg-bb-card rounded-3xl p-6 md:p-8 border border-bb-border hover:border-blue-500/30 transition-all shadow-xl group">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Heart className="w-6 h-6 md:w-7 md:h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-bb-text mb-3">Compromiso</h3>
              <p className="text-sm md:text-base text-bb-text-secondary leading-relaxed">
                Nos comprometemos a ofrecer la mejor experiencia educativa, siempre priorizando las necesidades de nuestros estudiantes.
              </p>
            </div>
            <div className="bg-bb-card rounded-3xl p-6 md:p-8 border border-bb-border hover:border-teal-500/30 transition-all shadow-xl group">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 md:w-7 md:h-7 text-teal-400" />
              </div>
              <h3 className="text-xl font-bold text-bb-text mb-3">Comunidad</h3>
              <p className="text-sm md:text-base text-bb-text-secondary leading-relaxed">
                Creemos en el poder de la conexión y la colaboración para alcanzar objetivos académicos extraordinarios.
              </p>
            </div>
            <div className="bg-bb-card rounded-3xl p-6 md:p-8 border border-bb-border hover:border-purple-500/30 transition-all shadow-xl group">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Lightbulb className="w-6 h-6 md:w-7 md:h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-bb-text mb-3">Innovación</h3>
              <p className="text-sm md:text-base text-bb-text-secondary leading-relaxed">
                Constantemente traemos nuevas funcionalidades que mejoren y modernicen el ecosistema educativo actual.
              </p>
            </div>
          </div>
        </div>

        {/* Por qué fue creado */}
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-3xl p-8 md:p-16 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <h2 className="text-2xl md:text-4xl font-black text-white mb-6 md:mb-8 tracking-tight">¿Por qué <span className="text-blue-400">CampusLink?</span></h2>
          <div className="space-y-4 md:space-y-6 text-sm md:text-xl text-bb-text-secondary font-medium leading-relaxed">
            <p>
              CampusLink nació de nuestra propia experiencia como estudiantes universitarios. Sentíamos que faltaba un lugar centralizado, moderno y realmente útil donde conectar con nuestra facultad.
            </p>
            <p>
              Vimos que encontrar materiales educativos de calidad, contactar a profesores de forma rápida y colaborar con compañeros era más difícil de lo que debería ser. Las herramientas actuales se sentían viejas o separadas.
            </p>
            <p className="text-white italic">
              "Nuestra meta es que ningún estudiante se sienta perdido o sin recursos en su camino profesional."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
