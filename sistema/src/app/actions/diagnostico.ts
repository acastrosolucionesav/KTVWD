'use server';

import { requireRol } from '@/lib/dal';
import { enviarCorreoPrueba } from '@/lib/email';

export type PruebaCorreoState = { ok?: boolean; destinatario?: string; error?: string } | undefined;

// Solo Gerencia: mandar correos a voluntad desde una página abierta sería un
// botón de spam, y el diagnóstico muestra la configuración del servidor.
export async function probarCorreo(): Promise<PruebaCorreoState> {
  await requireRol('GERENCIA');
  const r = await enviarCorreoPrueba();
  return r.ok ? { ok: true, destinatario: r.destinatario } : { ok: false, error: r.error };
}
