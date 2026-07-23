'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { agregarItemTercero } from '@/app/actions/itemsTerceros';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm';

// Palabras a evitar en la descripción visible al cliente — para el cliente,
// quien presta el servicio es siempre KTV (spec_items_terceros_20260716_2.md).
// Solo advierte, no bloquea — puede haber casos legítimos.
const PALABRAS_A_EVITAR = ['tercero', 'subcontrat', 'proveedor externo'];

export default function AgregarItemTerceroForm({ cotizacionId }: { cotizacionId: string }) {
  const [state, action, pending] = useActionState(agregarItemTercero, undefined);
  const [descripcion, setDescripcion] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.error) {
      formRef.current?.reset();
      setDescripcion('');
    }
  }, [state]);

  const advertencia = PALABRAS_A_EVITAR.find((w) => descripcion.toLowerCase().includes(w));

  return (
    <form action={action} ref={formRef} className="space-y-3 border-t border-gray-100 pt-4">
      <input type="hidden" name="cotizacionId" value={cotizacionId} />
      <div>
        <label className={label}>Descripción para el cliente</label>
        <input name="descripcionCliente" required className={input} placeholder="Lavado de ventanas interior"
          value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        {advertencia && (
          <p className="text-[11px] text-amber-600 mt-1">
            ⚠️ Evita mencionar &quot;{advertencia}&quot; — para el cliente, este servicio lo presta KTV.
          </p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={label}>Tipo</label>
          <select name="tipo" className={input} defaultValue="SERVICIO">
            <option value="PRODUCTO">Producto (15% margen neto)</option>
            <option value="SERVICIO">Servicio (25% margen neto)</option>
          </select>
          <p className="text-[10px] text-gray-400 mt-1">Transporte y viáticos (servicios fuera de Bogotá) van como <b>Producto</b>.</p>
        </div>
        <div>
          <label className={label}>Costo real del tercero (COP)</label>
          <input name="costoReal" type="number" min="1" required className={input} placeholder="500000" />
        </div>
        <div>
          <label className={label}>Nota interna (opcional)</label>
          <input name="notaInterna" className={input} placeholder="Proveedor XYZ" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="bg-white border border-[#66C2F8] text-[#171E27] text-sm font-bold rounded-full px-5 py-2 disabled:opacity-60">
        {pending ? 'Agregando…' : '+ Agregar ítem de tercero'}
      </button>
    </form>
  );
}
