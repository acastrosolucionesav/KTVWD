'use server';

import { revalidatePath } from 'next/cache';
import { requireRol } from '@/lib/dal';
import { prisma } from '@/lib/prisma';

// La Orden de Servicio la administra Gerencia/Dirección: el anticipo es una
// confirmación de tesorería, no algo que el comercial que vendió pueda darse
// a sí mismo. Queda en auditoría quién la marcó y cuándo.
export type OrdenState = { error?: string; ok?: boolean } | undefined;

export async function actualizarOrden(cotizacionId: string, _state: OrdenState, formData: FormData): Promise<OrdenState> {
  const session = await requireRol('GERENCIA', 'DIRECTOR_COMERCIAL');

  const orden = await prisma.ordenServicio.findUnique({ where: { cotizacionId } });
  if (!orden) return { error: 'Esta cotización todavía no tiene Orden de Servicio — el cliente aún no la ha aceptado.' };

  const anticipoConfirmado = formData.get('anticipoConfirmado') === 'on';
  const notasOperativas = String(formData.get('notasOperativas') || '').trim() || null;

  await prisma.ordenServicio.update({
    where: { cotizacionId },
    data: { anticipoConfirmado, notasOperativas },
  });

  // Solo se audita el cambio de anticipo: es el que habilita la ejecución.
  // Editar una nota operativa no es una decisión que haya que rastrear.
  if (anticipoConfirmado !== orden.anticipoConfirmado) {
    await prisma.auditoria.create({
      data: {
        cotizacionId,
        usuarioId: session.userId,
        accion: anticipoConfirmado ? 'confirmo_anticipo' : 'revirtio_anticipo',
      },
    });
  }

  revalidatePath('/ordenes');
  revalidatePath(`/ordenes/${cotizacionId}`);
  return { ok: true };
}
