'use client';

import { useState, useTransition } from 'react';
import { generarEnlaceAcceso } from '@/app/actions/usuarios';

// Botón por usuario: genera el enlace para crear/cambiar contraseña y lo
// muestra en pantalla para copiarlo y enviarlo por WhatsApp/como sea — sin
// depender del correo. Sirve para activar cuentas nuevas y para "olvidé mi clave".
export default function EnlaceAccesoBoton({ usuarioId }: { usuarioId: string }) {
  const [pending, start] = useTransition();
  const [enlace, setEnlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function generar() {
    setError(null);
    start(async () => {
      const r = await generarEnlaceAcceso(usuarioId);
      if (r.error) setError(r.error);
      else setEnlace(r.enlace ?? null);
    });
  }

  function copiar() {
    if (!enlace) return;
    navigator.clipboard.writeText(enlace).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  if (enlace) {
    return (
      <div className="flex flex-col items-end gap-1 max-w-[260px]">
        <input readOnly value={enlace} onFocus={(e) => e.currentTarget.select()}
          className="w-full text-[11px] rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-600" />
        <button onClick={copiar} className="text-xs font-bold text-[#66C2F8] hover:underline">
          {copiado ? '¡Copiado!' : 'Copiar enlace'}
        </button>
        <span className="text-[10px] text-gray-400">Válido 7 días · envíelo por WhatsApp</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={generar} disabled={pending}
        className="text-xs font-bold text-gray-600 hover:text-[#66C2F8] disabled:opacity-50">
        {pending ? '…' : 'Generar enlace de acceso'}
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
