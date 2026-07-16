import { notFound, redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import CotizadorForm from '../../CotizadorForm';

export default async function EditarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;
  const c = await prisma.cotizacion.findUnique({ where: { id }, include: { cliente: true, puntual: true } });
  if (!c || c.familia !== 'PUNTUAL' || !c.puntual) notFound();
  if (c.estado !== 'BORRADOR') redirect(`/cotizaciones/${id}`);

  const p = c.puntual;
  return (
    <CotizadorForm
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
