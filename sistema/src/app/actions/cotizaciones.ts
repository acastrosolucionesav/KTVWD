'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { verifySession, requireRol } from '@/lib/dal';
import { getParametrosVigentes } from '@/lib/parametros';
import { calcularLavado, calcularInspeccion, calcularCare, type NivelRecargo, type Superficie } from '@/lib/pricing';
import { generarIdTrazabilidad } from '@/lib/trazabilidad';

export type CrearPuntualState = { error?: string; ok?: boolean } | undefined;
export type CrearCareState = { error?: string; ok?: boolean } | undefined;

// ============================================================================
// Crear cotización puntual (Familia 1). Aquí se calcula TODO (incluido fee y
// margen — Regla A no se aplica acá, se aplica en dto.ts al armar el
// documento de cliente). El comercial que llama esta acción SÍ puede crear
// la cotización aunque su rol nunca vea el desglose después.
// ============================================================================
export async function crearCotizacionPuntual(_state: CrearPuntualState, formData: FormData): Promise<CrearPuntualState> {
  const session = await verifySession();
  const { parametros, snapshotJson } = await getParametrosVigentes();

  const servicio = String(formData.get('servicio')) as 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
  const clienteNombre = String(formData.get('clienteNombre') || '').trim();
  const clienteContacto = String(formData.get('clienteContacto') || '').trim() || null;
  if (!clienteNombre) return { error: 'El nombre del cliente es obligatorio.' };

  const incluyeLavado = servicio !== 'INSPECCION_SOLA';
  const m2 = Number(formData.get('m2') || 0);
  if (incluyeLavado && m2 <= 0) return { error: 'Ingrese el área de fachada (m²) para el lavado.' };

  const techo = Number(formData.get('techo') || 0);
  if (servicio === 'INSPECCION_SOLA' && techo <= 0) {
    return { error: 'Ingrese el área de techo (m²) para cotizar el Diagnóstico Visual KTV.' };
  }

  const superficie = String(formData.get('superficie') || 'MIXTA') as Superficie;
  const tipoEdificio = String(formData.get('tipoEdificio') || 'BAJO') as NivelRecargo;
  const dificultad = String(formData.get('dificultad') || 'BAJO') as NivelRecargo;
  const mostrarInformeInternacional = formData.get('mostrarInformeInternacional') === 'on';
  const observaciones = String(formData.get('observaciones') || '').trim() || null;

  const lavado = incluyeLavado
    ? calcularLavado(parametros, { m2, superficie, tipoEdificio, dificultad, movilizacion: 0, comisionPct: 0.05 })
    : null;
  const insp = calcularInspeccion(parametros, techo);

  // --- Regla de producto (KWD-SIS-PROMPT-001 v2) ---
  // INSPECCION_SOLA: base = Diagnóstico Visual (cobrado, no hay lavado con qué regalarlo).
  // LAVADO_MAS_INSPECCION: base = Diagnóstico Visual (gratis, gancho).
  // SOLO_LAVADO: sin informe base.
  let tipoInformeBase: 'DIAGNOSTICO_VISUAL' | 'INTERNACIONAL' | null = null;
  let precioInformeBase: number | null = null;
  if (servicio !== 'SOLO_LAVADO') {
    tipoInformeBase = 'DIAGNOSTICO_VISUAL';
    precioInformeBase = insp.dvPrecio;
  }
  const precioInformeAdicional = mostrarInformeInternacional && insp.precioInternacional !== null
    ? insp.precioInternacional
    : null;

  const precioLavado = lavado ? lavado.precioLavado : null;
  const totalCliente = (precioLavado ?? 0)
    + (servicio === 'INSPECCION_SOLA' ? (precioInformeBase ?? 0) : 0); // el DV gratis en combo no suma al total

  // ------------------------------------------------------------------------
  // Costo y margen REALES del trato. Cuando el Diagnóstico Visual va de regalo
  // (LAVADO_MAS_INSPECCION), al cliente no se le cobra — pero SÍ nos cuesta
  // producirlo (dron + cuadrilla), y ese costo se absorbe aquí para que el
  // margen reportado no quede inflado: "se lo regalamos al cliente, pero
  // internamente sí lo costeamos para no perder margen sin darnos cuenta".
  // ------------------------------------------------------------------------
  let costoOperacionTotal: number;
  let feeNoruegaTotal: number;
  let comisionTotal: number;
  if (servicio === 'SOLO_LAVADO') {
    costoOperacionTotal = lavado!.costoOperacion;
    feeNoruegaTotal = lavado!.feeNoruega;
    comisionTotal = lavado!.comision;
  } else if (servicio === 'LAVADO_MAS_INSPECCION') {
    costoOperacionTotal = lavado!.costoOperacion + insp.costoOperacionInsp; // + costo del DV regalado
    feeNoruegaTotal = lavado!.feeNoruega; // el DV gratis no factura, no genera fee sobre esa parte
    comisionTotal = lavado!.comision;
  } else {
    // INSPECCION_SOLA: el DV se cobra, su propio costo/fee ya vienen de calcularInspeccion
    costoOperacionTotal = insp.costoOperacionInsp;
    feeNoruegaTotal = insp.dvPrecio * parametros.FEE_NORUEGA;
    comisionTotal = 0;
  }
  const costoTotalTrato = costoOperacionTotal + feeNoruegaTotal + comisionTotal;
  const margenD = totalCliente - costoTotalTrato;
  const margenP = totalCliente > 0 ? margenD / totalCliente : 0;
  const requiereAprobacion = margenP < parametros.MARGEN_MINIMO;

  const cliente = await prisma.clienteProspecto.create({
    data: { nombre: clienteNombre, contacto: clienteContacto },
  });

  const vigenteHasta = new Date();
  vigenteHasta.setDate(vigenteHasta.getDate() + 30);

  const cotizacion = await prisma.cotizacion.create({
    data: {
      idTrazabilidad: generarIdTrazabilidad(),
      familia: 'PUNTUAL',
      clienteId: cliente.id,
      creadoPorId: session.userId,
      estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
      requiereAprobacion,
      vigenteHasta,
      snapshotParametros: snapshotJson,
      totalCliente,
      observaciones,
      puntual: {
        create: {
          servicio,
          tipoInformeBase,
          mostrarInformeInternacional,
          m2Fachada: incluyeLavado ? m2 : null,
          superficie: incluyeLavado ? superficie : null,
          tipoEdificio: incluyeLavado ? tipoEdificio : null,
          dificultad: incluyeLavado ? dificultad : null,
          rangoTecho: techo || null,
          diasOperacion: (lavado?.dias ?? 0) + (servicio !== 'SOLO_LAVADO' ? insp.diasOperacionInsp : 0),
          costoOperacion: costoOperacionTotal,
          feeNoruega: feeNoruegaTotal,
          margenPct: margenP,
          precioLavado,
          precioInformeBase,
          precioInformeAdicional,
        },
      },
      auditorias: { create: { usuarioId: session.userId, accion: 'creo' } },
    },
  });

  revalidatePath('/cotizaciones');
  redirect(`/cotizaciones/${cotizacion.id}`);
}

