'use client';

import { useActionState, useState } from 'react';
import { crearCotizacionCare, previsualizarCare, type CrearCareState, type PreviewCareState, type GuardarPipedriveState } from '@/app/actions/cotizaciones';
import PipedriveDealPicker from '@/components/PipedriveDealPicker';
import type { PipedriveDealResumen } from '@/lib/pipedrive';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm';

function cop(n: number | undefined) {
  if (n === undefined) return '—';
  return 'COP ' + Math.round(n).toLocaleString('es-CO');
}

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
  descuentoPct: number | null;
};

export type DealPrefillCare = { id: string; clienteNombre: string; clienteContacto: string };

// accion / accionPreview: overrides para el modal embebido en Pipedrive — ver
// el mismo mecanismo en CotizadorForm.tsx.
type AccionCare = (prevState: CrearCareState | GuardarPipedriveState, formData: FormData) => Promise<CrearCareState | GuardarPipedriveState>;
type AccionPreviewCare = (prevState: PreviewCareState, formData: FormData) => Promise<PreviewCareState>;

export default function CareForm({ existente, esCorreccion, dealPrefill, accion, accionPreview }: { existente?: CotizacionCareExistente; esCorreccion?: boolean; dealPrefill?: DealPrefillCare; accion?: AccionCare; accionPreview?: AccionPreviewCare }) {
  const [state, action, pending] = useActionState(accion ?? crearCotizacionCare, undefined);
  // Vista previa SIN GUARDAR (decisión Gerencia 2026-07-25) — mismo mecanismo que
  // el cotizador de Familia 1: "Calcular" no toca la base, solo "Crear
  // cotización"/"Guardar cambios" persiste.
  const [preview, previewAction, previewPending] = useActionState(accionPreview ?? previsualizarCare, undefined);
  const [plan, setPlan] = useState<'BASIC' | 'ESSENTIAL' | 'COMPLETE'>(existente?.plan ?? 'ESSENTIAL');
  const [dealPipedrive, setDealPipedrive] = useState<PipedriveDealResumen | null>(null);
  const [clienteNombre, setClienteNombre] = useState(existente?.clienteNombre ?? dealPrefill?.clienteNombre ?? '');
  const [clienteContacto, setClienteContacto] = useState(existente?.clienteContacto ?? dealPrefill?.clienteContacto ?? '');

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
        {esCorreccion ? 'Corregir cotización Care aceptada — Familia 2 (recurrente)' : existente ? 'Editar cotización Care — Familia 2 (recurrente)' : 'Programa KTV Care — Familia 2 (recurrente)'}
      </h1>
      {esCorreccion && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          El cliente ya aceptó esta cotización — no se edita directamente. Al guardar se creará una <b>versión nueva</b> con estos datos corregidos, y el link de la propuesta original se desactivará automáticamente.
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
      ) : dealPrefill ? (
        <input type="hidden" name="pipedriveDealId" value={dealPrefill.id} />
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

      <div>
        <label className={label}>Descuento manual (%) — opcional, aplica por igual a los 3 planes</label>
        <input name="descuentoPct" type="number" min="0" max="99" step="0.1" className={input}
          placeholder="0" defaultValue={existente?.descuentoPct ?? ''} />
        <p className="text-[11px] text-amber-700 mt-1">
          Nunca se suma al descuento de compromiso/volumen de cada plan — se toma el mayor entre los dos, y no puede
          bajar el margen de 35%. Solo dispara aprobación de Gerencia si de verdad mejora lo que el edificio ya recibía.
        </p>
      </div>

      {preview?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{preview.error}</p>}
      {preview?.ok && (
        <div className="bg-[#EBF8FF] border border-[#66C2F8]/40 rounded-lg px-4 py-3 text-sm space-y-1">
          <p className="font-bold text-[#171E27]">Basic: {cop(preview.valorMensualBasic)}/mes · {cop(preview.valorAnualBasic)}/año</p>
          <p className="font-bold text-[#171E27]">Essential: {cop(preview.valorMensualEssential)}/mes · {cop(preview.valorAnualEssential)}/año</p>
          <p className="font-bold text-[#171E27]">Complete: {cop(preview.valorMensualComplete)}/mes · {cop(preview.valorAnualComplete)}/año</p>
          {preview.informeInternacionalAparte !== undefined && (
            <p className="text-gray-500">Informe Internacional (Complete, año 1, facturado aparte): {cop(preview.informeInternacionalAparte)}</p>
          )}
          {preview.peorMargen !== undefined && (
            <p className={preview.peorMargen < 0.35 ? 'text-amber-700' : 'text-gray-500'}>
              Peor margen entre los 3 planes: {(preview.peorMargen * 100).toFixed(1)}%
            </p>
          )}
          {preview.requiereAprobacion && (
            <p className="text-amber-700 font-bold">Quedará pendiente de aprobación de Gerencia antes de poder enviarse.</p>
          )}
          <p className="text-xs text-gray-400">Esta vista previa NO guarda nada — solo "{esCorreccion ? 'Crear versión corregida' : existente ? 'Guardar cambios' : 'Crear cotización Care'}" crea el registro.</p>
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" formAction={previewAction} disabled={previewPending}
          className="bg-white border border-[#66C2F8] text-[#171E27] font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
          {previewPending ? 'Calculando…' : 'Calcular'}
        </button>
        <button type="submit" disabled={pending}
          className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
          {pending ? 'Guardando…' : esCorreccion ? 'Crear versión corregida' : existente ? 'Guardar cambios' : 'Crear cotización Care'}
        </button>
      </div>
    </form>
  );
}
