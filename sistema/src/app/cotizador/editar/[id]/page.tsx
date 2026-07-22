import { notFound, redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import CotizadorForm from '../../CotizadorForm';

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;
  const c = await prisma.cotizacion.findUnique({
    where: { id },
    include: { cliente: true, puntual: true, versionNueva: { select: { id: true } }, itemsLavado: { orderBy: { orden: 'asc' } } },
  });
  if (!c || c.familia !== 'PUNTUAL' || !c.puntual) notFound();
  // Ya se corrigió una vez — siempre se edita/corrige la versión más reciente.
  if (c.estado !== 'BORRADOR' && c.versionNueva) redirect(`/cotizaciones/${c.versionNueva.id}`);

  const p = c.puntual;
  // itemsLavado es lo nuevo (spec_multi_item_lavado_20260722.md). Una cotización
  // creada ANTES de este cambio no tiene filas ahí — se reconstruye un único
  // ítem a partir de los campos viejos de CotizacionPuntual para que el
  // formulario la muestre igual (al guardar, ya queda migrada a itemsLavado).
  const itemsLavado = c.itemsLavado.length > 0
    ? c.itemsLavado.map((it) => ({
        nombre: it.nombre, concepto: it.concepto, m2Vidrio: it.m2Vidrio, m2Opaca: it.m2Opaca,
        superficie: it.superficie, tipoEdificio: it.tipoEdificio, dificultad: it.dificultad,
      }))
    : p.concepto
      ? [{
          nombre: 'Lavado', concepto: p.concepto, m2Vidrio: p.m2Vidrio ?? 0, m2Opaca: p.m2Opaca ?? 0,
          superficie: p.superficie ?? 'MIXTA', tipoEdificio: p.tipoEdificio ?? 'BAJO', dificultad: p.dificultad ?? 'BAJO',
        }]
      : [];
  return (
    <CotizadorForm
      esCorreccion={c.estado !== 'BORRADOR'}
      existente={{
        id: c.id,
        clienteNombre: c.cliente.nombre,
        clienteContacto: c.cliente.contacto ?? '',
        pipedriveDealId: c.cliente.pipedriveDealId ?? '',
        servicio: p.servicio,
        itemsLavado,
        descuentoPct: p.descuentoPct,
        techo: p.rangoTecho ?? 0,
        mostrarInformeInternacional: p.mostrarInformeInternacional,
        observaciones: c.observaciones ?? '',
        anticipoPct: p.anticipoPct,
        saldoPct: p.saldoPct,
        condicionPagoNota: p.condicionPagoNota ?? '',
        permisoAerocivil: p.permisoAerocivil ?? '',
        diasEjecucion: p.diasEjecucion,
        ejecucionSitio: p.ejecucionSitio ?? '',
      }}
    />
  );
}
