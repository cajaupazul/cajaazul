import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, Mail } from 'lucide-react';

const sections = [
  ['1. Aceptación', 'Al crear una cuenta o utilizar CampusLink aceptas estos términos y la Política de privacidad. Si no estás de acuerdo, no uses la plataforma.'],
  ['2. Uso de la cuenta', 'Eres responsable de mantener la seguridad de tu cuenta y de la información que publiques. No compartas accesos ni suplantes la identidad de otras personas.'],
  ['3. Comunidad y materiales', 'Puedes compartir materiales para fines académicos cuando tengas derecho a hacerlo. No publiques contenido ilícito, datos personales de terceros, material malicioso ni contenido que infrinja derechos de autor o reglas de tu institución.'],
  ['4. Moderación', 'CampusLink puede revisar, ocultar o retirar contenidos que incumplan estas reglas, afecten a la comunidad o representen un riesgo de seguridad.'],
  ['5. Compras e inventario', 'Los artículos digitales se asignan a la cuenta que completa la compra. Los precios, disponibilidad y condiciones visibles antes de confirmar una operación forman parte de la oferta.'],
  ['6. Disponibilidad', 'Trabajamos para mantener el servicio disponible y seguro, pero puede haber mantenimientos, actualizaciones o interrupciones necesarias para operar la plataforma.'],
  ['7. Cambios y contacto', 'Podemos actualizar estos términos. Si realizamos cambios relevantes, publicaremos la versión vigente en esta página. Para consultas o reportes, usa el correo de contacto.'],
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] text-[#10211f]">
      <header className="border-b border-[#10211f]/10 bg-[#fcfbf7]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="text-lg font-extrabold tracking-tight">CampusLink</Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#46635a] transition-colors hover:text-[#10211f]"><ArrowLeft size={16} /> Volver al inicio</Link>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ffe2d8] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#a4442f]"><BookOpenCheck size={15} /> Uso responsable</div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] sm:text-6xl">Términos y condiciones</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#46635a] sm:text-lg">Las reglas simples que nos ayudan a mantener CampusLink útil, seguro y justo para toda la comunidad.</p>
          <p className="mt-5 text-sm font-medium text-[#6e7d76]">Última actualización: 8 de septiembre de 2026.</p>
        </div>
        <div className="mt-12 grid gap-5">
          {sections.map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-[#10211f]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-extrabold tracking-tight">{title}</h2><p className="mt-3 max-w-3xl leading-7 text-[#486057]">{body}</p></article>
          ))}
        </div>
        <p className="mt-10 flex items-center gap-2 text-sm text-[#46635a]"><Mail size={17} /> Contacto: <a className="font-bold underline" href="mailto:cajaupazul@gmail.com">cajaupazul@gmail.com</a></p>
      </section>
    </main>
  );
}
