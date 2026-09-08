import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';

const sections = [
  {
    title: '1. Responsable y alcance',
    body: 'CampusLink es una plataforma académica para descubrir, organizar y compartir recursos entre estudiantes. Esta política describe el tratamiento de información al usar nuestro sitio, iniciar sesión y participar en la comunidad.',
  },
  {
    title: '2. Información que tratamos',
    body: 'Tratamos los datos que proporcionas al crear o completar tu perfil —por ejemplo, nombre visible, correo, facultad e Instagram opcional— y la información necesaria para operar tu actividad dentro de CampusLink, como aportes, valoraciones, compras e inventario.',
  },
  {
    title: '3. Inicio de sesión con Google',
    body: 'Cuando eliges continuar con Google, usamos únicamente la información básica autorizada para identificar tu cuenta: nombre, dirección de correo y foto de perfil. CampusLink no recibe ni almacena tu contraseña de Google.',
  },
  {
    title: '4. Finalidades',
    body: 'Usamos la información para crear y proteger tu cuenta, mostrar tu perfil cuando participas, gestionar recursos y compras, prevenir usos indebidos, brindar soporte y mejorar la experiencia de la plataforma.',
  },
  {
    title: '5. Proveedores que intervienen',
    body: 'Usamos proveedores de infraestructura y autenticación para operar CampusLink, incluidos Supabase, Cloudflare y Google. Cuando corresponda un pago, el procesamiento se realiza a través del proveedor de pagos habilitado; CampusLink no almacena datos completos de tarjetas.',
  },
  {
    title: '6. Conservación y eliminación',
    body: 'Conservamos tus datos mientras la cuenta esté activa o sean necesarios para cumplir finalidades legítimas, obligaciones legales o resolver disputas. Puedes solicitar la eliminación de tu cuenta y de tus datos personales mediante el canal de contacto indicado abajo.',
  },
  {
    title: '7. Tus derechos',
    body: 'Puedes solicitar acceso, corrección, actualización o eliminación de tus datos personales. También puedes retirar información opcional de tu perfil desde la plataforma cuando la función esté disponible.',
  },
  {
    title: '8. Cambios a esta política',
    body: 'Podremos actualizar esta política para reflejar cambios operativos, legales o de seguridad. Publicaremos la versión vigente en esta página y actualizaremos la fecha de revisión.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#10211f]">
      <header className="border-b border-[#10211f]/10 bg-[#fcfbf7]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="text-lg font-extrabold tracking-tight">CampusLink</Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#46635a] transition-colors hover:text-[#10211f]">
            <ArrowLeft size={16} /> Volver al inicio
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#dff0e8] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#1d6b4c]">
            <ShieldCheck size={15} /> Privacidad y datos
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] sm:text-6xl">Política de privacidad</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#46635a] sm:text-lg">
            Queremos que sepas qué información usamos, por qué la necesitamos y qué control tienes sobre ella.
          </p>
          <p className="mt-5 text-sm font-medium text-[#6e7d76]">Última actualización: 8 de septiembre de 2026.</p>
        </div>

        <div className="mt-12 grid gap-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-[#10211f]/10 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-extrabold tracking-tight">{section.title}</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[#486057]">{section.body}</p>
            </article>
          ))}
        </div>

        <aside className="mt-8 rounded-2xl bg-[#10211f] p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#b7d8c8]"><CheckCircle2 size={17} /> ¿Tienes una consulta sobre tus datos?</div>
            <p className="mt-2 text-sm leading-6 text-white/70">Escríbenos y revisaremos tu solicitud.</p>
          </div>
          <a className="mt-5 inline-flex items-center gap-2 font-bold underline underline-offset-4 sm:mt-0" href="mailto:cajaupazul@gmail.com"><Mail size={17} /> Contactar a CampusLink</a>
        </aside>
      </section>
    </main>
  );
}
