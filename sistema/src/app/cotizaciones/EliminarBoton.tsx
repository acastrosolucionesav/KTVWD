'use client';

import { useTransition, useState } from 'react';
import { eliminarCotizacion } from '@/app/actions/cotizaciones';

export default function EliminarBoton({ cotizacionId }: { cotizacionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('¿Borrar esta cotización? Esta acción no se puede deshacer.')) return;
    start(async () => {
      const res = await eliminarCotizacion(cotizacionId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={pending}
        className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50"
      >
        {pending ? 'Borrando…' : 'Borrar'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
