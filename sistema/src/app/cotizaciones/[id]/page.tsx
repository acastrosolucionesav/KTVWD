import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { calcularCareTodos, type Parametros } from '@/lib/pricing';
import { aprobarCotizacion, rechazarCotizacion, marcarEnviada, toggleLinkPropuesta, extenderVigencia } from '@/app/actions/cotizaciones';
import AgregarItemTerceroForm from './AgregarItemTerceroForm';
import EliminarItemTerceroBoton from './EliminarItemTerceroBoton';

const NOMBRES_TIPO_TERCERO: Record<string, string> = { PRODUCTO: 'Producto', SERVICIO: 'Servicio' };

const NOMBRES_SERVICIO: Record<string, string> = {
  INSPECCION_SOLA: 'Solo inspección',
  LAVADO_MAS_INSPECCION: 'Lavado + Inspección KTV Colombia',
  SOLO_LAVADO: 'Solo lavado',
};

const NOMBRES_CONCEPTO: Record<string, string> = {
  SOLO_VENTANAS: 'Solo ventanas',
  SOLO_FACHADA: 'Solo fachada',
  FACHADA_Y_VENTANAS: 'Fachada + ventanas',
};

const NOMBRES_PLAN: Record<string, string> = {
  BASIC: 'KTV Care Basic',
  ESSENTIAL: 'KTV Care Essential',
  COMPLETE: 'KTV Care Complete',
};

function cop(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return 'COP ' + Math.round(n).toLocaleString('es-CO');
}

