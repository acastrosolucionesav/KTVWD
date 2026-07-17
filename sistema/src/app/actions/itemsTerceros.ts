'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/dal';
import { getParametrosVigentes } from '@/lib/parametros';
import { calcularItemTercero, type TipoItemTercero } from '@/lib/pricing';

export type AgregarItemTerceroState = { error?: string } | undefined;

// spec_items_terceros_20260716_2.md: ítem genérico (producto o servicio de un
// tercero) que se agrega a CUALQUIER cotización, en cualquier familia. Margen
// neto fijo (15%/25% según tipo) no editable — se calcula solo, ya con el 7%
// de Noruega descontado (Art. 2 del contrato: el royalty aplica también acá).
// Solo mientras la cotización esté en Borrador — mismo criterio que editar.
export async function agregarItemTercero(_state: AgregarItemTerceroState, formData: FormData): Promise<AgregarItemTerceroState> {
  const session = await verifySession();
  const cotizacionId = String(formData.get('cotizacionId') || '').trim();
  const c = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!c) return { error: 'La cotización ya no existe.' };
  if (c.estado !== 'BORRADOR') {
    return { error: 'Solo se pueden agregar ítems de terceros mientras la cotización esté en Borrador.' };
  }

  const descripcionCliente = String(formData.get('descripcionCliente') || '').trim();
  if (!descripcionCliente) return { error: 'La descripción para el cliente es obligatoria.' };
  const notaInterna = String(formData.get('notaInterna') || '').trim() || null;
  const tipo = String(formData.get('tipo') || '') as TipoItemTercero;
  if (tipo !== 'PRODUCTO' && tipo !== 'SERVICIO') return { error: 'Tipo inválido.' };
  const costoReal = Number(formData.get('costoReal') || 0);
  if (costoReal <= 0) return { error: 'El costo real (lo que cobra el tercero) debe ser mayor a cero.' };

  const { parametros } = await getParametrosVigentes();
  const { margenNetoDeseado, precioVenta } = calcularItemTercero(parametros, { tipo, costoReal });

  // Nunca se absorbe el costo del tercero — regla de negocio explícita, no
  // debe existir la posibilidad de guardar un ítem a precio <= costo.
  if (precioVenta <= costoReal) {
    return { error: 'El precio de venta calculado no puede ser menor o igual al costo real — no se puede continuar.' };
  }

  await prisma.itemTercero.create({
    data: { cotizacionId, descripcionCliente, notaInterna, tipo, costoReal, margenNetoDeseado, precioVenta },
  });
  await prisma.auditoria.create({
    data: { cotizacionId, usuarioId: session.userId, accion: 'agrego_item_tercero', detalle: descripcionCliente },
  });
  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath(`/propuesta/${c.linkToken}`);
}

export async function eliminarItemTercero(itemId: string) {
  const session = await verifySession();
  const item = await prisma.itemTercero.findUnique({ where: { id: itemId }, include: { cotizacion: true } });
  if (!item) return;
  if (item.cotizacion.estado !== 'BORRADOR') {
    return { error: 'Solo se pueden quitar ítems de terceros mientras la cotización esté en Borrador.' };
  }
  await prisma.itemTercero.delete({ where: { id: itemId } });
  await prisma.auditoria.create({
    data: { cotizacionId: item.cotizacionId, usuarioId: session.userId, accion: 'quito_item_tercero', detalle: item.descripcionCliente },
  });
  revalidatePath(`/cotizaciones/${item.cotizacionId}`);
  revalidatePath(`/propuesta/${item.cotizacion.linkToken}`);
}
