'use client';

import { Users, Target, Lightbulb, Heart } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      {/* Header Banner */}
      <div className="relative h-64 bg-gradient-to-br from-blue-600 to-teal-600">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-4">Sobre CampusLink</h1>
            <p className="text-xl text-blue-100">Transformando la educación universitaria</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12 max-w-full">
        {/* Nuestra Misión */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-lg mb-4">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Nuestra Misión</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Crear una plataforma integral que transforme la experiencia educativa universitaria, 
                conectando estudiantes, profesores y recursos en un ecosistema colaborativo y accesible.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg p-8">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Accesibilidad</h4>
                    <p className="text-sm text-slate-600">Educación sin barreras</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Colaboración</h4>
                    <p className="text-sm text-slate-600">Comunidad conectada</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Innovación</h4>
                    <p className="text-sm text-slate-600">Tecnología al servicio</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nuestra Visión */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="bg-gradient-to-br from-teal-100 to-teal-50 rounded-lg p-8 md:order-2">
              <div className="space-y-4">
                <p className="text-lg text-slate-700 leading-relaxed">
                  Imaginamos un futuro donde cada estudiante universitario tiene acceso a:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-teal-600 font-bold mt-1">•</span>
                    <span className="text-slate-700">Materiales educativos organizados y accesibles</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-teal-600 font-bold mt-1">•</span>
                    <span className="text-slate-700">Comunidad de aprendizaje colaborativa</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-teal-600 font-bold mt-1">•</span>
                    <span className="text-slate-700">Herramientas para mejorar su desempeño académico</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-teal-600 font-bold mt-1">•</span>
                    <span className="text-slate-700">Conexión directa con sus profesores</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="md:order-1">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-lg mb-4">
                <Lightbulb className="w-8 h-8 text-teal-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Nuestra Visión</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Ser la plataforma educativa más confiable y utilizada en universidades, 
                impactando positivamente en el desempeño académico y creando una comunidad 
                global de aprendizaje.
              </p>
            </div>
          </div>
        </div>

        {/* Valores */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Nuestros Valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-600">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Compromiso</h3>
              <p className="text-slate-600">
                Nos comprometemos a ofrecer la mejor experiencia educativa, siempre priorizando 
                las necesidades de nuestros usuarios.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-teal-600">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Comunidad</h3>
              <p className="text-slate-600">
                Creemos en el poder de la comunidad y la colaboración para alcanzar objetivos 
                académicos comunes.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-purple-600">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Innovación</h3>
              <p className="text-slate-600">
                Constantemente innovamos para traer nuevas funcionalidades que mejoren 
                la experiencia educativa.
              </p>
            </div>
          </div>
        </div>

        {/* Por qué fue creado */}
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-blue-50 to-teal-50 rounded-lg p-8 md:p-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">¿Por qué fue creado CampusLink?</h2>
          <div className="space-y-4 text-lg text-slate-700">
            <p>
              CampusLink nació de la necesidad observada en estudiantes universitarios de tener 
              un lugar centralizado donde acceder a materiales, conectar con profesores y formar 
              comunidades de aprendizaje.
            </p>
            <p>
              Observamos que muchos estudiantes enfrentaban dificultades para encontrar materiales, 
              contactar profesores y colaborar efectivamente con sus compañeros. Las soluciones 
              existentes eran fragmentadas y poco intuitivas.
            </p>
            <p>
              Por eso decidimos crear CampusLink: una plataforma integral, moderna y fácil de 
              usar que pone la educación al alcance de todos, fomentando la colaboración y el 
              crecimiento académico.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}