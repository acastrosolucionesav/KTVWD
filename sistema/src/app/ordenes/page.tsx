import Link from 'next/link';
import { requireRol } from '@/lib/dal';
import { prisma } from '@/lib/prisma';

// Listado de Órdenes de Servicio: las cotizaciones que el cliente YA aceptó y
// que por lo tanto hay que ejecutar. Sin cifras (ver src/lib/ordenServicio.ts).
export default async function OrdenesPage() {
  await requireRol('GERENCIA', 'DIRECTOR_COMERCIAL');

  const ordenes = await prisma.ordenServicio.findMany({
    orderBy: { creadoAt: 'desc' },
    include: {
      cotizacion: {
        select: {
          id: true, idTrazabilidad: true, familia: true, aceptadaAt: true,
          cliente: { select: { nombre: true, contacto: true } },
          creadoPor: { select: { nombre: true } },
        },
      },
    },
  });

  const pendientes = ordenes.filter((o) => !o.anticipoConfirmado).length;

  return (
    <div className="max-w-4xl mx-auto my-10 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-[#171E27]">Órdenes de Servicio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Propuestas aceptadas por el cliente. {pendientes > 0
            ? <>Hay <b>{pendientes}</b> esperando confirmación de anticipo — la ejecución no arranca hasta entonces.</>
            : 'Todas tienen el anticipo confirmado.'}
        </p>
      </div>

      {ordenes.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-2xl shadow border border-[#66C2F8]/20 p-6">
          Todavía no hay ninguna. Aparecen solas cuando un cliente acepta su propuesta desde el link público.
        </p>
      ) : (
        <div className="bg-white rounded-2xl shadow border border-[#66C2F8]/20 divide-y divide-gray-100">
          {ordenes.map((o) => (
            <Link key={o.id} href={`/ordenes/${o.cotizacion.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#F7FBFF]">
              <div className="min-w-0">
                <p className="font-bold text-[#171E27] truncate">{o.cotizacion.cliente.nombre}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {o.cotizacion.idTrazabilidad} · {o.cotizacion.familia === 'CARE' ? 'Programa KTV Care' : 'Servicio puntual'} · {o.cotizacion.creadoPor.nombre}
                  {o.cotizacion.aceptadaAt && <> · aceptada el {o.cotizacion.aceptadaAt.toLocaleDateString('es-CO')}</>}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-bold rounded-full px-3 py-1 ${o.anticipoConfirmado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {o.anticipoConfirmado ? 'Anticipo confirmado' : 'Anticipo pendiente'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
