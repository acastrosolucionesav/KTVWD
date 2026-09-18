import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRol } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { datosOperativos } from '@/lib/ordenServicio';
import FormOrden from './FormOrden';

// Orden de Servicio de una cotización aceptada. El [id] es el id de la
// COTIZACIÓN (la orden es 1 a 1 con ella), para poder saltar entre el detalle
// comercial y este sin traducir ids.
//
// ⚠️ Esta pantalla NO muestra cifras de dinero — es el documento que se
// comparte con Operaciones (KWD-SIS-PROMPT-001 v2). El desglose económico vive
// solo en /cotizaciones/[id], y solo para Gerencia.
export default async function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRol('GERENCIA', 'DIRECTOR_COMERCIAL');
  const { id } = await params;

  const c = await prisma.cotizacion.findUnique({
    where: { id },
    include: { cliente: true, puntual: true, care: true, itemsLavado: true, itemsTerceros: true, creadoPor: true, ordenServicio: true },
  });
  if (!c || !c.ordenServicio) notFound();

  const { servicio, lineas } = datosOperativos(c);

  return (
    <div className="max-w-2xl mx-auto my-10 px-4 space-y-6">
      <div>
        <Link href="/ordenes" className="text-xs text-gray-400 hover:text-gray-600">← Órdenes de Servicio</Link>
        <h1 className="text-xl font-extrabold text-[#171E27] mt-1">{c.cliente.nombre}</h1>
        <p className="text-sm text-gray-500">
          Orden de Servicio · {c.idTrazabilidad}
          {c.aceptadaAt && <> · aceptada por el cliente el {c.aceptadaAt.toLocaleDateString('es-CO')}</>}
        </p>
      </div>

      <div className={`rounded-2xl px-5 py-4 text-sm font-bold ${c.ordenServicio.anticipoConfirmado ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
        {c.ordenServicio.anticipoConfirmado
          ? '✓ Anticipo confirmado — se puede programar la ejecución.'
          : '⏳ Anticipo pendiente — no programar la ejecución todavía.'}
      </div>

      <div className="bg-white rounded-2xl shadow border border-[#66C2F8]/20 p-6 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Servicio</p>
          <p className="text-sm text-[#171E27] font-semibold mt-0.5">{servicio}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Contacto</p>
            <p className="text-sm text-[#171E27] mt-0.5">{c.cliente.contacto || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Comercial responsable</p>
            <p className="text-sm text-[#171E27] mt-0.5">{c.creadoPor.nombre}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Alcance del trabajo</p>
          <ul className="list-disc pl-5 space-y-1">
            {lineas.map((l, i) => <li key={i} className="text-sm text-gray-700">{l}</li>)}
          </ul>
        </div>
        {c.pipedriveDealId || c.cliente.pipedriveDealId ? (
          <p className="text-[11px] text-gray-400">Trato de Pipedrive #{c.pipedriveDealId ?? c.cliente.pipedriveDealId}</p>
        ) : null}
      </div>

      <div className="bg-white rounded-2xl shadow border border-[#66C2F8]/20 p-6">
        <FormOrden
          cotizacionId={c.id}
          anticipoConfirmado={c.ordenServicio.anticipoConfirmado}
          notasOperativas={c.ordenServicio.notasOperativas ?? ''}
        />
      </div>

      <p className="text-xs text-gray-400">
        Esta orden no lleva valores a propósito: es el documento operativo. El detalle económico está en{' '}
        <Link href={`/cotizaciones/${c.id}`} className="underline hover:text-gray-600">la cotización</Link>.
      </p>
    </div>
  );
}
