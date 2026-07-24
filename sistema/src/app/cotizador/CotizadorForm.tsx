'use client';

import { useActionState, useState } from 'react';
import { crearCotizacionPuntual } from '@/app/actions/cotizaciones';
import PipedriveDealPicker from '@/components/PipedriveDealPicker';
import type { PipedriveDealResumen } from '@/lib/pipedrive';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm';

type ConceptoLavadoUI = 'SOLO_VENTANAS' | 'SOLO_FACHADA' | 'FACHADA_Y_VENTANAS';

export type ItemLavadoUI = {
  nombre: string;
  concepto: ConceptoLavadoUI;
  m2Vidrio: number;
  m2Opaca: number;
  superficie: string;
  tipoEdificio: string;
  dificultad: string;
};

function itemVacio(): ItemLavadoUI {
  return { nombre: '', concepto: 'FACHADA_Y_VENTANAS', m2Vidrio: 0, m2Opaca: 0, superficie: 'MIXTA', tipoEdificio: 'BAJO', dificultad: 'BAJO' };
}

export type CotizacionPuntualExistente = {
  id: string;
  clienteNombre: string;
  clienteContacto: string;
  pipedriveDealId: string;
  servicio: 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
  itemsLavado: ItemLavadoUI[];
  descuentoPct: number | null;
  techo: number;
  mostrarInformeInternacional: boolean;
  observaciones: string;
  anticipoPct: number | null;
  saldoPct: number | null;
  condicionPagoNota: string;
  permisoAerocivil: string;
  diasEjecucion: number | null;
  ejecucionSitio: string;
};

export type DealPrefill = { id: string; clienteNombre: string; clienteContacto: string };

