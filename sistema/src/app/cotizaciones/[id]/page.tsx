import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { aprobarCotizacion, rechazarCotizacion, marcarEnviada } from '@/app/actions/cotizaciones';

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
    include: { cliente: true, puntual: true, care: true, auditorias: { include: { usuario: true }, orderBy: { timestamp: 'desc' } } },
  });
  if (!c) notFound();

  const esGerencia = session.rol === 'GERENCIA';
  const esPuntual = c.familia === 'PUNTUAL' && c.puntual;
  const esCare = c.familia === 'CARE' && c.care;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-[#171E27]">{c.cliente.nombre}</h1>
          <p className="text-sm text-gray-500">
            {c.idTrazabilidad} · {esPuntual ? NOMBRES_SERVICIO[c.puntual!.servicio] : esCare ? NOMBRES_PLAN[c.care!.plan] : '—'}
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#66C3F8]/20 text-[#171E27]">{c.estado.replace('_', ' ')}</span>
      </div>

      {/* ---- Lo que ve el cliente ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
          {esCare ? 'Valor mensual (lo que verá el cliente)' : 'Valor total (lo que verá el cliente)'}
        </h2>
        <p className="text-3xl font-extrabold text-[#171E27]">
          {esCare ? cop(c.care!.valorMensual) : cop(c.totalCliente)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {esCare ? `${cop(c.care!.valorAnual)} / año` : 'Sin IVA'} · sin metros cuadrados (Regla general de visualización)
        </p>
        {esPuntual && c.puntual!.mostrarInformeInternacional && c.puntual!.precioInformeAdicional && (
          <p className="text-sm text-gray-600 mt-2">+ Informe Internacional KTV (adicional, activado): {cop(c.puntual!.precioInformeAdicional)}</p>
        )}
      </div>

      {/* ---- Regla A: SOLO Gerencia ve esto ---- */}
      {esGerencia ? (
        <div className="bg-[#171E27] text-white rounded-2xl p-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#66C3F8] mb-3">Panel interno — desglose de costos (solo Gerencia)</h2>
          {esPuntual ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-gray-400">Días de operación</dt><dd>{c.puntual!.diasOperacion ?? '—'}</dd>
              <dt className="text-gray-400">Costo operación</dt><dd>{cop(c.puntual!.costoOperacion)}</dd>
              <dt className="text-gray-400">Fee Noruega (confidencial)</dt><dd>{cop(c.puntual!.feeNoruega)}</dd>
              <dt className="text-gray-400">Margen</dt>
              <dd className={c.puntual!.margenPct! < 0.25 ? 'text-red-400 font-bold' : c.puntual!.margenPct! < 0.40 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {(c.puntual!.margenPct! * 100).toFixed(1)}%
              </dd>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">
              Familia Care: el desglose de costo/margen en vivo para programas recurrentes aún no está en el motor
              (pendiente — hoy solo tenemos el margen de referencia documentado en KWD-FIN-MPV-001, ~54-63%).
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Estado de margen</h2>
          <p className="text-sm text-gray-600">
            {esPuntual
              ? (c.requiereAprobacion
                  ? '⚠️ Bajo el mínimo autorizado — requiere aprobación de Gerencia. El desglose de costos no es visible para su rol.'
                  : '✅ Dentro de los márgenes autorizados. El desglose de costos no es visible para su rol.')
              : 'Programa Care — el desglose de costos no es visible para su rol.'}
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
        {(c.estado === 'APROBADA' || c.estado === 'BORRADOR') && (
          <form action={marcarEnviada.bind(null, c.id)}><button className="bg-[#66C3F8] text-white text-sm font-bold rounded-full px-5 py-2">Marcar como enviada</button></form>
        )}
        <a href={`/propuesta/${c.idTrazabilidad}`} target="_blank" className="text-sm text-[#171E27] underline self-center">Ver propuesta pública (lo que abre el cliente) →</a>
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
