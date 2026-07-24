'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireRol } from '@/lib/dal';
import { PARAMETROS_INICIALES } from '@/lib/pricing';

// Solo Gerencia edita parámetros. Los cambios afectan ÚNICAMENTE cotizaciones
// futuras: las ya creadas conservan su snapshotParametros congelado (regla de
// "foto congelada" — una cotización enviada jamás cambia de números).
export async function actualizarParametros(formData: FormData) {
  const session = await requireRol('GERENCIA');

  const claves = Object.keys(PARAMETROS_INICIALES);
  for (const clave of claves) {
    const crudo = formData.get(clave);
    if (crudo === null) continue;
    const valor = Number(String(crudo).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(valor)) continue; // valor ilegible: se ignora, no se corrompe el parámetro
    await prisma.parametro.upsert({
      where: { clave },
      update: { valor: String(valor), actualizadoPor: session.nombre },
      create: { clave, valor: String(valor), unidad: 'numero', actualizadoPor: session.nombre },
    });
  }

  revalidatePath('/parametros');
  redirect('/parametros?ok=1');
}
