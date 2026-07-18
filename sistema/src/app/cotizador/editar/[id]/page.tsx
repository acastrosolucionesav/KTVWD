import { notFound, redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import CotizadorForm from '../../CotizadorForm';

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;
  const c = await prisma.cotizacion.findUnique({
    where: { id },
    include: { cliente: true, puntual: true, versionNueva: { select: { id: true } } },
  });
  if (!c || c.familia !== 'PUNTUAL' || !c.puntual) notFound();
  // Ya se corrigió una vez — siempre se edita/corrige la versión más reciente.
  if (c.estado !== 'BORRADOR' && c.versionNueva) redirect(`/cotizaciones/${c.versionNueva.id}`);

  const p = c.puntual;
  return (
    <CotizadorForm
      esCorreccion={c.estado !== 'BORRADOR'}
      existente={{
        id: c.id,
        clienteNombre: c.cliente.nombre,
        clienteContacto: c.cliente.contacto ?? '',
        pipedriveDealId: c.cliente.pipedriveDealId ?? '',
        servicio: p.servicio,
        m2: p.m2Fachada ?? 0,
        superficie: p.superficie ?? 'MIXTA',
        tipoEdificio: p.tipoEdificio ?? 'BAJO',
        dificultad: p.dificultad ?? 'BAJO',
        descuentoPct: p.descuentoPct,
        techo: p.rangoTecho ?? 0,
        mostrarInformeInternacional: p.mostrarInformeInternacional,
        observaciones: c.observaciones ?? '',
        anticipoPct: p.anticipoPct,
        saldoPct: p.saldoPct,
        condicionPagoNota: p.condicionPagoNota ?? '',
        permisoAerocivil: p.permisoAerocivil ?? '',
        ejecucionSitio: p.ejecucionSitio ?? '',
      }}
    />
  );
}
