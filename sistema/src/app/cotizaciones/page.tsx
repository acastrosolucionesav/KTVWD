import Link from 'next/link';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700',
  PENDIENTE_APROBACION: 'bg-amber-100 text-amber-800',
  APROBADA: 'bg-emerald-100 text-emerald-800',
  RECHAZADA: 'bg-red-100 text-red-800',
  ENVIADA: 'bg-[#66C2F8]/20 text-[#171E27]',
};

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

export default async function CotizacionesPage() {
  await verifySession();
  const cotizaciones = await prisma.cotizacion.findMany({
    include: { cliente: true, puntual: true, care: true },
    orderBy: { creadoAt: 'desc' },
  });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-lg font-extrabold text-[#171E27] mb-6">Cotizaciones</h1>
      <div className="space-y-3">
        {cotizaciones.map((c) => (
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
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${ESTADO_COLOR[c.estado]}`}>{c.estado.replace('_', ' ')}</span>
            </div>
          </Link>
        ))}
        {cotizaciones.length === 0 && <p className="text-gray-400">Aún no hay cotizaciones.</p>}
      </div>
    </div>
  );
}
