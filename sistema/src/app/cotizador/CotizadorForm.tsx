'use client';

import { useActionState, useEffect, useState } from 'react';
import { crearCotizacionPuntual, previsualizarPuntual, type CrearPuntualState, type PreviewPuntualState, type GuardarPipedriveState } from '@/app/actions/cotizaciones';
import PipedriveDealPicker from '@/components/PipedriveDealPicker';
import type { PipedriveDealResumen } from '@/lib/pipedrive';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm';

function cop(n: number | undefined) {
  if (n === undefined) return '—';
  return 'COP ' + Math.round(n).toLocaleString('es-CO');
}

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
  // Modo por días
  modoCotizacion: string | null;
  diasEstimados: number | null;
  equipoAlturas: boolean;
  ciudadFuera: boolean;
  nochesAlojamiento: number | null;
  trayectosIntermunicipales: number | null;
  horasExtraPiloto: number | null;
  horasExtraAsistente: number | null;
  diasApoyoExterno: number | null;
  margenObjetivo: number | null;
  nombreTrabajo: string;
  itemsTerceros: { descripcionCliente: string; tipo: 'PRODUCTO' | 'SERVICIO'; costoReal: number; notaInterna: string }[];
};

export type TerceroUI = { descripcionCliente: string; tipo: 'PRODUCTO' | 'SERVICIO'; costoReal: number; notaInterna: string };

export type DealPrefill = { id: string; clienteNombre: string; clienteContacto: string };

// accion / accionPreview: overrides para el modal embebido en Pipedrive (ver
// /pipedrive). Ahí no hay cookie de sesión de KTV — las acciones normales
// llaman a verifySession() y redirigirían al login dentro del iframe — así que
// el modal pasa versiones que se autentican con el JWT de Pipedrive. Además,
// al guardar no hay redirect (el modal no puede navegar al detalle interno),
// por eso la acción devuelve cotizacionId en vez de nunca retornar. El
// formulario normal sigue igual, sin pasar estas props.
type AccionCotizador = (prevState: CrearPuntualState | GuardarPipedriveState, formData: FormData) => Promise<CrearPuntualState | GuardarPipedriveState>;
type AccionPreview = (prevState: PreviewPuntualState, formData: FormData) => Promise<PreviewPuntualState>;

