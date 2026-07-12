'use client';

import { useActionState, useState } from 'react';
import { crearCotizacionCare } from '@/app/actions/cotizaciones';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C3F8] text-sm';

export default function CareForm() {
  const [state, action, pending] = useActionState(crearCotizacionCare, undefined);
  const [plan, setPlan] = useState<'INSPECT' | 'ESSENTIAL' | 'COMPLETE'>('ESSENTIAL');

  return (
    <form action={action} className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-8 my-8 space-y-5 border border-[#66C3F8]/20">
      <h1 className="text-lg font-extrabold text-[#171E27]">Programa KTV Care — Familia 2 (recurrente)</h1>

      <div>
        <label className={label}>Plan</label>
        <select name="plan" className={input} value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
          <option value="INSPECT">KTV Care Inspect — solo diagnóstico, sin lavadas</option>
          <option value="ESSENTIAL">KTV Care Essential — 1 lavada / año</option>
          <option value="COMPLETE">KTV Care Complete — 2 lavadas / año</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Cliente / Edificio</label>
          <input name="clienteNombre" required className={input} placeholder="CC Plaza Claro — Multiplika" />
        </div>
        <div>
          <label className={label}>Contacto</label>
          <input name="clienteContacto" className={input} placeholder="Hernando Cáceres" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Área de fachada (m²) — solo interno{plan === 'INSPECT' ? ' (no aplica en Inspect)' : ''}</label>
          <input name="m2" type="number" className={input} defaultValue={plan === 'INSPECT' ? 0 : 30500} disabled={plan === 'INSPECT'} />
        </div>
        <div>
          <label className={label}>Área de techo (m²) — para el Diagnóstico Visual incluido</label>
          <input name="techo" type="number" className={input} defaultValue={15000} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Duración del contrato</label>
          <select name="contratoAnios" className={input} defaultValue="1">
            <option value="1">1 año</option>
            <option value="3">3 años (congela precio año 1 + IPC)</option>
          </select>
        </div>
        <div>
          <label className={label}>Forma de pago</label>
          <select name="formaPago" className={input} defaultValue="CONTADO">
            <option value="CONTADO">Contado</option>
            <option value="DIFERIDO_12">Diferido 12 cuotas (no es descuento)</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Observaciones (se muestran al cliente)</label>
        <textarea name="observaciones" rows={3} className={input} placeholder="Aclaraciones de alcance, condiciones especiales…" />
      </div>

      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="bg-[#66C3F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
        {pending ? 'Calculando…' : 'Crear cotización Care'}
      </button>
    </form>
  );
}
