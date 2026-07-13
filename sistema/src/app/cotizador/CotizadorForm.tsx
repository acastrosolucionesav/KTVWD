'use client';

import { useActionState, useState } from 'react';
import { crearCotizacionPuntual } from '@/app/actions/cotizaciones';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm';

export default function CotizadorForm() {
  const [state, action, pending] = useActionState(crearCotizacionPuntual, undefined);
  const [servicio, setServicio] = useState<'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO'>('LAVADO_MAS_INSPECCION');
  const incluyeLavado = servicio !== 'INSPECCION_SOLA';

  return (
    <form action={action} className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-8 my-8 space-y-5 border border-[#66C2F8]/20">
      <h1 className="text-lg font-extrabold text-[#171E27]">Cotización sencilla — Familia 1 (servicio puntual)</h1>

      <div>
        <label className={label}>Producto a cotizar (escoja UNO)</label>
        <select name="servicio" className={input} value={servicio} onChange={(e) => setServicio(e.target.value as typeof servicio)}>
          <option value="SOLO_LAVADO">1 · Solo lavado de fachada</option>
          <option value="LAVADO_MAS_INSPECCION">2 · Lavado + Inspección KTV Colombia (Diagnóstico Visual incluido)</option>
          <option value="INSPECCION_SOLA">3 · Solo inspección — Diagnóstico Visual KTV</option>
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

      {incluyeLavado && (
        <div className="grid grid-cols-3 gap-4 p-4 bg-[#F7FBFF] rounded-xl border border-[#66C2F8]/20">
          <div className="col-span-3">
            <label className={label}>Área de fachada (m²) — solo interno, no se muestra al cliente</label>
            <input name="m2" type="number" required className={input} defaultValue={30500} />
          </div>
          <div>
            <label className={label}>Superficie</label>
            <select name="superficie" className={input} defaultValue="MIXTA">
              <option value="VIDRIO">Vidrio</option>
              <option value="MIXTA">Mixta</option>
              <option value="DIFICIL">Difícil</option>
            </select>
          </div>
          <div>
            <label className={label}>Tipo edificio</label>
            <select name="tipoEdificio" className={input} defaultValue="BAJO">
              <option value="BAJO">Bajo (0%)</option>
              <option value="MEDIO">Medio (+5%)</option>
              <option value="ALTO">Alto (+10%)</option>
            </select>
          </div>
          <div>
            <label className={label}>Dificultad</label>
            <select name="dificultad" className={input} defaultValue="BAJO">
              <option value="BAJO">Baja (0%)</option>
              <option value="MEDIO">Media (+5%)</option>
              <option value="ALTO">Alta (+10%)</option>
            </select>
          </div>
        </div>
      )}

      <div>
        <label className={label}>Área de techo (m²) — para el Diagnóstico Visual / Informe Internacional</label>
        <input name="techo" type="number" className={input} defaultValue={15000} />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="mostrarInformeInternacional" className="rounded" />
        Ofrecer el Informe Internacional KTV como adicional en esta cotización (Regla B)
      </label>

      <div>
        <label className={label}>Observaciones (se muestran al cliente)</label>
        <textarea name="observaciones" rows={3} className={input} placeholder="Aclaraciones de alcance, condiciones especiales…" />
      </div>

      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
        {pending ? 'Calculando…' : 'Crear cotización'}
      </button>
    </form>
  );
}
