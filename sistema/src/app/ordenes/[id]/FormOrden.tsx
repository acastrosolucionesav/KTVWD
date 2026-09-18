'use client';

import { useActionState } from 'react';
import { actualizarOrden, type OrdenState } from '@/app/actions/ordenes';

export default function FormOrden({ cotizacionId, anticipoConfirmado, notasOperativas }: {
  cotizacionId: string;
  anticipoConfirmado: boolean;
  notasOperativas: string;
}) {
  const [estado, accion, pendiente] = useActionState(
    actualizarOrden.bind(null, cotizacionId),
    undefined as OrdenState,
  );

  return (
    <form action={accion} className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" name="anticipoConfirmado" defaultChecked={anticipoConfirmado}
          className="mt-1 h-4 w-4 accent-[#66C2F8]" />
        <span>
          <span className="block text-sm font-bold text-[#171E27]">Anticipo confirmado</span>
          <span className="block text-[11px] text-gray-500">
            Márcalo solo cuando tesorería confirme el ingreso. Hasta entonces la orden aparece como pendiente y la
            ejecución no debe programarse.
          </span>
        </span>
      </label>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Notas operativas</label>
        <textarea name="notasOperativas" rows={4} defaultValue={notasOperativas}
          placeholder="Restricciones de horario, contacto en sitio, accesos, parqueadero, permisos del edificio…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm" />
        <p className="text-[11px] text-gray-400 mt-1">Las ve el equipo operativo. Nunca escribas aquí valores ni condiciones económicas.</p>
      </div>

      {estado?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{estado.error}</p>}
      {estado?.ok && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">✓ Orden actualizada.</p>}

      <button type="submit" disabled={pendiente}
        className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
