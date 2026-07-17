import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { calcularCareTodos, type Parametros } from '@/lib/pricing';
import { aprobarCotizacion, rechazarCotizacion, marcarEnviada, toggleLinkPropuesta } from '@/app/actions/cotizaciones';

const NOMBRES_SERVICIO: Record<string, string> = {
  INSPECCION_SOLA: 'Solo inspección',
  LAVADO_MAS_INSPECCION: 'Lavado + Inspección KTV Colombia',
  SOLO_LAVADO: 'Solo lavado',
};

const NOMBRES_PLAN: Record<string, string> = {
  INSPECT: 'KTV Care Inspect',
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
              ['INSPECT', c.care.valorMensualInspect, c.care.valorAnualInspect],
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
          <p className="text-3xl font-extrabold text-[#171E27]">{cop(c.totalCliente)}</p>
        )}
        <p className="text-xs text-gray-400 mt-2">Sin IVA · sin metros cuadrados (Regla general de visualización)</p>
        {esPuntual && c.puntual!.mostrarInformeInternacional && c.puntual!.precioInformeAdicional && (
          <p className="text-sm text-gray-600 mt-2">+ Informe Internacional KTV (adicional, activado): {cop(c.puntual!.precioInformeAdicional)}</p>
        )}
      </div>

      {/* ---- Regla A: SOLO Gerencia ve esto ---- */}
      {esGerencia ? (
        <div className="bg-[#171E27] text-white rounded-2xl p-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#66C2F8] mb-3">Panel interno — desglose de costos (solo Gerencia)</h2>
          {esPuntual ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-gray-400">Días de operación</dt><dd>{c.puntual!.diasOperacion ?? '—'}</dd>
              <dt className="text-gray-400">Costo operación</dt><dd>{cop(c.puntual!.costoOperacion)}</dd>
              <dt className="text-gray-400">Fee Noruega (confidencial)</dt><dd>{cop(c.puntual!.feeNoruega)}</dd>
              <dt className="text-gray-400">Margen</dt>
              <dd className={c.puntual!.margenPct! < 0.35 ? 'text-red-400 font-bold' : c.puntual!.margenPct! < 0.40 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {(c.puntual!.margenPct! * 100).toFixed(1)}%
              </dd>
            </dl>
          ) : careTodos ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">El cliente puede elegir cualquiera de los 3 — el margen se evalúa para cada uno.</p>
              {(['INSPECT', 'ESSENTIAL'] as const).map((plan) => {
                const t = careTodos[plan];
                return (
                  <div key={plan}>
                    <h3 className="text-[11px] font-bold uppercase text-[#66C2F8] mb-1">{NOMBRES_PLAN[plan]}{plan === c.care!.planRecomendado ? ' (recomendado)' : ''}</h3>
                    <dl className="grid grid-cols-2 gap-y-1 text-sm">
                      <dt className="text-gray-400">Días de operación / año</dt><dd>{t.diasOperacion}</dd>
                      <dt className="text-gray-400">Costo lavadas ({t.nLavadas}/año)</dt><dd>{cop(t.costoLavadas)}</dd>
                      <dt className="text-gray-400">Costo inspección (DV)</dt><dd>{cop(t.costoInspeccion)}</dd>
                      <dt className="text-gray-400">Fee Noruega (confidencial)</dt><dd>{cop(t.feeNoruega)}</dd>
                      <dt className="text-gray-400">Comisión comercial (año 1)</dt><dd>{cop(t.comision)}</dd>
                      <dt className="text-gray-400">Costo total / año</dt><dd>{cop(t.costoTotal)}</dd>
                      <dt className="text-gray-400">Margen</dt>
                      <dd className={t.margenP < 0.35 ? 'text-red-400 font-bold' : t.margenP < 0.40 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {(t.margenP * 100).toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                );
              })}

              {/* Complete: DV y II nunca son el mismo costo — año 1 (II) tiene un costo mucho
                  mayor por el fee Noruega. Nunca promediar los 3 años en un margen único. */}
              {(() => {
                const t = careTodos.COMPLETE;
                return (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase text-[#66C2F8] mb-1">
                      {NOMBRES_PLAN.COMPLETE}{c.care!.planRecomendado === 'COMPLETE' ? ' (recomendado)' : ''}
                    </h3>
                    <p className="text-[11px] text-gray-500 mb-2">Días de operación/año (lavadas + inspección): {t.diasOperacion} · Costo lavadas (2/año): {cop(t.costoLavadas)} · Fee Noruega: {cop(t.feeNoruega)} · Comisión: {cop(t.comision)}</p>
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
              })()}
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
