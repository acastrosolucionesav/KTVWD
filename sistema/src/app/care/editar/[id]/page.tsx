import { notFound, redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import CareForm from '../../CareForm';

export default async function EditarCotizacionCarePage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();
  const { id } = await params;
  const c = await prisma.cotizacion.findUnique({
    where: { id },
    include: { cliente: true, care: true, versionNueva: { select: { id: true } } },
  });
  if (!c || c.familia !== 'CARE' || !c.care) notFound();
  if (c.estado !== 'BORRADOR' && c.versionNueva) redirect(`/cotizaciones/${c.versionNueva.id}`);

  const care = c.care;
  return (
    <CareForm
      esCorreccion={c.estado !== 'BORRADOR'}
      existente={{
        id: c.id,
        clienteNombre: c.cliente.nombre,
        clienteContacto: c.cliente.contacto ?? '',
        pipedriveDealId: c.cliente.pipedriveDealId ?? '',
        plan: care.planRecomendado,
        m2: care.m2Fachada ?? 0,
        techo: care.rangoTecho ?? 0,
        superficie: care.superficie ?? 'MIXTA',
        tipoEdificio: care.tipoEdificio ?? 'BAJO',
        dificultad: care.dificultad ?? 'BAJO',
        formaPago: care.formaPago,
        observaciones: c.observaciones ?? '',
      }}
    />
  );
}
