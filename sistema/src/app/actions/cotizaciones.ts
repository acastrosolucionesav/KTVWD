'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { verifySession, requireRol } from '@/lib/dal';
import { getParametrosVigentes } from '@/lib/parametros';
import { calcularLavado, calcularInspeccion, calcularCareTodos, calcularDiasEjecucion, type NivelRecargo, type Superficie, type ConceptoLavado } from '@/lib/pricing';
import { generarIdTrazabilidad } from '@/lib/trazabilidad';
import { registrarPropuestaEnviada, registrarCotizacionCreada } from '@/lib/pipedrive';
import { enviarCorreoAprobacionPendiente } from '@/lib/email';

export type CrearPuntualState = { error?: string; ok?: boolean } | undefined;
export type CrearCareState = { error?: string; ok?: boolean } | undefined;

// ============================================================================
// Crear (o editar, si formData trae cotizacionId) cotización puntual (Familia 1).
// Aquí se calcula TODO (incluido fee y margen — Regla A no se aplica acá, se
// aplica en dto.ts al armar el documento de cliente). El comercial que llama
// esta acción SÍ puede crear la cotización aunque su rol nunca vea el
// desglose después.
//
// Edición: solo mientras la cotización esté en BORRADOR (nunca algo ya
// aprobado, rechazado o enviado a un cliente real) — evita que un comercial
// tenga que borrar y volver a crear por un dato mal digitado (m², días de
// Aerocivil, etc.).
// ============================================================================
export async function crearCotizacionPuntual(_state: CrearPuntualState, formData: FormData): Promise<CrearPuntualState> {
  const session = await verifySession();
  const { parametros, snapshotJson } = await getParametrosVigentes();

  const cotizacionExistenteId = String(formData.get('cotizacionId') || '').trim() || null;
  let existente: { clienteId: string; idTrazabilidad: string } | null = null;
  let anterior: { id: string; idTrazabilidad: string; clienteId: string } | null = null;
  if (cotizacionExistenteId) {
    const c = await prisma.cotizacion.findUnique({
      where: { id: cotizacionExistenteId },
      include: { versionNueva: { select: { idTrazabilidad: true } } },
    });
    if (!c) return { error: 'La cotización ya no existe.' };
    if (c.estado === 'BORRADOR') {
      existente = c;
    } else if (c.versionNueva) {
      return { error: `Esta cotización ya fue corregida — edite la versión nueva (${c.versionNueva.idTrazabilidad}).` };
    } else {
      // No editable en el mismo registro (ya enviada/aprobada/rechazada): se
      // corrige creando una versión nueva, ver bloque de corrección más abajo.
      anterior = c;
    }
  }

  const servicio = String(formData.get('servicio')) as 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
  const clienteNombre = String(formData.get('clienteNombre') || '').trim();
  const clienteContacto = String(formData.get('clienteContacto') || '').trim() || null;
  if (!clienteNombre) return { error: 'El nombre del cliente es obligatorio.' };
  const pipedriveDealId = String(formData.get('pipedriveDealId') || '').trim() || null;

  const incluyeLavado = servicio !== 'INSPECCION_SOLA';
  // Ítems de lavado seleccionables (spec_lavado_items_dias_20260717.md): mismo
  // precio por m², pero fachada y vidrios se capturan por separado — el
  // concepto decide qué área(s) se suman al precio y qué texto sale al cliente.
  const concepto = incluyeLavado ? (String(formData.get('concepto') || 'FACHADA_Y_VENTANAS') as ConceptoLavado) : null;
  const m2VidrioInput = Number(formData.get('m2Vidrio') || 0);
  const m2OpacaInput = Number(formData.get('m2Opaca') || 0);
  const m2Vidrio = concepto === 'SOLO_FACHADA' ? 0 : m2VidrioInput;
  const m2Opaca = concepto === 'SOLO_VENTANAS' ? 0 : m2OpacaInput;
  const m2 = m2Vidrio + m2Opaca;
  if (incluyeLavado && m2 <= 0) return { error: 'Ingrese el área a lavar (fachada y/o vidrios) según el concepto elegido.' };

  const techo = Number(formData.get('techo') || 0);
  if (servicio === 'INSPECCION_SOLA' && techo <= 0) {
    return { error: 'Ingrese el área de techo (m²) para cotizar el Diagnóstico Visual KTV.' };
  }

  const superficie = String(formData.get('superficie') || 'MIXTA') as Superficie;
  const tipoEdificio = String(formData.get('tipoEdificio') || 'BAJO') as NivelRecargo;
  const dificultad = String(formData.get('dificultad') || 'BAJO') as NivelRecargo;
  const mostrarInformeInternacional = formData.get('mostrarInformeInternacional') === 'on';
  const observaciones = String(formData.get('observaciones') || '').trim() || null;

  // Condiciones, permisos y plazos — texto libre que llena el comercial a
  // mano (varían por operación, no se calculan). Se muestran al cliente.
  const anticipoPct = formData.get('anticipoPct') ? Number(formData.get('anticipoPct')) : null;
  const saldoPct = formData.get('saldoPct') ? Number(formData.get('saldoPct')) : null;
  const condicionPagoNota = String(formData.get('condicionPagoNota') || '').trim() || null;
  const permisoAerocivil = String(formData.get('permisoAerocivil') || '').trim() || null;

  // Días de ejecución reales (spec_lavado_items_dias_20260717.md): el sistema
  // calcula con productividad real; aumentar es libre, reducir por debajo del
  // cálculo dispara aprobación de Gerencia (mismo mecanismo que el descuento).
  const diasEjecucionSistema = incluyeLavado ? calcularDiasEjecucion(parametros, { m2Vidrio, m2Opaca, dificultad }) : null;
  const diasEjecucionInput = formData.get('diasEjecucion') ? Number(formData.get('diasEjecucion')) : null;
  const diasEjecucion = incluyeLavado ? (diasEjecucionInput ?? diasEjecucionSistema!) : null;
  const requiereAprobacionPorDias = diasEjecucionSistema !== null && diasEjecucion !== null && diasEjecucion < diasEjecucionSistema;
  const ejecucionSitio = incluyeLavado
    ? `${diasEjecucion} día${diasEjecucion === 1 ? '' : 's'} hábil${diasEjecucion === 1 ? '' : 'es'}. Una vez aprobados permisos y recibido el anticipo.`
    : String(formData.get('ejecucionSitio') || '').trim() || null;

  // Descuento manual sobre el lavado (Gerencia 2026-07-17): cualquier valor
  // distinto de 0 dispara aprobación de Gerencia sin excepción, y nunca puede
  // bajar el margen general de la cotización de 35% — piso más estricto que
  // el de excepciones automáticas por dificultad/recargo.
  const descuentoPct = Number(formData.get('descuentoPct') || 0);
  if (descuentoPct < 0 || descuentoPct >= 100) return { error: 'El descuento debe estar entre 0% y 99%.' };

  const lavado = incluyeLavado
    ? calcularLavado(parametros, { m2, superficie, tipoEdificio, dificultad, movilizacion: 0, comisionPct: 0.05, descuentoPct })
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

  if (descuentoPct > 0 && margenP < 0.35) {
    return { error: `Con este descuento el margen queda en ${(margenP * 100).toFixed(1)}% — por debajo del mínimo permitido (35%) para descuentos manuales. Reduzca el descuento.` };
  }
  const requiereAprobacion = descuentoPct > 0 || requiereAprobacionPorDias ? true : margenP < parametros.MARGEN_MINIMO;

  const puntualData = {
    servicio,
    tipoInformeBase,
    mostrarInformeInternacional,
    m2Fachada: incluyeLavado ? m2 : null,
    concepto,
    m2Vidrio: incluyeLavado ? m2Vidrio : null,
    m2Opaca: incluyeLavado ? m2Opaca : null,
    superficie: incluyeLavado ? superficie : null,
    tipoEdificio: incluyeLavado ? tipoEdificio : null,
    dificultad: incluyeLavado ? dificultad : null,
    rangoTecho: techo || null,
    diasOperacion: (lavado?.dias ?? 0) + (servicio !== 'SOLO_LAVADO' ? insp.diasOperacionInsp : 0),
    costoOperacion: costoOperacionTotal,
    feeNoruega: feeNoruegaTotal,
    margenPct: margenP,
    descuentoPct: incluyeLavado && descuentoPct > 0 ? descuentoPct : null,
    precioLavadoSinDescuento: lavado?.precioListaSinDescuento ?? null,
    precioLavado,
    precioInformeBase,
    precioInformeAdicional,
    anticipoPct,
    saldoPct,
    condicionPagoNota,
    permisoAerocivil,
    diasEjecucionSistema,
    diasEjecucion,
    ejecucionSitio,
  };

  if (existente) {
    await prisma.clienteProspecto.update({
      where: { id: existente.clienteId },
      data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
    });
    await prisma.cotizacion.update({
      where: { id: cotizacionExistenteId! },
      data: {
        estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
        requiereAprobacion,
        snapshotParametros: snapshotJson,
        totalCliente,
        observaciones,
        puntual: { update: puntualData },
      },
    });
    await prisma.auditoria.create({ data: { cotizacionId: cotizacionExistenteId!, usuarioId: session.userId, accion: 'edito' } });
    if (requiereAprobacion) {
      await enviarCorreoAprobacionPendiente({
        idTrazabilidad: existente.idTrazabilidad,
        clienteNombre,
        margenPct: margenP,
        urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cotizaciones/${cotizacionExistenteId}`,
      }).catch((e) => console.error('Error enviando alerta de aprobación', e));
    }
    revalidatePath('/cotizaciones');
    revalidatePath(`/cotizaciones/${cotizacionExistenteId}`);
    redirect(`/cotizaciones/${cotizacionExistenteId}`);
  }

  // Corrección de una cotización ya enviada/aprobada/rechazada: se reutiliza
  // el mismo cliente, pero se crea una cotización NUEVA (versión) — nunca se
  // edita el registro original, que queda con linkActivo:false para que el
  // cliente no siga viendo el número viejo/equivocado.
  const clienteId = anterior
    ? (await prisma.clienteProspecto.update({
        where: { id: anterior.clienteId },
        data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
      })).id
    : (await prisma.clienteProspecto.create({
        data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
      })).id;

  const vigenteHasta = new Date();
  vigenteHasta.setDate(vigenteHasta.getDate() + 30);

  const cotizacion = await prisma.cotizacion.create({
    data: {
      idTrazabilidad: generarIdTrazabilidad(),
      familia: 'PUNTUAL',
      clienteId,
      creadoPorId: session.userId,
      estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
      requiereAprobacion,
      vigenteHasta,
      snapshotParametros: snapshotJson,
      totalCliente,
      observaciones,
      versionAnteriorId: anterior?.id,
      puntual: { create: puntualData },
      auditorias: { create: { usuarioId: session.userId, accion: anterior ? 'creo_correccion' : 'creo' } },
    },
  });

  if (anterior) {
    await prisma.cotizacion.update({ where: { id: anterior.id }, data: { linkActivo: false } });
    await prisma.auditoria.create({
      data: { cotizacionId: anterior.id, usuarioId: session.userId, accion: 'corrigio', detalle: cotizacion.idTrazabilidad },
    });
    revalidatePath(`/cotizaciones/${anterior.id}`);
  }

  if (requiereAprobacion) {
    await enviarCorreoAprobacionPendiente({
      idTrazabilidad: cotizacion.idTrazabilidad,
      clienteNombre,
      margenPct: margenP,
      urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cotizaciones/${cotizacion.id}`,
    }).catch((e) => console.error('Error enviando alerta de aprobación', e));
  }

  // Viaje de vuelta a Pipedrive: nota en el trato + link de la propuesta en
  // el campo "Cotizador". Nunca bloquea la creación si Pipedrive falla.
  if (pipedriveDealId) {
    await registrarCotizacionCreada(Number(pipedriveDealId), {
      idTrazabilidad: cotizacion.idTrazabilidad,
      clienteNombre,
      urlPropuesta: `${process.env.NEXT_PUBLIC_APP_URL || ''}/propuesta/${cotizacion.linkToken}`,
      familia: 'PUNTUAL',
      requiereAprobacion,
    }).catch((e) => console.error('Pipedrive: error registrando cotización creada', e));
  }

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
  // Por seguridad se desactiva también el link público (nunca debió estar
  // activo — "Marcar como enviada" no aplica a PENDIENTE_APROBACION/RECHAZADA
  // — pero así queda cerrado incluso si el estado cambiara por otra vía).
  // Se reactiva con el mismo botón "Reactivar link" del detalle si se reconsidera.
  await prisma.cotizacion.update({ where: { id: cotizacionId }, data: { estado: 'RECHAZADA', linkActivo: false } });
  await prisma.auditoria.create({ data: { cotizacionId, usuarioId: session.userId, accion: 'rechazo' } });
  revalidatePath(`/cotizaciones/${cotizacionId}`);
  revalidatePath('/cotizaciones');
}

export async function marcarEnviada(cotizacionId: string) {
  const session = await verifySession();
  const c = await prisma.cotizacion.update({
    where: { id: cotizacionId },
    data: { estado: 'ENVIADA', enviadoAt: new Date() },
    include: { cliente: true, itemsTerceros: true },
  });
  await prisma.auditoria.create({ data: { cotizacionId, usuarioId: session.userId, accion: 'envio' } });
  revalidatePath(`/cotizaciones/${cotizacionId}`);

  // Integración Pipedrive: si la cotización quedó vinculada a un trato, se
  // registra la nota + valor + cambio de etapa. Nunca bloquea el envío real
  // de la propuesta si Pipedrive falla o no está configurado.
  if (c.cliente.pipedriveDealId) {
    // Familia 1: el total único ya incluye los ítems de terceros (mismo
    // criterio que el DTO de cliente y el panel interno) — Care no, ahí se
    // muestran aparte del valor anual recurrente del plan.
    const sumaItemsTerceros = c.itemsTerceros.reduce((s, it) => s + it.precioVenta, 0);
    const valor = c.familia === 'PUNTUAL' ? c.totalCliente + sumaItemsTerceros : c.totalCliente;
    const urlPropuesta = `${process.env.NEXT_PUBLIC_APP_URL || ''}/propuesta/${c.linkToken}`;
    await registrarPropuestaEnviada(Number(c.cliente.pipedriveDealId), {
      urlPropuesta, valor, familia: c.familia,
    }).catch((e) => console.error('Pipedrive: error registrando propuesta enviada', e));
  }
}

// ============================================================================
// Aceptación del cliente — dispara la Orden de Servicio interna SIN CIFRAS
// (KWD-SIS-PROMPT-001 v2). Esta acción la invoca la página pública /propuesta.
// ============================================================================
export async function aceptarPropuesta(linkToken: string) {
  const c = await prisma.cotizacion.findUnique({ where: { linkToken } });
  if (!c || !c.linkActivo || c.aceptadaPorCliente) return; // link desactivado = no se puede aceptar
  // Vencida: pasada la fecha de vigencia y aún sin aceptar, no se puede aceptar
  // (guard de servidor — un link viejo/cacheado no debe poder colarse). Gerencia
  // puede extender la vigencia si el cliente pide más plazo.
  if (c.vigenteHasta && c.vigenteHasta < new Date()) return;

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
  revalidatePath(`/propuesta/${linkToken}`);
  revalidatePath('/cotizaciones');
}

// Módulo 2 — activar/desactivar el link público de una propuesta. Cualquier
// usuario del sistema puede hacerlo (queda en auditoría quién y cuándo).
export async function toggleLinkPropuesta(cotizacionId: string) {
  const session = await verifySession();
  const c = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!c) return;
  await prisma.cotizacion.update({ where: { id: c.id }, data: { linkActivo: !c.linkActivo } });
  await prisma.auditoria.create({
    data: { cotizacionId: c.id, usuarioId: session.userId, accion: c.linkActivo ? 'desactivo_link' : 'reactivo_link' },
  });
  revalidatePath(`/cotizaciones/${c.id}`);
  revalidatePath(`/propuesta/${c.linkToken}`);
}