export default function CotizadorForm({ existente, esCorreccion, dealPrefill }: { existente?: CotizacionPuntualExistente; esCorreccion?: boolean; dealPrefill?: DealPrefill }) {
  const [state, action, pending] = useActionState(crearCotizacionPuntual, undefined);
  const [servicio, setServicio] = useState<'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO'>(existente?.servicio ?? 'LAVADO_MAS_INSPECCION');
  const incluyeLavado = servicio !== 'INSPECCION_SOLA';
  const [items, setItems] = useState<ItemLavadoUI[]>(existente?.itemsLavado?.length ? existente.itemsLavado : [itemVacio()]);
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

  function actualizarItem(idx: number, patch: Partial<ItemLavadoUI>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function agregarItem() {
    setItems((prev) => [...prev, itemVacio()]);
  }

  function quitarItem(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  return (
    <form action={action} className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-8 my-8 space-y-5 border border-[#66C2F8]/20">
      <h1 className="text-lg font-extrabold text-[#171E27]">
        {esCorreccion ? 'Corregir cotización enviada — Familia 1 (servicio puntual)' : existente ? 'Editar cotización — Familia 1 (servicio puntual)' : 'Cotización sencilla — Familia 1 (servicio puntual)'}
      </h1>
      {esCorreccion && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Esta cotización ya se envió/aprobó — no se edita directamente. Al guardar se creará una <b>versión nueva</b> con estos datos corregidos, y el link de la propuesta original se desactivará automáticamente.
        </p>
      )}
      {existente && <input type="hidden" name="cotizacionId" value={existente.id} />}

      <div>
        <label className={label}>Producto a cotizar (escoja UNO)</label>
        <select name="servicio" className={input} value={servicio} onChange={(e) => setServicio(e.target.value as typeof servicio)}>
          <option value="SOLO_LAVADO">1 · Solo lavado de fachada</option>
          <option value="LAVADO_MAS_INSPECCION">2 · Lavado + Inspección KTV Colombia (Diagnóstico Visual incluido)</option>
          <option value="INSPECCION_SOLA">3 · Solo inspección — Diagnóstico Visual KTV</option>
        </select>
      </div>

      {existente ? (
        <input type="hidden" name="pipedriveDealId" value={existente.pipedriveDealId} />
      ) : dealPrefill ? (
        <div className="p-4 bg-[#EBF8FF] rounded-xl border border-[#66C2F8]/40">
          <label className="block text-xs font-bold uppercase tracking-wide text-[#66C2F8] mb-1">🔗 Trato de Pipedrive vinculado</label>
          <input type="hidden" name="pipedriveDealId" value={dealPrefill.id} />
          <p className="text-sm text-[#171E27] font-semibold">{clienteNombre}</p>
          <p className="text-[11px] text-gray-500 mt-1">Abriste el cotizador desde el trato en Pipedrive — Cliente y Contacto ya vienen cargados. Al enviar la propuesta, el trato se actualiza solo.</p>
        </div>
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

      {incluyeLavado && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className={label + ' mb-0'}>Ítems de lavado a cotizar</label>
            <button type="button" onClick={agregarItem} className="text-xs font-bold text-[#66C2F8] hover:underline">
              + Agregar otro ítem
            </button>
          </div>
          <p className="text-[11px] text-gray-400 -mt-3">
            Un mismo cliente puede pedir varios edificios o superficies distintas en una sola cotización (ej. torre, fachada, letreros) — agregue un ítem por cada uno. El piso mínimo de proyecto se cobra una sola vez para toda la cotización, no por ítem.
          </p>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-4 p-4 bg-[#F7FBFF] rounded-xl border border-[#66C2F8]/20 relative">
              {items.length > 1 && (
                <button type="button" onClick={() => quitarItem(idx)}
                  className="absolute top-3 right-3 text-xs font-bold text-red-500 hover:underline">
                  Quitar
                </button>
              )}
              <div className="col-span-3">
                <label className={label}>Nombre de este ítem (lo verá el cliente)</label>
                <input name="itemNombre" required className={input} placeholder="Ej. Torre 14 pisos / Fachada Alucobond / Letreros"
                  value={it.nombre} onChange={(e) => actualizarItem(idx, { nombre: e.target.value })} />
              </div>
              <div className="col-span-3">
                <label className={label}>Concepto a cotizar (define el texto que ve el cliente — el precio/m² es el mismo)</label>
                <select name="itemConcepto" className={input} value={it.concepto} onChange={(e) => actualizarItem(idx, { concepto: e.target.value as ConceptoLavadoUI })}>
                  <option value="FACHADA_Y_VENTANAS">Lavado de Fachada + Ventanas</option>
                  <option value="SOLO_FACHADA">Solo Lavado de Fachada</option>
                  <option value="SOLO_VENTANAS">Solo Lavado de Ventanas</option>
                </select>
              </div>
              <div className={it.concepto === 'SOLO_VENTANAS' ? 'col-span-3 md:col-span-1 opacity-40' : 'col-span-3 md:col-span-1'}>
                <label className={label}>Área de fachada opaca (m²) — solo interno</label>
                <input name="itemM2Opaca" type="number" disabled={it.concepto === 'SOLO_VENTANAS'} className={input}
                  placeholder="30500" value={it.concepto === 'SOLO_VENTANAS' ? 0 : it.m2Opaca}
                  onChange={(e) => actualizarItem(idx, { m2Opaca: Number(e.target.value) || 0 })} />
              </div>
              <div className={it.concepto === 'SOLO_FACHADA' ? 'col-span-3 md:col-span-1 opacity-40' : 'col-span-3 md:col-span-1'}>
                <label className={label}>Área de vidrios/ventanas (m²) — solo interno</label>
                <input name="itemM2Vidrio" type="number" disabled={it.concepto === 'SOLO_FACHADA'} className={input}
                  placeholder="0" value={it.concepto === 'SOLO_FACHADA' ? 0 : it.m2Vidrio}
                  onChange={(e) => actualizarItem(idx, { m2Vidrio: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className={label}>Superficie</label>
                <select name="itemSuperficie" className={input} value={it.superficie} onChange={(e) => actualizarItem(idx, { superficie: e.target.value })}>
                  <option value="VIDRIO">Vidrio</option>
                  <option value="MIXTA">Mixta</option>
                  <option value="DIFICIL">Difícil</option>
                </select>
              </div>
              <div>
                <label className={label}>Tipo edificio</label>
                <select name="itemTipoEdificio" className={input} value={it.tipoEdificio} onChange={(e) => actualizarItem(idx, { tipoEdificio: e.target.value })}>
                  <option value="BAJO">Bajo (0%)</option>
                  <option value="MEDIO">Medio (+5%)</option>
                  <option value="ALTO">Alto (+10%)</option>
                </select>
              </div>
              <div>
                <label className={label}>Dificultad</label>
                <select name="itemDificultad" className={input} value={it.dificultad} onChange={(e) => actualizarItem(idx, { dificultad: e.target.value })}>
                  <option value="BAJO">Baja (0%)</option>
                  <option value="MEDIO">Media (+5%)</option>
                  <option value="ALTO">Alta (+10%)</option>
                </select>
              </div>
            </div>
          ))}
          <div>
            <label className={label}>Descuento manual sobre el lavado (%) — opcional, aplica sobre el total de todos los ítems</label>
            <input name="descuentoPct" type="number" min="0" max="99" step="0.1" className={input}
              placeholder="0" defaultValue={existente?.descuentoPct ?? ''} />
            <p className="text-[11px] text-amber-700 mt-1">
              Cualquier valor distinto de 0 requiere aprobación de Gerencia antes de poder enviarse, y no puede bajar el margen general de 35%.
            </p>
          </div>
        </div>
      )}

      <div>
        <label className={label}>Área de techo (m²) — para el Diagnóstico Visual / Informe Internacional</label>
        <input name="techo" type="number" className={input} defaultValue={existente?.techo ?? 15000} />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="mostrarInformeInternacional" className="rounded" defaultChecked={existente?.mostrarInformeInternacional ?? false} />
        Ofrecer el Informe Internacional KTV como adicional en esta cotización (Regla B)
      </label>

      <div>
        <label className={label}>Observaciones (se muestran al cliente)</label>
        <textarea name="observaciones" rows={3} className={input} placeholder="Aclaraciones de alcance, condiciones especiales…"
          defaultValue={existente?.observaciones ?? ''} />
      </div>

      <div className="p-4 bg-[#F7FBFF] rounded-xl border border-[#66C2F8]/20 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#171E27]">Condiciones, permisos y plazos (se muestran al cliente)</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Anticipo (%)</label>
            <input name="anticipoPct" type="number" min="0" max="100" className={input} defaultValue={existente?.anticipoPct ?? 60} />
          </div>
          <div>
            <label className={label}>Saldo (%)</label>
            <input name="saldoPct" type="number" min="0" max="100" className={input} defaultValue={existente?.saldoPct ?? 40} />
          </div>
        </div>
        <div>
          <label className={label}>Condición de pago (nota)</label>
          <textarea name="condicionPagoNota" rows={2} className={input}
            defaultValue={existente?.condicionPagoNota ?? '60% con la Orden de Compra; 40% antes de finalizar el servicio. Opción de pago diferido hasta en 12 cuotas mensuales sujeto a aprobación (no modifica el valor del contrato).'} />
        </div>
        <div>
          <label className={label}>Permiso Aeronáutica Civil</label>
          <input name="permisoAerocivil" className={input}
            defaultValue={existente?.permisoAerocivil ?? '30 a 40 días hábiles. Tramitación y radicación a cargo de KTV.'} />
        </div>
        {incluyeLavado ? (
          <div>
            <label className={label}>Días de ejecución en sitio — vacío para que el sistema lo calcule</label>
            <input name="diasEjecucion" type="number" min="0" step="0.5" className={input}
              placeholder="Se calcula automático con la productividad real (suma de todos los ítems)" defaultValue={existente?.diasEjecucion ?? ''} />
            <p className="text-[11px] text-amber-700 mt-1">
              Aumentar el plazo es libre. Poner menos días de los que calcula el sistema requiere aprobación de Gerencia.
            </p>
          </div>
        ) : (
          <div>
            <label className={label}>Ejecución en sitio</label>
            <input name="ejecucionSitio" className={input}
              defaultValue={existente?.ejecucionSitio ?? '15 a 20 días hábiles. Una vez aprobados permisos y recibido el anticipo.'} />
          </div>
        )}
      </div>

      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
        {pending ? 'Guardando…' : esCorreccion ? 'Crear versión corregida' : existente ? 'Guardar cambios' : 'Crear cotización'}
      </button>
    </form>
  );
}
