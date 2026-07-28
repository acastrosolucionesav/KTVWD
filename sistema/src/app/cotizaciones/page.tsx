import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import type { EstadoCotizacion } from '@/generated/prisma/enums';
import EliminarBoton from './EliminarBoton';

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700',
  PENDIENTE_APROBACION: 'bg-amber-100 text-amber-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  RECHAZADA: 'bg-red-100 text-red-800',
  ENVIADA: 'bg-[#66C2F8]/20 text-[#171E27]',
};

const NOMBRES_ESTADO: Record<string, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pendiente de aprobación',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ENVIADA: 'Enviada',
};

const NOMBRES_SERVICIO: Record<string, string> = {
  INSPECCION_SOLA: 'Solo inspección',
  LAVADO_MAS_INSPECCION: 'Lavado + Inspección KTV Colombia',
  SOLO_LAVADO: 'Solo lavado',
};

const NOMBRES_PLAN: Record<string, string> = {
  BASIC: 'KTV Care Basic',
  ESSENTIAL: 'KTV Care Essential',
  COMPLETE: 'KTV Care Complete',
};

const ESTADOS_VALIDOS = new Set(['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'RECHAZADA', 'ENVIADA']);

export default async function CotizacionesPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const { q, estado } = await searchParams;
  const session = await verifySession();
  const estadoFiltro = estado && ESTADOS_VALIDOS.has(estado) ? (estado as EstadoCotizacion) : undefined;

  // Visibilidad por rol (decisión Gerencia 2026-07-25): un comercial solo ve las
  // cotizaciones que ÉL creó — nunca las de otro comercial ni las de Gerencia.
  // Gerencia sigue viendo el listado completo, como siempre, para poder
  // aprobar/rechazar y hacer seguimiento de todo el equipo.
  //
  // Buscador + filtro por estado (decisión Gerencia 2026-07-25): con muchas
  // cotizaciones acumuladas se vuelve difícil de revisar a simple vista — se
  // agrega búsqueda por nombre de cliente y filtro por estado, vía querystring
  // (formulario GET, sin JS) para que el link se pueda compartir/recargar.
  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      ...(session.rol === 'GERENCIA' ? {} : { creadoPorId: session.userId }),
      ...(estadoFiltro ? { estado: estadoFiltro } : {}),
      ...(q?.trim() ? { cliente: { nombre: { contains: q.trim(), mode: 'insensitive' } } } : {}),
    },
    include: { cliente: true, puntual: true, care: true, versionNueva: { select: { idTrazabilidad: true } } },
    orderBy: { creadoAt: 'desc' },
  });

  // Agrupadas por cliente (decisión Gerencia 2026-07-25): un mismo cliente puede
  // acumular varias cotizaciones (reintentos, correcciones) — verlas juntas en
  // vez de intercaladas por fecha con las de otros clientes es más fácil de
  // revisar. El orden de los grupos sigue la fecha de su cotización más
  // reciente, porque `cotizaciones` ya viene ordenado desc y el Map conserva el
  // orden de primera aparición de cada clave.
  const grupos = new Map<string, typeof cotizaciones>();
  for (const c of cotizaciones) {
    const key = c.cliente.nombre;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(c);
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-lg font-extrabold text-[#171E27] mb-6">Cotizaciones</h1>

      <form method="get" className="flex flex-wrap gap-2 mb-6">
        <input
          type="text" name="q" defaultValue={q ?? ''}
          placeholder="Buscar por cliente…"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#66C2F8]"
        />
        <select name="estado" defaultValue={estadoFiltro ?? ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#66C2F8]">
          <option value="">Todos los estados</option>
          {Object.entries(NOMBRES_ESTADO).map(([valor, nombre]) => (
            <option key={valor} value={valor}>{nombre}</option>
          ))}
        </select>
        <button type="submit" className="bg-[#66C2F8] text-white font-bold rounded-lg px-5 py-2 text-sm">Filtrar</button>
        {(q || estadoFiltro) && (
          <Link href="/cotizaciones" className="text-sm text-gray-400 hover:text-gray-600 self-center">Quitar filtros</Link>
        )}
      </form>

      <div className="space-y-6">
        {Array.from(grupos.entries()).map(([clienteNombre, items]) => {
          // Una corrección no reemplaza el registro anterior — crea uno nuevo y
          // deja el viejo con versionNuevaId apuntando a él (ver crearCotizacion*
          // en actions/cotizaciones.ts). Sin esta separación, un cliente con
          // varias rondas de "el cliente pidió otro descuento" acumula una fila
          // por cada intento y ya no se distingue cuál es la vigente — así que
          // acá solo se muestran de entrada las que NADIE reemplazó; el resto
          // queda colapsado como historial.
          const vigentes = items.filter((c) => !c.versionNueva);
          const historicas = items.filter((c) => c.versionNueva);
          return (
          <div key={clienteNombre}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
              {clienteNombre} {items.length > 1 && <span className="text-gray-300 font-normal normal-case">· {items.length} cotizaciones</span>}
            </h2>
            <div className="space-y-3">
              {vigentes.map((c) => (
                <Link key={c.id} href={`/cotizaciones/${c.id}`}
                  className="block bg-white rounded-xl border border-gray-200 hover:border-[#66C2F8] p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#171E27]">{c.cliente.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {c.idTrazabilidad} · {c.familia === 'PUNTUAL' ? NOMBRES_SERVICIO[c.puntual?.servicio ?? ''] : `KTV Care (recomendado: ${NOMBRES_PLAN[c.care?.planRecomendado ?? '']})`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.requiereAprobacion && c.estado === 'PENDIENTE_APROBACION' && (
                      <span className="text-xs text-amber-700">margen bajo — requiere Gerencia</span>
                    )}
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${ESTADO_COLOR[c.estado]}`}>{NOMBRES_ESTADO[c.estado] ?? c.estado}</span>
                    {session.rol === 'GERENCIA' && (c.estado === 'BORRADOR' || c.estado === 'RECHAZADA') && <EliminarBoton cotizacionId={c.id} />}
                  </div>
                </Link>
              ))}
              {vigentes.length === 0 && historicas.length > 0 && (
                <p className="text-xs text-gray-400 italic">Todas las cotizaciones de este cliente fueron reemplazadas por una corrección — ábralas desde el historial de abajo.</p>
              )}
              {historicas.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none list-none flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                    Ver historial de correcciones ({historicas.length})
                  </summary>
                  <div className="space-y-2 mt-2">
                    {historicas.map((c) => (
                      <Link key={c.id} href={`/cotizaciones/${c.id}`}
                        className="block bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 p-3 flex items-center justify-between opacity-70">
                        <div>
                          <div className="text-sm text-gray-500">{c.cliente.nombre}</div>
                          <div className="text-xs text-gray-400">
                            {c.idTrazabilidad} · reemplazada por <b>{c.versionNueva?.idTrazabilidad}</b>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${ESTADO_COLOR[c.estado]}`}>{NOMBRES_ESTADO[c.estado] ?? c.estado}</span>
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
          );
        })}
        {cotizaciones.length === 0 && (
          <p className="text-gray-400">{q || estadoFiltro ? 'Ninguna cotización coincide con el filtro.' : 'Aún no hay cotizaciones.'}</p>
        )}
      </div>
    </div>
  );
}