// Extender la vigencia 30 días más desde hoy — para cuando el cliente pide más
// plazo y la propuesta ya venció (o está por vencer). Reactiva el link por si
// estaba desactivado. Cualquier usuario del sistema puede hacerlo; queda auditado.
export async function extenderVigencia(cotizacionId: string) {
  const session = await verifySession();
  const c = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!c) return;
  const nuevaVigencia = new Date();
  nuevaVigencia.setDate(nuevaVigencia.getDate() + 30);
  await prisma.cotizacion.update({ where: { id: c.id }, data: { vigenteHasta: nuevaVigencia, linkActivo: true } });
  await prisma.auditoria.create({ data: { cotizacionId: c.id, usuarioId: session.userId, accion: 'extendio_vigencia' } });
  revalidatePath(`/cotizaciones/${c.id}`);
  revalidatePath(`/propuesta/${c.linkToken}`);
}

// Borrado — solo GERENCIA, solo mientras esté en BORRADOR (nunca algo que ya
// se le mostró o envió a un cliente real, para no perder trazabilidad).
export async function eliminarCotizacion(cotizacionId: string) {
  await requireRol('GERENCIA');
  const c = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!c) return { error: 'La cotización ya no existe.' };
  if (c.estado !== 'BORRADOR') {
    return { error: 'Solo se pueden borrar cotizaciones en estado Borrador — esta ya fue aprobada, rechazada o enviada.' };
  }
  await prisma.cotizacion.delete({ where: { id: cotizacionId } });
  revalidatePath('/cotizaciones');
}

