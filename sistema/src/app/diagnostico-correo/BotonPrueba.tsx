'use client';

import { useActionState } from 'react';
import { probarCorreo, type PruebaCorreoState } from '@/app/actions/diagnostico';

export default function BotonPrueba() {
  const [estado, accion, pendiente] = useActionState<PruebaCorreoState>(async () => probarCorreo(), undefined);

  return (
    <form action={accion} className="space-y-3">
      <button type="submit" disabled={pendiente}
        className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
        {pendiente ? 'Enviando…' : 'Enviar correo de prueba'}
      </button>

      {estado?.ok && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
          ✓ Correo enviado a <b>{estado.destinatario}</b>. Si no aparece en unos segundos, revisa la carpeta de spam.
        </p>
      )}
      {estado?.error && (
        <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 space-y-1">
          <p className="font-bold">No se pudo enviar. Esto respondió el servidor de correo:</p>
          <p className="font-mono text-xs break-all">{estado.error}</p>
        </div>
      )}
    </form>
  );
}
