import Image from 'next/image';
import AlianzaForm from './AlianzaForm';

// Landing pública de Alianzas y Subfranquicias (spec_pagina_alianzas_20260721.md).
// Autónoma, sin login, para enviarse suelta por correo/WhatsApp a candidatos.
// Marca única #66C2F8, todo en español, SIN cifras de fee/comisión/inversión.
export const metadata = {
  title: 'Alianzas y Subfranquicias — KTV Working Drone',
  description: 'Lleve KTV Working Drone a su región. Alianzas y subfranquicias para expandir la marca líder en mantenimiento de fachadas con drones en Colombia.',
};

const MODELOS = [
  {
    nombre: 'Aliado Comercial',
    texto: 'Refiera proyectos a KTV Working Drone y reciba una comisión por cada uno que se concrete. Ideal si ya tiene relación con administradores de edificios, constructoras o clientes corporativos.',
  },
  {
    nombre: 'Aliado Operador-Comercial',
    texto: 'Para empresas de aseo o mantenimiento que quieran ofrecer nuestros servicios directamente a sus clientes actuales, con nuestro respaldo técnico y operativo.',
    destacado: true,
  },
  {
    nombre: 'Subfranquicia',
    texto: 'Opere KTV Working Drone en su propia región bajo el respaldo completo de la marca internacional: certificación regulatoria, marca, tecnología y soporte, ya resueltos.',
  },
];

export default function AlianzasPage() {
  return (
    <div className="min-h-screen bg-[#eef2f6]">
      {/* 1. Hero */}
      <section className="relative min-h-[62vh] flex items-end overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover">
            <source src="https://landing.ktvworkingdrone.com.co/videos/hero.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(160deg,rgba(102,194,248,.70) 0%,rgba(20,20,50,.90) 100%)' }} />
        <div className="relative z-[2] max-w-5xl mx-auto w-full px-6 md:px-12 pt-28 pb-12">
          <Image src="/logo-ktv-white.png" alt="KTV Working Drone" width={200} height={42} className="h-9 w-auto mb-6" />
          <h1 className="text-3xl md:text-5xl font-extrabold text-white max-w-3xl">Lleve KTV Working Drone a su región</h1>
          <p className="text-white/90 text-base md:text-lg font-light mt-4 max-w-2xl">
            Alianzas y subfranquicias para expandir la marca líder en mantenimiento de fachadas con drones en Colombia.
          </p>
          <a href="#contacto" className="inline-block mt-6 bg-white text-[#171E27] font-bold rounded-full px-7 py-3 text-sm">
            Quiero ser aliado →
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-16 space-y-14">
        {/* 2. Por qué asociarse */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#66C2F8] mb-3">Por qué asociarse con KTV Working Drone</h2>
          <p className="text-lg md:text-xl text-[#171E27] leading-relaxed">
            KTV Working Drone es una marca internacional presente en 68 países, con tecnología propia de lavado,
            inspección e impermeabilización de fachadas mediante drones. En Colombia contamos con el único permiso
            de explotador UAS de la Aeronáutica Civil en nuestra categoría — un proceso regulatorio de más de 2 años
            que respalda a cada aliado bajo nuestra marca.
          </p>
        </section>

        {/* 3. El problema que resolvemos */}
        <section className="bg-[#171E27] rounded-2xl p-8 md:p-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#66C2F8] mb-3">Lo que resolvemos para nuestros aliados</h2>
          <p className="text-base md:text-lg text-white/90 leading-relaxed">
            Montar una operación de drones desde cero implica inversión en equipos, procesos regulatorios largos,
            entrenamiento especializado y desarrollo de marca. Asociarse con KTV Working Drone significa acceder a
            todo esto ya resuelto — tecnología, respaldo legal, marca reconocida y soporte comercial — sin empezar
            de cero.
          </p>
        </section>

        {/* 4. Modelos de asociación */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#66C2F8] mb-1 text-center">Modelos de asociación</h2>
          <p className="text-sm text-gray-500 text-center mb-6">Elegimos juntos el que mejor se ajusta a su empresa.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {MODELOS.map((m) => (
              <div key={m.nombre}
                className={`rounded-2xl p-6 flex flex-col bg-white border-2 ${m.destacado ? 'border-[#66C2F8] shadow-lg shadow-[#66C2F8]/20 md:-translate-y-2' : 'border-gray-200'}`}>
                {m.destacado && (
                  <span className="self-start text-[10px] font-extrabold uppercase tracking-wide bg-[#66C2F8] text-white rounded-full px-3 py-1 mb-3">Más elegido</span>
                )}
                <h3 className="text-base font-extrabold text-[#171E27]">{m.nombre}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{m.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Por qué ahora */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#66C2F8] mb-3">Por qué ahora</h2>
          <p className="text-lg md:text-xl text-[#171E27] leading-relaxed">
            El mercado de inspección técnica de fachadas en Colombia está prácticamente sin explotar — ningún
            competidor local ofrece hoy un servicio de diagnóstico técnico con el respaldo de ingeniería
            internacional que tiene KTV. Ser aliado de KTV Working Drone es entrar temprano a un mercado con
            espacio real de crecimiento.
          </p>
        </section>

        {/* 6. Formulario */}
        <section id="contacto" className="scroll-mt-6">
          <h2 className="text-xl md:text-2xl font-extrabold text-[#171E27] mb-4">Hablemos de su alianza</h2>
          <AlianzaForm />
        </section>
      </div>

      <footer className="bg-[#171E27] text-white/70 text-center text-xs py-8 px-6">
        <Image src="/logo-ktv-white.png" alt="KTV Working Drone" width={140} height={30} className="h-7 w-auto mx-auto mb-3" />
        <p>KTV Working Drone Colombia S.A.S. — Mantenimiento de fachadas con tecnología de drones.</p>
      </footer>
    </div>
  );
}