export async function aprobarCotizacion(cotizacionId: string) {
  const session = await requireRol('GERENCIA');
  await prisma.cotizacion.update({
    where: { id: cotizacionId },
    data: { estado: 'APROBADA', aprobadoPorId: session.userId, aprobadoAt: new Date() },
  });
  await prisma.auditoria.create({ data: { cotizacionId, usuarioId: session.userId, accion: 'aprobo' } });
  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath('/cotizaciones');
}

export async function rechazarCotizacion(cotizacionId: string) {
  const session = await requireRol('GERENCIA');
  await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { estado: 'RECHAZADA' } });
  await prisma.auditoria.create({ data: { cotizacionId, usuarioId: session.userId, accion: 'rechazo' } });
  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath('/cotizaciones');
}

export async function marcarEnviada(cotizacionId: string) {
  const session = await verifySession();
  await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { estado: 'ENVIADA', enviadoAt: new Date() } });
  await prisma.auditoria.create({ data: { cotizacionId, usuarioId: session.userId, accion: 'envio' } });
  revalidatePath(`/cotizaciones/${cotizacionId}`);
}

// ============================================================================
// Aceptación del cliente — dispara la Orden de Servicio interna SIN CIFRAS
// (KWD-SIS-PROMPT-001 v2). Esta acción la invoca la página pública /propuesta.
// ============================================================================
export async function aceptarPropuesta(idTrazabilidad: string) {
  const c = await prisma.cotizacion.findUnique({ where: { idTrazabilidad } });
  if (!c || c.aceptadaPorCliente) return;

  await prisma.$transaction([
    prisma.cotizacion.update({
      where: { id: c.id },
      data: { aceptadaPorCliente: true, aceptadaAt: new Date() },
    }),
    prisma.ordenServicio.create({
      data: { cotizacionId: c.id, anticipoConfirmado: false },
    }),
    prisma.auditoria.create({
      data: { cotizacionId: c.id, usuarioId: c.creadoPorId, accion: 'acepto_cliente', detalle: 'Aceptada desde el link público de la propuesta' },
    }),
  ]);
  revalidatePath(`/propuesta/${idTrazabilidad}`);
  revalidatePath('/cotizaciones');
}