export default async function CotizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifySession();
  const c = await prisma.cotizacion.findUnique({
    where: { id },
    include: {
      cliente: true, puntual: true, care: true,
      auditorias: { include: { usuario: true }, orderBy: { timestamp: 'desc' } },
      aperturas: { orderBy: { timestamp: 'desc' } },
      versionAnterior: { select: { id: true, idTrazabilidad: true } },
      versionNueva: { select: { id: true, idTrazabilidad: true } },
      itemsTerceros: { orderBy: { creadoAt: 'asc' } },
      itemsLavado: { orderBy: { orden: 'asc' } },
    },
  });
  if (!c) notFound();

  const esGerencia = session.rol === 'GERENCIA';
  const esPuntual = c.familia === 'PUNTUAL' && c.puntual;
  const esCare = c.familia === 'CARE' && c.care;

  // Desglose Care: se recalcula SIEMPRE desde el snapshot congelado de la cotización
  // (nunca de los parámetros vigentes de hoy) — misma disciplina que el DTO de cliente.
  // Los 3 paquetes van juntos en la propuesta, así que el margen se evalúa para los 3.
  const careTodos = esCare
    ? calcularCareTodos(JSON.parse(c.snapshotParametros) as Parametros, {
        m2: c.care!.m2Fachada ?? 0,
        techo: c.care!.rangoTecho ?? 0,
        superficie: c.care!.superficie ?? 'MIXTA',
        tipoEdificio: c.care!.tipoEdificio ?? 'BAJO',
        dificultad: c.care!.dificultad ?? 'BAJO',
      })
    : null;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-[#171E27]">{c.cliente.nombre}</h1>
          <p className="text-sm text-gray-500">
            {c.idTrazabilidad} · {esPuntual ? NOMBRES_SERVICIO[c.puntual!.servicio] : esCare ? `KTV Care (recomendado: ${NOMBRES_PLAN[c.care!.planRecomendado]})` : '—'}
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#66C2F8]/20 text-[#171E27]">{c.estado.replace('_', ' ')}</span>
      </div>

      {c.versionAnterior && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          Esta es una versión corregida de <b>{c.versionAnterior.idTrazabilidad}</b>.{' '}
          <a href={`/cotizaciones/${c.versionAnterior.id}`} className="underline font-semibold">Ver la versión original →</a>
        </div>
      )}
      {c.versionNueva && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Esta cotización fue reemplazada por una versión corregida: <b>{c.versionNueva.idTrazabilidad}</b>. Su link público quedó desactivado.{' '}
          <a href={`/cotizaciones/${c.versionNueva.id}`} className="underline font-semibold">Ir a la versión vigente →</a>
        </div>
      )}

      {/* ---- Lo que ve el cliente ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
          {esCare ? 'Los 3 paquetes que verá el cliente (siempre juntos)' : 'Valor total (lo que verá el cliente)'}
        </h2>
        {esCare && c.care ? (
          <div className="grid grid-cols-3 gap-3">
            {([
              ['BASIC', c.care.valorMensualBasic, c.care.valorAnualBasic],
              ['ESSENTIAL', c.care.valorMensualEssential, c.care.valorAnualEssential],
              ['COMPLETE', c.care.valorMensualComplete, c.care.valorAnualComplete],
            ] as [string, number, number][]).map(([plan, mensual, anual]) => (
              <div key={plan} className={`rounded-lg p-3 ${plan === c.care!.planRecomendado ? 'bg-[#66C2F8]/10 border border-[#66C2F8]' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="text-[10px] font-bold uppercase text-gray-400">{NOMBRES_PLAN[plan]}{plan === c.care!.planRecomendado ? ' ★' : ''}</div>
                <div className="text-lg font-extrabold text-[#171E27]">{cop(mensual)}<span className="text-xs font-normal text-gray-500"> /mes</span></div>
                <div className="text-[11px] text-gray-400">{cop(anual)} / año</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-3xl font-extrabold text-[#171E27]">
            {cop(esPuntual ? c.totalCliente + c.itemsTerceros.reduce((s, it) => s + it.precioVenta, 0) : c.totalCliente)}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-2">Sin IVA · sin metros cuadrados (Regla general de visualización)</p>
        {esPuntual && c.puntual!.mostrarInformeInternacional && c.puntual!.precioInformeAdicional && (
          <p className="text-sm text-gray-600 mt-2">+ Informe Internacional KTV (adicional, activado): {cop(c.puntual!.precioInformeAdicional)}</p>
        )}
        {c.itemsTerceros.length > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            {esPuntual ? 'Incluye' : 'No incluye'} {c.itemsTerceros.length} ítem{c.itemsTerceros.length > 1 ? 's' : ''} de tercero — ver detalle abajo.
          </p>
        )}
      </div>

      {/* ---- Regla A: SOLO Gerencia ve esto ---- */}
      {esGerencia ? (
        <div className="bg-[#171E27] text-white rounded-2xl p-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#66C2F8] mb-3">Panel interno — desglose de costos (solo Gerencia)</h2>
          {esPuntual ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-gray-400">Días de operación (costeo)</dt><dd>{c.puntual!.diasOperacion ?? '—'}</dd>
              <dt className="text-gray-400">Costo operación</dt><dd>{cop(c.puntual!.costoOperacion)}</dd>
              <dt className="text-gray-400">Fee Noruega (confidencial)</dt><dd>{cop(c.puntual!.feeNoruega)}</dd>
              {c.itemsLavado.length === 0 && c.puntual!.concepto && (
                <>
                  <dt className="text-gray-400">Concepto de lavado</dt><dd>{NOMBRES_CONCEPTO[c.puntual!.concepto]}</dd>
                  <dt className="text-gray-400">m² opaca / vidrio</dt><dd>{c.puntual!.m2Opaca ?? 0} / {c.puntual!.m2Vidrio ?? 0}</dd>
                  <dt className="text-gray-400">Días de ejecución (sistema / final)</dt>
                  <dd className={c.puntual!.diasEjecucion != null && c.puntual!.diasEjecucionSistema != null && c.puntual!.diasEjecucion < c.puntual!.diasEjecucionSistema ? 'text-amber-400 font-bold' : ''}>
                    {c.puntual!.diasEjecucionSistema ?? '—'} / {c.puntual!.diasEjecucion ?? '—'}
                  </dd>
                </>
              )}
              {c.itemsLavado.length > 0 && (
                <>
                  <dt className="text-gray-400">Días de ejecución (sistema / final)</dt>
                  <dd className={c.puntual!.diasEjecucion != null && c.puntual!.diasEjecucionSistema != null && c.puntual!.diasEjecucion < c.puntual!.diasEjecucionSistema ? 'text-amber-400 font-bold' : ''}>
                    {c.puntual!.diasEjecucionSistema ?? '—'} / {c.puntual!.diasEjecucion ?? '—'}
                  </dd>
                  <dt className="col-span-2 text-gray-400 pt-2 border-t border-white/10">Ítems de lavado ({c.itemsLavado.length})</dt>
                  {c.itemsLavado.map((it) => (
                    <div key={it.id} className="col-span-2 grid grid-cols-2 gap-y-1 pl-3 border-l border-white/10">
                      <dt className="text-gray-400">{it.nombre} — {NOMBRES_CONCEPTO[it.concepto]}</dt><dd>{cop(it.precioLavado)}</dd>
                      <dt className="text-gray-400">m² opaca / vidrio</dt><dd>{it.m2Opaca} / {it.m2Vidrio}</dd>
                      <dt className="text-gray-400">Costo operación / Fee</dt><dd>{cop(it.costoOperacion)} / {cop(it.feeNoruega)}</dd>
                      <dt className="text-gray-400">Días sistema</dt><dd>{it.diasEjecucionSistema}</dd>
                    </div>
                  ))}
                </>
              )}
              {c.puntual!.descuentoPct != null && (
                <>
                  <dt className="text-amber-400">Precio de lista (sin descuento)</dt><dd>{cop(c.puntual!.precioLavadoSinDescuento)}</dd>
                  <dt className="text-amber-400">Descuento manual aplicado</dt><dd className="text-amber-400 font-bold">{c.puntual!.descuentoPct.toFixed(1)}%</dd>
                </>
              )}
              <dt className="text-gray-400">Margen</dt>
              <dd className={c.puntual!.margenPct! < 0.35 ? 'text-red-400 font-bold' : c.puntual!.margenPct! < 0.40 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {(c.puntual!.margenPct! * 100).toFixed(1)}%
              </dd>
            </dl>
          ) : careTodos ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">El cliente puede elegir cualquiera de los 3 — el margen se evalúa para cada uno. El descuento por volumen nunca baja el margen del 35%.</p>

              {/* Basic: 1 año, DV entregado. Margen único. */}
              {(() => {
                const t = careTodos.BASIC;
                return (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase text-[#66C2F8] mb-1">{NOMBRES_PLAN.BASIC}{c.care!.planRecomendado === 'BASIC' ? ' (recomendado)' : ''} · 1 año</h3>
                    <dl className="grid grid-cols-2 gap-y-1 text-sm">
                      <dt className="text-gray-400">Días de operación / año</dt><dd>{t.diasOperacion}</dd>
                      <dt className="text-gray-400">Costo lavadas ({t.nLavadas}/año)</dt><dd>{cop(t.costoLavadas)}</dd>
                      <dt className="text-gray-400">Costo inspección (DV)</dt><dd>{cop(t.costoInspeccion)}</dd>
                      <dt className="text-gray-400">Fee Noruega (confidencial)</dt><dd>{cop(t.feeNoruega)}</dd>
                      <dt className="text-gray-400">Comisión comercial (año 1)</dt><dd>{cop(t.comision)}</dd>
                      <dt className="text-gray-400">Descuento aplicado</dt><dd>{(t.descuentoAplicado * 100).toFixed(1)}% (compromiso {(t.compromisoDisc * 100).toFixed(1)}% / volumen {(t.volDisc * 100).toFixed(0)}%){t.descuentoLimitadoPorMargen ? ' · volumen recortado por piso 35%' : ''}</dd>
                      <dt className="text-gray-400">Costo total / año</dt><dd>{cop(t.costoTotal)}</dd>
                      <dt className="text-gray-400">Margen</dt>
                      <dd className={t.margenP < 0.35 ? 'text-red-400 font-bold' : t.margenP < 0.40 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {(t.margenP * 100).toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                );
              })()}

              {/* Essential y Complete: 3 años, año 2 sin inspección. El margen cambia por
                  año (año 1 más caro por la inspección) — nunca promediar los 3 años. */}
              {(['ESSENTIAL', 'COMPLETE'] as const).map((plan) => {
                const t = careTodos[plan];
                return (
                  <div key={plan}>
                    <h3 className="text-[11px] font-bold uppercase text-[#66C2F8] mb-1">
                      {NOMBRES_PLAN[plan]}{c.care!.planRecomendado === plan ? ' (recomendado)' : ''} · 3 años
                    </h3>
                    <p className="text-[11px] text-gray-500 mb-2">
                      Días de operación/año: {t.diasOperacion} · Costo lavadas ({t.nLavadas}/año): {cop(t.costoLavadas)} · Fee Noruega: {cop(t.feeNoruega)} · Comisión: {cop(t.comision)} · Descuento: {(t.descuentoAplicado * 100).toFixed(1)}% (compromiso {(t.compromisoDisc * 100).toFixed(1)}% / volumen {(t.volDisc * 100).toFixed(0)}%){t.descuentoLimitadoPorMargen ? ' · volumen recortado por piso 35%' : ''}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {([1, 2, 3] as const).map((anio) => {
                        const a = t.porAnio![anio];
                        return (
                          <div key={anio} className="bg-white/5 rounded-lg p-2.5">
                            <p className="text-[11px] font-bold text-gray-300">Año {anio} — {a.entregable === 'II' ? 'Informe Internacional' : a.entregable === 'DV' ? 'Diagnóstico Visual' : 'Sin inspección'}</p>
                            <p className="text-[11px] text-gray-400 mt-1">Costo total: {cop(a.costoTotal)}</p>
                            <p className={`text-sm font-bold mt-1 ${a.margenP < 0.35 ? 'text-red-400' : a.margenP < 0.40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {(a.margenP * 100).toFixed(1)}%
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Estado de margen</h2>
          <p className="text-sm text-gray-600">
            {c.requiereAprobacion
              ? '⚠️ Bajo el mínimo autorizado — requiere aprobación de Gerencia. El desglose de costos no es visible para su rol.'
              : '✅ Dentro de los márgenes autorizados. El desglose de costos no es visible para su rol.'}
          </p>
        </div>
      )}

      {/* ---- Ítems de terceros (spec_items_terceros_20260716_2.md) ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Ítems de terceros (productos/servicios subcontratados)</h2>
        {c.itemsTerceros.length > 0 && (
          <div className="space-y-2 mb-4">
            {c.itemsTerceros.map((it) => (
              <div key={it.id} className="border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#171E27]">{it.descripcionCliente}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{NOMBRES_TIPO_TERCERO[it.tipo]}</p>
                    {esGerencia && it.notaInterna && (
                      <p className="text-[11px] text-amber-700 mt-1">🔒 {it.notaInterna}</p>
                    )}
                    {esGerencia && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Costo real: {cop(it.costoReal)} · Margen neto: {(it.margenNetoDeseado * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                  <div className="flex items-start gap-2 shrink-0">
                    <span className="font-bold text-[#171E27]">{cop(it.precioVenta)}</span>
                    {c.estado === 'BORRADOR' && <EliminarItemTerceroBoton itemId={it.id} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {c.estado === 'BORRADOR' ? (
          <AgregarItemTerceroForm cotizacionId={c.id} />
        ) : (
          <p className="text-xs text-gray-400">Solo se pueden agregar/quitar ítems de terceros mientras la cotización esté en Borrador.</p>
        )}
      </div>

      {/* ---- Acciones ---- */}
      <div className="flex gap-3 flex-wrap">
        {esGerencia && c.estado === 'PENDIENTE_APROBACION' && (
          <>
            <form action={aprobarCotizacion.bind(null, c.id)}><button className="bg-emerald-600 text-white text-sm font-bold rounded-full px-5 py-2">Aprobar</button></form>
            <form action={rechazarCotizacion.bind(null, c.id)}><button className="bg-red-600 text-white text-sm font-bold rounded-full px-5 py-2">Rechazar</button></form>
          </>
        )}
        {(c.estado === 'APROBADA' || c.estado === 'BORRADOR') && !c.versionNueva && (
          <form action={marcarEnviada.bind(null, c.id)}><button className="bg-[#66C2F8] text-white text-sm font-bold rounded-full px-5 py-2">Marcar como enviada</button></form>
        )}
        {!c.versionNueva && (esPuntual || esCare) && (
          <a href={esPuntual ? `/cotizador/editar/${c.id}` : `/care/editar/${c.id}`} className="bg-white border border-[#66C2F8] text-[#171E27] text-sm font-bold rounded-full px-5 py-2">
            {c.estado === 'BORRADOR' ? 'Editar' : 'Corregir (crea versión nueva)'}
          </a>
        )}
        <a href={`/propuesta/${c.linkToken}`} target="_blank" className="text-sm text-[#171E27] underline self-center">Ver propuesta pública (lo que abre el cliente) →</a>
      </div>

      {/* ---- Módulo 2: link único + tracking de apertura ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Link único de la propuesta</h2>
            <p className="text-xs text-gray-500 mt-1">
              Envíe este enlace al cliente. Es único, no adivinable, y puede desactivarse en
              cualquier momento (por ejemplo, al vencer la propuesta o emitir una nueva versión).
            </p>
          </div>
          <form action={toggleLinkPropuesta.bind(null, c.id)}>
            <button className={`text-sm font-bold rounded-full px-5 py-2 ${c.linkActivo ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-[#66C2F8] text-white'}`}>
              {c.linkActivo ? 'Desactivar link' : 'Reactivar link'}
            </button>
          </form>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <code className={`flex-1 text-xs rounded-lg border px-3 py-2 overflow-x-auto whitespace-nowrap ${c.linkActivo ? 'bg-gray-50 border-gray-200 text-[#171E27]' : 'bg-gray-100 border-gray-200 text-gray-400 line-through'}`}>
            {(process.env.NEXT_PUBLIC_APP_URL || '')}/propuesta/{c.linkToken}
          </code>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.linkActivo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
            {c.linkActivo ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>
        {c.vigenteHasta && (() => {
          const vencida = new Date(c.vigenteHasta) < new Date() && !c.aceptadaPorCliente;
          return (
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500">
                {c.aceptadaPorCliente
                  ? <>Aceptada por el cliente {c.aceptadaAt ? `el ${c.aceptadaAt.toLocaleDateString('es-CO')}` : ''}.</>
                  : vencida
                    ? <span className="text-red-600 font-semibold">⏳ Vencida el {new Date(c.vigenteHasta).toLocaleDateString('es-CO')} — el cliente ya no puede abrirla ni aceptarla.</span>
                    : <>Vigente hasta el <b>{new Date(c.vigenteHasta).toLocaleDateString('es-CO')}</b>.</>}
              </p>
              {!c.aceptadaPorCliente && !c.versionNueva && (
                <form action={extenderVigencia.bind(null, c.id)}>
                  <button className="text-xs font-bold rounded-full px-4 py-2 border border-[#66C2F8] text-[#171E27]">
                    Extender vigencia (+30 días)
                  </button>
                </form>
              )}
            </div>
          );
        })()}
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">
            Aperturas del cliente: {c.aperturas.length}
          </h3>
          {c.aperturas.length > 0 ? (
            <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
              {c.aperturas.slice(0, 5).map((a) => (
                <li key={a.id}>👁 {a.timestamp.toLocaleString('es-CO')}</li>
              ))}
              {c.aperturas.length > 5 && <li className="text-gray-400">… y {c.aperturas.length - 5} más</li>}
            </ul>
          ) : (
            <p className="text-xs text-gray-400 mt-1">El cliente aún no ha abierto la propuesta. (Las vistas del equipo no cuentan.)</p>
          )}
        </div>
      </div>

      {/* ---- Auditoría ---- */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Auditoría</h2>
        <ul className="text-xs text-gray-500 space-y-1">
          {c.auditorias.map((a) => (
            <li key={a.id}>{a.timestamp.toLocaleString('es-CO')} — <b>{a.usuario.nombre}</b> {a.accion} {a.detalle ? `(${a.detalle})` : ''}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
