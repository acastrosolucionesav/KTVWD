'use client';

import { useActionState, useState } from 'react';
import { crearCotizacionCare } from '@/app/actions/cotizaciones';
import PipedriveDealPicker from '@/components/PipedriveDealPicker';
import type { PipedriveDealResumen } from '@/lib/pipedrive';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm';

export default function CareForm() {
  const [state, action, pending] = useActionState(crearCotizacionCare, undefined);
  const [plan, setPlan] = useState<'INSPECT' | 'ESSENTIAL' | 'COMPLETE'>('ESSENTIAL');
  const [dealPipedrive, setDealPipedrive] = useState<PipedriveDealResumen | null>(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteContacto, setClienteContacto] = useState('');

  function seleccionarDeal(deal: PipedriveDealResumen | null) {
    setDealPipedrive(deal);
    if (deal) {
      setClienteNombre(deal.orgName || deal.personName || deal.title);
      setClienteContacto(deal.personName ?? '');
    }
  }

  return (
    <form action={action} className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-8 my-8 space-y-5 border border-[#66C2F8]/20">
      <h1 className="text-lg font-extrabold text-[#171E27]">Programa KTV Care — Familia 2 (recurrente)</h1>

      <div>
        <label className={label}>Plan recomendado (se destaca en la propuesta)</label>
        <select name="plan" className={input} value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
          <option value="INSPECT">KTV Care Inspect — solo diagnóstico, sin lavadas</option>
          <option value="ESSENTIAL">KTV Care Essential — 1 lavada / año</option>
          <option value="COMPLETE">KTV Care Complete — 2 lavadas / año</option>
        </select>
        <p className="text-[11px] text-gray-400 mt-1">La propuesta siempre muestra los 3 paquetes juntos — este es solo el que se destaca con la insignia &quot;Recomendado&quot;.</p>
      </div>

      <div className="p-4 bg-amber-50 rounded-xl border-2 border-dashed border-amber-300">
        <label className="block text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">🔗 Paso 1 — Buscar el trato en Pipedrive (opcional)</label>
        <input type="hidden" name="pipedriveDealId" value={dealPipedrive?.id ?? ''} />
        <PipedriveDealPicker onSelect={seleccionarDeal} />
        <p className="text-[11px] text-amber-700/70 mt-1">Si existe el trato, al elegirlo se llenan solos el Cliente y el Contacto de abajo.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Cliente / Edificio</label>
          <input name="clienteNombre" required className={input} placeholder="CC Plaza Claro — Multiplika"
            value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
        </div>
        <div>
          <label className={label}>Contacto</label>
          <input name="clienteContacto" className={input} placeholder="Hernando Cáceres"
            value={clienteContacto} onChange={(e) => setClienteContacto(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Área de fachada (m²) — solo interno</label>
          <input name="m2" type="number" required min="1" className={input} defaultValue={30500} />
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
        className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
        {pending ? 'Calculando…' : 'Crear cotización Care'}
      </button>
    </form>
  );
}
