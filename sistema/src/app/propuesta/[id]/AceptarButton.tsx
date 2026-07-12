'use client';

import { useTransition } from 'react';
import { aceptarPropuesta } from '@/app/actions/cotizaciones';

export default function AceptarButton({ linkToken, aceptada }: { linkToken: string; aceptada: boolean }) {
  const [pending, start] = useTransition();

  if (aceptada) {
    return <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">✓ Propuesta aceptada. KTV ya fue notificado y está programando el servicio.</p>;
  }

  return (
    <button
      disabled={pending}
      onClick={() => start(() => aceptarPropuesta(linkToken))}
      className="bg-[#66C3F8] text-white font-bold rounded-full px-6 py-3 disabled:opacity-60"
    >
      {pending ? 'Confirmando…' : 'Aceptar esta propuesta →'}
    </button>
  );
}
