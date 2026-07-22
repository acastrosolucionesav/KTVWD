'use server';

import { prisma } from '@/lib/prisma';
import { crearLeadAlianza } from '@/lib/pipedrive';

export type SolicitudAlianzaState = { ok?: boolean; error?: string } | undefined;

// Formulario público de la landing de Alianzas (sin login). Se guarda SIEMPRE
// en la BD (nunca se pierde un candidato) y, best-effort, se crea un lead en
// Pipedrive marcado como ALIANZA. No depende de correo/SendGrid.
export async function crearSolicitudAlianza(_state: SolicitudAlianzaState, formData: FormData): Promise<SolicitudAlianzaState> {
  const nombre = String(formData.get('nombre') || '').trim();
  const empresa = String(formData.get('empresa') || '').trim() || null;
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const telefono = String(formData.get('telefono') || '').trim() || null;
  const ciudad = String(formData.get('ciudad') || '').trim() || null;
  const mensaje = String(formData.get('mensaje') || '').trim() || null;

  if (!nombre) return { error: 'Por favor indíquenos su nombre.' };
  if (!email || !email.includes('@')) return { error: 'Por favor indíquenos un correo válido.' };

  const solicitud = await prisma.solicitudAlianza.create({
    data: { nombre, empresa, email, telefono, ciudad, mensaje },
  });

  // Best-effort: nunca bloquea la confirmación al candidato si Pipedrive falla.
  const leadId = await crearLeadAlianza({ nombre, empresa, email, telefono, ciudad, mensaje })
    .catch(() => null);
  if (leadId) {
    await prisma.solicitudAlianza.update({ where: { id: solicitud.id }, data: { pipedriveLeadId: leadId } }).catch(() => {});
  }

  return { ok: true };
}