export default function CotizadorForm({ existente, esCorreccion, dealPrefill, accion, accionPreview, onGuardado }: { existente?: CotizacionPuntualExistente; esCorreccion?: boolean; dealPrefill?: DealPrefill; accion?: AccionCotizador; accionPreview?: AccionPreview; onGuardado?: (cotizacionId: string) => void }) {
  const [state, action, pending] = useActionState(accion ?? crearCotizacionPuntual, undefined);
  // Vista previa SIN GUARDAR (decisión Gerencia 2026-07-25): antes, calcular Y
  // guardar eran el mismo botón — cada intento de ver el precio creaba una
  // cotización real. "Calcular" corre esta acción aparte (nunca toca la base);
  // "Crear cotización" / "Guardar cambios" sigue siendo el único botón que persiste.
  const [preview, previewAction, previewPending] = useActionState(accionPreview ?? previsualizarPuntual, undefined);
  const idGuardado = existente?.id ?? (state as GuardarPipedriveState | undefined)?.cotizacionId;
  // El modal de Pipedrive necesita saber qué cotización quedó guardada para
  // poder ofrecer "Ya la envié" sin que el comercial tenga que cerrar y volver
  // a abrir la ventana. En el formulario normal no se pasa y esto no hace nada.
  // `state` va en las dependencias a propósito: cada guardado devuelve un
  // estado nuevo, y así el modal se entera de TODOS los guardados (no solo del
  // primero) — tras editar, la cotización vuelve a Borrador y hay que poder
  // volver a marcarla como enviada.
  useEffect(() => {
    if (idGuardado) onGuardado?.(idGuardado);
  }, [state, idGuardado, onGuardado]);
  const [servicio, setServicio] = useState<'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO'>(existente?.servicio ?? 'LAVADO_MAS_INSPECCION');
  // Modo de cotización (Gerencia 2026-11-04): por metros de fachada, o por días
  // estimados cuando el cliente no tiene el área — que es lo más común.
  const [modo, setModo] = useState<'METROS' | 'DIAS'>(existente?.modoCotizacion === 'DIAS' ? 'DIAS' : 'METROS');
  const [fueraDeCiudad, setFueraDeCiudad] = useState(existente?.ciudadFuera ?? false);
  // Insumos extra y trabajos subcontratados. Antes solo se podían agregar
  // DESPUÉS, desde el detalle interno — y eso se olvidaba, dejando el
  // subcontrato sin cobrar. Ahora se agregan al cotizar (Gerencia 2026-11-05).
  const [terceros, setTerceros] = useState<TerceroUI[]>(existente?.itemsTerceros ?? []);
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
        {esCorreccion ? 'Corregir cotización aceptada — Familia 1 (servicio puntual)' : existente ? 'Editar cotización — Familia 1 (servicio puntual)' : 'Cotización sencilla — Familia 1 (servicio puntual)'}
      </h1>
      {esCorreccion && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          El cliente ya aceptó esta cotización — no se edita directamente. Al guardar se creará una <b>versión nueva</b> con estos datos corregidos, y el link de la propuesta original se desactivará automáticamente.
        </p>
      )}
      {/* idGuardado: dentro del modal de Pipedrive no hay redirect tras guardar,
          así que el formulario se queda en pantalla con los mismos datos. Sin
          arrastrar el id devuelto, un segundo "Crear cotización" crearía un
          registro duplicado del mismo trato — con esto el segundo guardado
          edita el mismo (decisión Gerencia 2026-07-28: una cotización por
          negociación mientras el cliente no la haya aceptado). */}
      {idGuardado && <input type="hidden" name="cotizacionId" value={idGuardado} />}

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
          <p className="text-sm text-[#171E27] font-semibold">{clienteNombre || `Trato #${dealPrefill.id}`}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            {dealPrefill.clienteNombre
              ? 'Abriste el cotizador desde el trato en Pipedrive — Cliente y Contacto ya vienen cargados. Al enviar la propuesta, el trato se actualiza solo.'
              : 'Abriste el cotizador desde este trato en Pipedrive y la cotización quedará vinculada a él, pero no se pudieron traer sus datos — escriba el Cliente y el Contacto abajo.'}
          </p>
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

      {/* Modo de cotización — la decisión que cambia todo el formulario.
          Por metros es lo de siempre; por días es para cuando el cliente no
          tiene el área de su fachada, que es la mayoría de las veces. */}
      {incluyeLavado && (
        <div className="p-4 rounded-xl border-2 border-[#66C2F8]/40 bg-[#F7FBFF] space-y-2">
          <label className={label}>¿Cómo se va a cotizar este trabajo?</label>
          <input type="hidden" name="modoCotizacion" value={modo} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setModo('METROS')}
              className={`flex-1 text-sm font-bold rounded-full px-4 py-2 border-2 ${modo === 'METROS' ? 'bg-[#66C2F8] text-white border-[#66C2F8]' : 'bg-white text-[#171E27] border-gray-300'}`}>
              Por metros de fachada
            </button>
            <button type="button" onClick={() => setModo('DIAS')}
              className={`flex-1 text-sm font-bold rounded-full px-4 py-2 border-2 ${modo === 'DIAS' ? 'bg-[#66C2F8] text-white border-[#66C2F8]' : 'bg-white text-[#171E27] border-gray-300'}`}>
              Por días de trabajo
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            {modo === 'METROS'
              ? 'Tarifa por m² de fachada. Úselo cuando el cliente sepa el área.'
              : 'El piloto estima los días y el precio se arma desde el costo diario real. Úselo cuando el cliente no tenga el área — el cliente nunca ve el valor por día, solo el total.'}
          </p>
        </div>
      )}

      {incluyeLavado && modo === 'DIAS' && (
        <div className="space-y-4 p-4 rounded-xl border border-[#66C2F8]/30">
          <div>
            <label className={label}>Nombre del trabajo (lo ve el cliente)</label>
            <input name="nombreTrabajo" className={input} placeholder="Ej. Lavado de fachada — Torre Norte"
              defaultValue={existente?.nombreTrabajo ?? ''} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Días estimados de trabajo</label>
              <input name="diasEstimados" type="number" min="0.5" step="0.5" className={input}
                defaultValue={existente?.diasEstimados ?? ''} placeholder="Los estima el piloto" />
            </div>
            <div>
              <label className={label}>Margen objetivo (%)</label>
              <input name="margenObjetivo" type="number" min="0" max="95" step="1" className={input}
                defaultValue={existente?.margenObjetivo != null ? Math.round(existente.margenObjetivo * 100) : 40} />
              <p className="text-[11px] text-gray-400 mt-1">El precio se calcula solo para dejar este margen.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Tipo de edificio (altura)</label>
              <select name="tipoEdificioDias" className={input} defaultValue={existente?.itemsLavado?.[0]?.tipoEdificio ?? 'BAJO'}>
                <option value="BAJO">Bajo — hasta 4 pisos (0%)</option>
                <option value="MEDIO">Medio — 5 a 9 pisos (+10%)</option>
                <option value="ALTO">Alto — más de 10 pisos (+15%)</option>
              </select>
            </div>
            <div>
              <label className={label}>Nivel de dificultad</label>
              <select name="dificultadDias" className={input} defaultValue={existente?.itemsLavado?.[0]?.dificultad ?? 'BAJO'}>
                <option value="BAJO">Baja (+1%)</option>
                <option value="MEDIO">Media (+20%)</option>
                <option value="ALTO">Alta — geometría especial (+30%)</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="equipoAlturas" className="rounded" defaultChecked={existente?.equipoAlturas ?? false} />
            Se necesita el equipo de alturas (Mode Spider, pértigas, equipo de montaña)
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="fueraDeCiudad" className="rounded" checked={fueraDeCiudad}
              onChange={(e) => setFueraDeCiudad(e.target.checked)} />
            El trabajo es fuera de la ciudad (alojamiento, trayecto y alimentación)
          </label>

          {fueraDeCiudad && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div>
                <label className={label}>Noches de alojamiento</label>
                <input name="nochesAlojamiento" type="number" min="0" className={input}
                  defaultValue={existente?.nochesAlojamiento ?? ''} placeholder="Vacío = días − 1" />
              </div>
              <div>
                <label className={label}>Trayectos intermunicipales</label>
                <input name="trayectosIntermunicipales" type="number" min="0" className={input}
                  defaultValue={existente?.trayectosIntermunicipales ?? ''} placeholder="Vacío = 1" />
              </div>
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-gray-500">Horas extra y apoyo subcontratado (opcional)</summary>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <label className={label}>Horas extra piloto</label>
                <input name="horasExtraPiloto" type="number" min="0" step="0.5" className={input} defaultValue={existente?.horasExtraPiloto ?? ''} />
              </div>
              <div>
                <label className={label}>Horas extra asistente</label>
                <input name="horasExtraAsistente" type="number" min="0" step="0.5" className={input} defaultValue={existente?.horasExtraAsistente ?? ''} />
              </div>
              <div>
                <label className={label}>Días de apoyo externo</label>
                <input name="diasApoyoExterno" type="number" min="0" step="0.5" className={input} defaultValue={existente?.diasApoyoExterno ?? ''} />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Las horas extra son del total de la operación, no por día.</p>
          </details>
        </div>
      )}

      {incluyeLavado && modo === 'METROS' && (
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

      {/* Insumos adicionales y trabajos de terceros — opcionales, en cualquiera
          de los dos modos. Nunca se absorben al costo: llevan su margen neto
          fijo encima y se le facturan al cliente aparte del lavado. */}
      <div className="space-y-3 p-4 rounded-xl border border-amber-200 bg-amber-50/40">
        <div className="flex items-center justify-between">
          <label className={label + ' mb-0'}>Insumos adicionales o trabajos de terceros (opcional)</label>
          <button type="button" onClick={() => setTerceros((t) => [...t, { descripcionCliente: '', tipo: 'SERVICIO', costoReal: 0, notaInterna: '' }])}
            className="text-xs font-bold text-[#66C2F8] hover:underline">
            + Agregar
          </button>
        </div>
        <p className="text-[11px] text-gray-500 -mt-2">
          Para lo que no entra en la operación normal: un químico especial, andamios, una obra que subcontratamos.
          Se le cobra al cliente con su margen propio (producto 15%, servicio 25%) y nunca se absorbe al costo.
        </p>
        {terceros.length === 0 && <p className="text-[11px] text-gray-400">Ninguno. La mayoría de cotizaciones no lleva.</p>}
        {terceros.map((t, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end bg-white rounded-lg p-3 border border-gray-200">
            <div className="col-span-5">
              <label className={label}>Qué es (lo ve el cliente)</label>
              <input name="terceroDescripcion" className={input} placeholder="Ej. Sellado de juntas" value={t.descripcionCliente}
                onChange={(e) => setTerceros((prev) => prev.map((x, j) => j === i ? { ...x, descripcionCliente: e.target.value } : x))} />
            </div>
            <div className="col-span-2">
              <label className={label}>Tipo</label>
              <select name="terceroTipo" className={input} value={t.tipo}
                onChange={(e) => setTerceros((prev) => prev.map((x, j) => j === i ? { ...x, tipo: e.target.value as 'PRODUCTO' | 'SERVICIO' } : x))}>
                <option value="PRODUCTO">Producto</option>
                <option value="SERVICIO">Servicio</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={label}>Nos cuesta</label>
              <input name="terceroCosto" type="number" min="0" className={input} value={t.costoReal || ''}
                onChange={(e) => setTerceros((prev) => prev.map((x, j) => j === i ? { ...x, costoReal: Number(e.target.value) || 0 } : x))} />
            </div>
            <div className="col-span-2">
              <label className={label}>Nota interna</label>
              <input name="terceroNota" className={input} placeholder="Proveedor" value={t.notaInterna}
                onChange={(e) => setTerceros((prev) => prev.map((x, j) => j === i ? { ...x, notaInterna: e.target.value } : x))} />
            </div>
            <div className="col-span-1 text-right">
              <button type="button" onClick={() => setTerceros((prev) => prev.filter((_, j) => j !== i))}
                className="text-xs font-bold text-red-500 hover:underline">Quitar</button>
            </div>
          </div>
        ))}
      </div>

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

      {preview?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{preview.error}</p>}
      {preview?.ok && (
        <div className="bg-[#EBF8FF] border border-[#66C2F8]/40 rounded-lg px-4 py-3 text-sm space-y-1">
          <p className="font-bold text-[#171E27]">Total cliente: {cop(preview.totalCliente)}</p>
          {!!preview.totalTerceros && (
            <>
              <p className="text-gray-600">+ insumos y terceros: {cop(preview.totalTerceros)}</p>
              <p className="font-bold text-[#171E27]">Total con insumos y terceros: {cop((preview.totalCliente ?? 0) + preview.totalTerceros)}</p>
            </>
          )}
          {preview.margenPct !== undefined && (
            <p className={preview.margenPct < 0.40 ? 'text-amber-700' : 'text-gray-500'}>
              Margen: {(preview.margenPct * 100).toFixed(1)}%
            </p>
          )}
          {preview.requiereAprobacion && (
            <p className="text-amber-700 font-bold">Quedará pendiente de aprobación de Gerencia antes de poder enviarse.</p>
          )}
          <p className="text-xs text-gray-400">Esta vista previa NO guarda nada — solo "{esCorreccion ? 'Crear versión corregida' : existente ? 'Guardar cambios' : 'Crear cotización'}" crea el registro.</p>
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}
      {!state?.error && !!(state as GuardarPipedriveState | undefined)?.cotizacionId && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">✓ Cotización guardada — ya puedes cerrar esta ventana o seguir ajustando.</p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" formAction={previewAction} disabled={previewPending}
          className="bg-white border border-[#66C2F8] text-[#171E27] font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
          {previewPending ? 'Calculando…' : 'Calcular'}
        </button>
        <button type="submit" disabled={pending}
          className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 disabled:opacity-60">
          {pending ? 'Guardando…' : esCorreccion ? 'Crear versión corregida' : idGuardado ? 'Guardar cambios' : 'Crear cotización'}
        </button>
      </div>
    </form>
  );
}