// ============================================================================
// Crear cotización Care (Familia 2 — programa recurrente). Tabla SEPARADA de
// CotizacionPuntual, tal como exige KWD-SIS-PROMPT-001 v2: nunca se mezclan
// los datos de las 2 familias.
// ============================================================================
export async function crearCotizacionCare(_state: CrearCareState, formData: FormData): Promise<CrearCareState> {
  const session = await verifySession();
  const { parametros, snapshotJson } = await getParametrosVigentes();

  const plan = String(formData.get('plan')) as 'INSPECT' | 'ESSENTIAL' | 'COMPLETE';
  const clienteNombre = String(formData.get('clienteNombre') || '').trim();
  const clienteContacto = String(formData.get('clienteContacto') || '').trim() || null;
  if (!clienteNombre) return { error: 'El nombre del cliente es obligatorio.' };

  const m2 = Number(formData.get('m2') || 0);
  if (plan !== 'INSPECT' && m2 <= 0) return { error: 'Ingrese el área de fachada (m²) para las lavadas del plan.' };

  const techo = Number(formData.get('techo') || 0);
  const contratoAnios = Number(formData.get('contratoAnios') || 1);
  const formaPago = String(formData.get('formaPago') || 'CONTADO') as 'CONTADO' | 'DIFERIDO_12';
  const observaciones = String(formData.get('observaciones') || '').trim() || null;

  const { valorAnual, valorMensual } = calcularCare(parametros, { plan, m2, techo });

  const cliente = await prisma.clienteProspecto.create({ data: { nombre: clienteNombre, contacto: clienteContacto } });
  const vigenteHasta = new Date();
  vigenteHasta.setDate(vigenteHasta.getDate() + 30);

  const cotizacion = await prisma.cotizacion.create({
    data: {
      idTrazabilidad: generarIdTrazabilidad(),
      familia: 'CARE',
      clienteId: cliente.id,
      creadoPorId: session.userId,
      estado: 'BORRADOR',
      requiereAprobacion: false,
      vigenteHasta,
      snapshotParametros: snapshotJson,
      totalCliente: valorAnual,
      observaciones,
      care: {
        create: { plan, contratoAnios, formaPago, m2Fachada: m2 || null, rangoTecho: techo || null, valorAnual, valorMensual },
      },
      auditorias: { create: { usuarioId: session.userId, accion: 'creo' } },
    },
  });

  revalidatePath('/cotizaciones');
  redirect(`/cotizaciones/${cotizacion.id}`);
}
