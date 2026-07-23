'use client';

import { useActionState, useState } from 'react';
import { crearCotizacionCare } from '@/app/actions/cotizaciones';
import PipedriveDealPicker from '@/components/PipedriveDealPicker';
import type { PipedriveDealResumen } from '@/lib/pipedrive';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm';

export type CotizacionCareExistente = {
  id: string;
  clienteNombre: string;
  clienteContacto: string;
  pipedriveDealId: string;
  plan: 'BASIC' | 'ESSENTIAL' | 'COMPLETE';
  m2: number;
  techo: number;
  superficie: string;
  tipoEdificio: string;
  dificultad: string;
  formaPago: string;
  observaciones: string;
};

export default function CareForm({ existente, esCorreccion }: { existente?: CotizacionCareExistente; esCorreccion?: boolean }) {
  const [state, action, pending] = useActionState(crearCotizacionCare, undefined);
  const [plan, setPlan] = useState<'BASIC' | 'ESSENTIAL' | 'COMPLETE'>(existente?.plan ?? 'ESSENTIAL');
  const [dealPipedrive, setDealPipedrive] = useState<PipedriveDealResumen | null>(null);
  const [clienteNombre, setClienteNombre] = useState(existente?.clienteNombre ?? '');
  const [clienteContacto, setClienteContacto] = useState(existente?.clienteContacto ?? '');

  function seleccionarDeal(deal: PipedriveDealResumen | null) {
    setDealPipedrive(deal);
    if (deal) {
      setClienteNombre(deal.orgName || deal.personName || deal.title);
      setClienteContacto(deal.personName ?? '');
    }
  }

  return (
    <form action={action} className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-8 my-8 space-y-5 border border-[#66C2F8]/20">
      <h1 className="text-lg font-extrabold text-[#171E27]">
        {esCorreccion ? 'Corregir cotización Care enviada — Familia 2 (recurrente)' : existente ? 'Editar cotización Care — Familia 2 (recurrente)' : 'Programa KTV Care — Familia 2 (recurrente)'}
      </h1>
      {esCorreccion && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Esta cotización ya se envió/aprobó — no se edita directamente. Al guardar se creará una <b>versión nueva</b> con estos datos corregidos, y el link de la propuesta original se desactivará automáticamente.
        </p>
      )}
      {existente && <input type="hidden" name="cotizacionId" value={existente.id} />}

      <div>
        <label className={label}>Plan recomendado (se destaca en la propuesta)</label>
        <select name="plan" className={input} value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
          <option value="BASIC">KTV Care Basic — 1 año · 1 lavada/año · Diagnóstico Visual anual</option>
          <option value="ESSENTIAL">KTV Care Essential — 3 años · 1 lavada/año · DV años 1 y 3</option>
          <option value="COMPLETE">KTV Care Complete — 3 años · 2 lavadas/año · Informe Internacional año 1 + DV año 3</option>
        </select>
        <p className="text-[11px] text-gray-400 mt-1">La propuesta siempre muestra los 3 paquetes juntos — este es solo el que se destaca con la insignia &quot;Recomendado&quot;. La duración es fija por plan (Basic 1 año, Essential y Complete 3 años).</p>
      </div>

      {existente ? (
        <input type="hidden" name="pipedriveDealId" value={existente.pipedriveDealId} />
      ) : (
        <div className="p-4 bg-amber-50 rounded-xl border-2 border-dashed border-amber-300">
          <label className="block text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">🔗 Paso 1 — Buscar el trato en Pipedrive (opcional)</label>
          <input type="hidden" name="pipedriveDealId" value={dealPipedrive?.id ?? ''} />
          <PipedriveDealPicker onSelect={seleccionarDeal} />
          <p className="text-[11px] text-amber-700/70 mt-1">Si existe el trato, al elegirlo se llenan solos el Cliente y el Contacto de abajo.</p>
        </div>
      )}

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
          <input name="m2" type="number" required min="1" className={input} defaultValue={existente?.m2 ?? 30500} />
        </div>
        <div>
          <label className={label}>Área de techo (m²) — para el Diagnóstico Visual incluido</label>
          <input name="techo" type="number" className={input} defaultValue={existente?.techo ?? 15000} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 p-4 bg-[#F7FBFF] rounded-xl border border-[#66C2F8]/20">
        <div>
          <label className={label}>Superficie</label>
          <select name="superficie" className={input} defaultValue={existente?.superficie ?? 'MIXTA'}>
            <option value="VIDRIO">Vidrio</option>
            <option value="MIXTA">Mixta</option>
            <option value="DIFICIL">Difícil</option>
          </select>
        </div>
        <div>
          <label className={label}>Tipo edificio</label>
          <select name="tipoEdificio" className={input} defaultValue={existente?.tipoEdificio ?? 'BAJO'}>
            <option value="BAJO">Bajo (0%)</option>
            <option value="MEDIO">Medio (+5%)</option>
            <option value="ALTO">Alto (+10%)</option>
          </select>
        </div>
        <div>
          <label className={label}>Dificultad</label>
          <select name="dificultad" className={input} defaultValue={existente?.dificultad ?? 'BAJO'}>
            <option value="BAJO">Baja (0%)</option>
            <option value="MEDIO">Media (+5%)</option>
            <option value="ALTO">Alta (+10%)</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Forma de pago</label>
        <select name="formaPago" className={input} defaultValue={existente?.formaPago ?? 'CONTADO'}>
          <option value="CONTADO">Contado</option>
          <option value="DIFERIDO_12">Diferido 12 cuotas (no es descuento)</option>
        </select>
        <p className="text-[11px] text-gray-400 mt-1">La duración del contrato es fija según el plan (Basic 1 año; Essential y Complete 3 años, que congelan el precio del año 1 + IPC).</p>
      </div>

      <div>
        <label className={label}>Observaciones (se muestran al cliente)</label>
        <textarea name="observaciones" rows={3} className={input} placeholder="Aclaraciones de alcance, condiciones especiales…"
          defaultValue={existente?.observaciones ?? ''} />
      </div>

      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
        {pending ? 'Guardando…' : esCorreccion ? 'Crear versión corregida' : existente ? 'Guardar cambios' : 'Crear cotización Care'}
      </button>
    </form>
  );
}
