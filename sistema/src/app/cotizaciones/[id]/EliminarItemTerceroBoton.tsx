'use client';

import { useTransition, useState } from 'react';
import { eliminarItemTercero } from '@/app/actions/itemsTerceros';

export default function EliminarItemTerceroBoton({ itemId }: { itemId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!confirm('¿Quitar este ítem de tercero de la cotización?')) return;
    start(async () => {
      const res = await eliminarItemTercero(itemId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={onClick} disabled={pending} className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50">
        {pending ? '…' : 'Quitar'}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