// ============================================================================
// Crear (o editar, si formData trae cotizacionId) cotización Care (Familia 2 —
// programa recurrente). Tabla SEPARADA de CotizacionPuntual, tal como exige
// KWD-SIS-PROMPT-001 v2: nunca se mezclan los datos de las 2 familias.
//
// Edición: solo mientras la cotización esté en BORRADOR — mismo criterio que
// crearCotizacionPuntual.
// ============================================================================
export async function crearCotizacionCare(_state: CrearCareState, formData: FormData): Promise<CrearCareState> {
  const session = await verifySession();
  const { parametros, snapshotJson } = await getParametrosVigentes();

  const cotizacionExistenteId = String(formData.get('cotizacionId') || '').trim() || null;
  let existente: { clienteId: string; idTrazabilidad: string } | null = null;
  let anterior: { id: string; idTrazabilidad: string; clienteId: string } | null = null;
  if (cotizacionExistenteId) {
    const c = await prisma.cotizacion.findUnique({
      where: { id: cotizacionExistenteId },
      include: { versionNueva: { select: { idTrazabilidad: true } } },
    });
    if (!c) return { error: 'La cotización ya no existe.' };
    if (c.estado === 'BORRADOR') {
      existente = c;
    } else if (c.versionNueva) {
      return { error: `Esta cotización ya fue corregida — edite la versión nueva (${c.versionNueva.idTrazabilidad}).` };
    } else {
      anterior = c;
    }
  }

  const planRecomendado = String(formData.get('plan')) as 'INSPECT' | 'ESSENTIAL' | 'COMPLETE';
  const clienteNombre = String(formData.get('clienteNombre') || '').trim();
  const clienteContacto = String(formData.get('clienteContacto') || '').trim() || null;
  if (!clienteNombre) return { error: 'El nombre del cliente es obligatorio.' };
  const pipedriveDealId = String(formData.get('pipedriveDealId') || '').trim() || null;

  // Los 3 paquetes se cotizan siempre juntos, así que el área de fachada es
  // obligatoria aunque el plan destacado sea Inspect (Essential/Complete la necesitan).
  const m2 = Number(formData.get('m2') || 0);
  if (m2 <= 0) return { error: 'Ingrese el área de fachada (m²) — se usa para calcular Essential y Complete.' };

  const techo = Number(formData.get('techo') || 0);
  const contratoAnios = Number(formData.get('contratoAnios') || 1);
  const formaPago = String(formData.get('formaPago') || 'CONTADO') as 'CONTADO' | 'DIFERIDO_12';
  const observaciones = String(formData.get('observaciones') || '').trim() || null;

  // Mismas variables de recargo que Familia 1 — corrección 2026-07-16, antes
  // calcularCare siempre asumía MIXTA/BAJO/BAJO sin importar el edificio real.
  const superficie = String(formData.get('superficie') || 'MIXTA') as Superficie;
  const tipoEdificio = String(formData.get('tipoEdificio') || 'BAJO') as NivelRecargo;
  const dificultad = String(formData.get('dificultad') || 'BAJO') as NivelRecargo;

  const todos = calcularCareTodos(parametros, { m2, techo, superficie, tipoEdificio, dificultad });
  // Semáforo de margen (spec_calcularCare.md 2026-07-14): bajo 35% requiere aprobación
  // de Gerencia (igual que Familia 1); bajo 25% es un piso absoluto — ni Gerencia puede
  // enviarla, hay que ajustar parámetros o alcance primero. Para Complete, el margen de
  // CADA año de contrato cuenta (el peor de los 3, nunca un promedio que esconda el año 1).
  const margenesMinimos = Object.values(todos).map((t) => t.margenP);
  if (margenesMinimos.some((m) => m < 0.25)) {
    return { error: 'El margen de esta cotización cae por debajo del mínimo absoluto (25%) en al menos un paquete o año de contrato. No se puede generar — ajuste los parámetros o el alcance antes de continuar.' };
  }
  const requiereAprobacion = margenesMinimos.some((m) => m < parametros.MARGEN_MINIMO);

  const careData = {
    planRecomendado, contratoAnios, formaPago, m2Fachada: m2, rangoTecho: techo || null,
    superficie, tipoEdificio, dificultad,
    valorAnualInspect: todos.INSPECT.valorAnual, valorMensualInspect: todos.INSPECT.valorMensual,
    valorAnualEssential: todos.ESSENTIAL.valorAnual, valorMensualEssential: todos.ESSENTIAL.valorMensual,
    valorAnualComplete: todos.COMPLETE.valorAnual, valorMensualComplete: todos.COMPLETE.valorMensual,
  };

  if (existente) {
    await prisma.clienteProspecto.update({
      where: { id: existente.clienteId },
      data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
    });
    await prisma.cotizacion.update({
      where: { id: cotizacionExistenteId! },
      data: {
        estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
        requiereAprobacion,
        snapshotParametros: snapshotJson,
        totalCliente: todos[planRecomendado].valorAnual,
        observaciones,
        care: { update: careData },
      },
    });
    await prisma.auditoria.create({ data: { cotizacionId: cotizacionExistenteId!, usuarioId: session.userId, accion: 'edito' } });
    if (requiereAprobacion) {
      await enviarCorreoAprobacionPendiente({
        idTrazabilidad: existente.idTrazabilidad,
        clienteNombre,
        margenPct: Math.min(...margenesMinimos),
        urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cotizaciones/${cotizacionExistenteId}`,
      }).catch((e) => console.error('Error enviando alerta de aprobación', e));
    }
    revalidatePath('/cotizaciones');
    revalidatePath(`/cotizaciones/${cotizacionExistenteId}`);
    redirect(`/cotizaciones/${cotizacionExistenteId}`);
  }

  // Corrección — mismo mecanismo que Familia 1: se reutiliza el cliente, se
  // crea una versión nueva, y el registro original queda con linkActivo:false.
  const clienteId = anterior
    ? (await prisma.clienteProspecto.update({
        where: { id: anterior.clienteId },
        data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId },
      })).id
    : (await prisma.clienteProspecto.create({ data: { nombre: clienteNombre, contacto: clienteContacto, pipedriveDealId } })).id;
  const vigenteHasta = new Date();
  vigenteHasta.setDate(vigenteHasta.getDate() + 30);

  const cotizacion = await prisma.cotizacion.create({
    data: {
      idTrazabilidad: generarIdTrazabilidad(),
      familia: 'CARE',
      clienteId,
      creadoPorId: session.userId,
      estado: requiereAprobacion ? 'PENDIENTE_APROBACION' : 'BORRADOR',
      requiereAprobacion,
      vigenteHasta,
      snapshotParametros: snapshotJson,
      totalCliente: todos[planRecomendado].valorAnual,
      observaciones,
      versionAnteriorId: anterior?.id,
      care: { create: careData },
      auditorias: { create: { usuarioId: session.userId, accion: anterior ? 'creo_correccion' : 'creo' } },
    },
  });

  if (anterior) {
    await prisma.cotizacion.update({ where: { id: anterior.id }, data: { linkActivo: false } });
    await prisma.auditoria.create({
      data: { cotizacionId: anterior.id, usuarioId: session.userId, accion: 'corrigio', detalle: cotizacion.idTrazabilidad },
    });
    revalidatePath(`/cotizaciones/${anterior.id}`);
  }

  if (requiereAprobacion) {
    await enviarCorreoAprobacionPendiente({
      idTrazabilidad: cotizacion.idTrazabilidad,
      clienteNombre,
      margenPct: Math.min(...margenesMinimos),
      urlDetalle: `${process.env.NEXT_PUBLIC_APP_URL || ''}/cotizaciones/${cotizacion.id}`,
    }).catch((e) => console.error('Error enviando alerta de aprobación', e));
  }

  // Viaje de vuelta a Pipedrive — mismo mecanismo que Familia 1.
  if (pipedriveDealId) {
    await registrarCotizacionCreada(Number(pipedriveDealId), {
      idTrazabilidad: cotizacion.idTrazabilidad,
      clienteNombre,
      urlPropuesta: `${process.env.NEXT_PUBLIC_APP_URL || ''}/propuesta/${cotizacion.linkToken}`,
      familia: 'CARE',
      requiereAprobacion,
    }).catch((e) => console.error('Pipedrive: error registrando cotización Care creada', e));
  }

  revalidatePath('/cotizaciones');
  redirect(`/cotizaciones/${cotizacion.id}`);
}
