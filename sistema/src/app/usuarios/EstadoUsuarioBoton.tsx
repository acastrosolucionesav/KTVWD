'use client';

import { useState, useTransition } from 'react';
import { cambiarEstadoUsuario } from '@/app/actions/usuarios';

export default function EstadoUsuarioBoton({ usuarioId, activo, esMismoUsuario }: { usuarioId: string; activo: boolean; esMismoUsuario: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (esMismoUsuario) return null;

  function alternar() {
    const accion = activo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} esta cuenta?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoUsuario(usuarioId, !activo);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button onClick={alternar} disabled={pending}
        className={`text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-60 ${activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
        {pending ? '…' : activo ? 'Desactivar' : 'Activar'}
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
