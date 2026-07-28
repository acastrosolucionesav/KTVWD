'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { verifySession, requireRol } from '@/lib/dal';
import { getParametrosVigentes } from '@/lib/parametros';
import { calcularLavadoMultiItem, calcularInspeccion, calcularCareTodos, descuentoVolumen, type NivelRecargo, type Superficie, type ConceptoLavado, type Parametros } from '@/lib/pricing';
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
type PuntualData = {
  servicio: 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
  tipoInformeBase: 'DIAGNOSTICO_VISUAL' | 'INTERNACIONAL' | null;
  mostrarInformeInternacional: boolean;
  m2Fachada: number | null;
  rangoTecho: number | null;
  diasOperacion: number;
  costoOperacion: number;
  feeNoruega: number;
  margenPct: number;
  descuentoPct: number | null;
  precioLavadoSinDescuento: number | null;
  precioLavado: number | null;
  precioInformeBase: number | null;
  precioInformeAdicional: number | null;
  anticipoPct: number | null;
  saldoPct: number | null;
  condicionPagoNota: string | null;
  permisoAerocivil: string | null;
  diasEjecucionSistema: number | null;
  diasEjecucion: number | null;
  ejecucionSitio: string | null;
};
type ItemLavadoData = {
  orden: number; nombre: string; concepto: ConceptoLavado;
  m2Vidrio: number; m2Opaca: number; superficie: Superficie; tipoEdificio: NivelRecargo; dificultad: NivelRecargo;
  costoOperacion: number; feeNoruega: number; precioLavado: number; diasEjecucionSistema: number;
};
type ResultadoPuntual =
  | { error: string }
  | {
      error?: undefined;
      clienteNombre: string; clienteContacto: string | null; pipedriveDealId: string | null;
      observaciones: string | null; totalCliente: number; margenP: number; requiereAprobacion: boolean;
      puntualData: PuntualData; itemsLavadoData: ItemLavadoData[];
    };

// Cálculo y validación PUROS de una cotización puntual — no toca la base de
// datos. Es la ÚNICA fuente de verdad del número: crearCotizacionPuntual la usa
// justo antes de persistir, y previsualizarPuntual la usa solo para mostrarle el
// precio al comercial sin guardar nada. Así lo que se previsualiza es EXACTO lo
// que se termina guardando — nunca dos fórmulas que se puedan desalinear.
function computarPuntual(formData: FormData, parametros: Parametros): ResultadoPuntual {
  const servicio = String(formData.get('servicio')) as 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
  const clienteNombre = String(formData.get('clienteNombre') || '').trim();
  const clienteContacto = String(formData.get('clienteContacto') || '').trim() || null;
  if (!clienteNombre) return { error: 'El nombre del cliente es obligatorio.' };
  const pipedriveDealId = String(formData.get('pipedriveDealId') || '').trim() || null;

  const incluyeLavado = servicio !== 'INSPECCION_SOLA';
  // Múltiples ítems de lavado por cotización (spec_multi_item_lavado_20260722.md):
  // un cliente puede pedir varios edificios/superficies distintos en un solo
  // documento (ej. torre + fachada Alucobond + letreros). Cada fila del
  // formulario llega como una posición más en estos arreglos paralelos (mismo
  // orden que se renderizaron los inputs — ver CotizadorForm).
  const itemNombres = formData.getAll('itemNombre').map((v) => String(v).trim());
  const itemConceptos = formData.getAll('itemConcepto').map((v) => String(v) as ConceptoLavado);
  const itemM2VidrioInput = formData.getAll('itemM2Vidrio').map((v) => Number(v) || 0);
  const itemM2OpacaInput = formData.getAll('itemM2Opaca').map((v) => Number(v) || 0);
  const itemSuperficies = formData.getAll('itemSuperficie').map((v) => String(v) as Superficie);
  const itemTiposEdificio = formData.getAll('itemTipoEdificio').map((v) => String(v) as NivelRecargo);
  const itemDificultades = formData.getAll('itemDificultad').map((v) => String(v) as NivelRecargo);

  const itemsLavadoInput = incluyeLavado
    ? itemNombres.map((nombre, i) => {
        const concepto = itemConceptos[i] ?? 'FACHADA_Y_VENTANAS';
        const m2Vidrio = concepto === 'SOLO_FACHADA' ? 0 : itemM2VidrioInput[i] ?? 0;
        const m2Opaca = concepto === 'SOLO_VENTANAS' ? 0 : itemM2OpacaInput[i] ?? 0;
        return {
          nombre,
          concepto,
          m2Vidrio, m2Opaca,
          superficie: itemSuperficies[i] ?? 'MIXTA',
          tipoEdificio: itemTiposEdificio[i] ?? 'BAJO',
          dificultad: itemDificultades[i] ?? 'BAJO',
        };
      })
    : [];
  if (incluyeLavado && itemsLavadoInput.length === 0) return { error: 'Agregue al menos un ítem de lavado (edificio, fachada o superficie a cotizar).' };
  for (const it of itemsLavadoInput) {
    if (!it.nombre) return { error: 'Cada ítem de lavado necesita un nombre visible para el cliente (ej. "Torre 14 pisos").' };
    if (it.m2Vidrio + it.m2Opaca <= 0) return { error: `Ingrese el área a lavar de "${it.nombre}" (fachada y/o vidrios) según el concepto elegido.` };
  }
  const m2 = itemsLavadoInput.reduce((s, it) => s + it.m2Vidrio + it.m2Opaca, 0);

  const techo = Number(formData.get('techo') || 0);
  if (servicio === 'INSPECCION_SOLA' && techo <= 0) {
    return { error: 'Ingrese el área de techo (m²) para cotizar el Diagnóstico Visual KTV.' };
  }

  const mostrarInformeInternacional = formData.get('mostrarInformeInternacional') === 'on';
  const observaciones = String(formData.get('observaciones') || '').trim() || null;

  // Condiciones, permisos y plazos — texto libre que llena el comercial a
  // mano (varían por operación, no se calculan). Se muestran al cliente.
  const anticipoPct = formData.get('anticipoPct') ? Number(formData.get('anticipoPct')) : null;
  const saldoPct = formData.get('saldoPct') ? Number(formData.get('saldoPct')) : null;
  const condicionPagoNota = String(formData.get('condicionPagoNota') || '').trim() || null;
  const permisoAerocivil = String(formData.get('permisoAerocivil') || '').trim() || null;

  // Descuento manual sobre el lavado (Gerencia 2026-07-17): cualquier valor
  // distinto de 0 dispara aprobación de Gerencia sin excepción, y nunca puede
  // bajar el margen general de la cotización de 35%. Se aplica sobre el TOTAL
  // del proyecto (todos los ítems), no por ítem individual.
  const descuentoManualPct = Number(formData.get('descuentoPct') || 0);
  if (descuentoManualPct < 0 || descuentoManualPct >= 100) return { error: 'El descuento debe estar entre 0% y 99%.' };

  // Descuento por volumen (spec_reestructuracion_care_20260723.md): automático
  // según el total de m² de fachada de todos los ítems, sobre la tarifa de
  // lista. NO se multiplica con el descuento manual: se aplica el MAYOR de los
  // dos. El de volumen es una política publicada (no requiere aprobación); el
  // manual, si supera al de volumen, sigue disparando aprobación de Gerencia.
  const descuentoVolumenPct = incluyeLavado ? descuentoVolumen(m2) * 100 : 0;
  const descuentoEfectivoPct = Math.max(descuentoVolumenPct, descuentoManualPct);

  // Múltiples ítems de lavado (spec_multi_item_lavado_20260722.md): el piso de
  // proyecto y el piso de margen se evalúan UNA vez sobre la suma de todos los
  // ítems (una sola movilización), y el precio final se reparte de vuelta a
  // cada ítem a prorrata — ver calcularLavadoMultiItem.
  const lavado = incluyeLavado
    ? calcularLavadoMultiItem(parametros, { items: itemsLavadoInput, comisionPct: 0.05, descuentoPct: descuentoEfectivoPct })
    : null;
  const insp = calcularInspeccion(parametros, techo);

  // El descuento manual nunca puede perforar el 35%: si el comercial pide un
  // descuento manual mayor al de volumen y el piso de margen tuvo que recortarlo
  // (pisoAplicado), se bloquea para que lo reduzca. El de volumen, en cambio, se
  // recorta solo en silencio (es política, no negociación).
  if (incluyeLavado && descuentoManualPct > descuentoVolumenPct && lavado!.pisoAplicado) {
    return { error: `Con este descuento manual el margen del lavado cae por debajo del mínimo permitido (35%). Redúzcalo — el edificio ya recibe ${descuentoVolumenPct}% automático por volumen.` };
  }

  // Días de ejecución reales (spec_lavado_items_dias_20260717.md): el sistema
  // calcula con productividad real (sumada de todos los ítems); aumentar es
  // libre, reducir por debajo del cálculo dispara aprobación de Gerencia
  // (mismo mecanismo que el descuento).
  const diasEjecucionSistema = lavado ? lavado.diasEjecucionSistema : null;
  const diasEjecucionInput = formData.get('diasEjecucion') ? Number(formData.get('diasEjecucion')) : null;
  const diasEjecucion = incluyeLavado ? (diasEjecucionInput ?? diasEjecucionSistema!) : null;
  const requiereAprobacionPorDias = diasEjecucionSistema !== null && diasEjecucion !== null && diasEjecucion < diasEjecucionSistema;
  const ejecucionSitio = incluyeLavado
    ? `${diasEjecucion} día${diasEjecucion === 1 ? '' : 's'} hábil${diasEjecucion === 1 ? '' : 'es'}. Una vez aprobados permisos y recibido el anticipo.`
    : String(formData.get('ejecucionSitio') || '').trim() || null;

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

  // Piso de margen del 35% (decisión Gerencia 2026-07-25): baja de 35% SOLO con
  // autorización explícita de Gerencia — nunca en automático, ni el sistema ni el
  // comercial la activan solos. El mecanismo es el mismo que ya existe para el
  // descuento manual y los días recortados: la cotización queda en
  // PENDIENTE_APROBACION y solo Gerencia (rol GERENCIA) puede aprobarla o
  // rechazarla desde el detalle — nunca un bloqueo ciego que no se pueda destrabar.
  const requiereAprobacion =
    descuentoManualPct > descuentoVolumenPct
    || requiereAprobacionPorDias
    || !!lavado?.sobreTarifaLista // tope $6.000/m² incompatible con el 35% (superficie difícil + recargo alto)
    || margenP < parametros.MARGEN_MINIMO;

  // Ítems de lavado a persistir (Cotizacion.itemsLavado) — cada fila conserva
  // su nombre editable y su propio desglose de costo/fee/precio ya repartido
  // (ver calcularLavadoMultiItem). concepto/m2Vidrio/m2Opaca/superficie/
  // tipoEdificio/dificultad YA NO se escriben en CotizacionPuntual (deprecados,
  // ver schema.prisma) — viven únicamente en cada ItemLavado.
  const itemsLavadoData = lavado
    ? lavado.items.map((it, orden) => ({
        orden,
        nombre: it.nombre,
        concepto: it.concepto,
        m2Vidrio: it.m2Vidrio,
        m2Opaca: it.m2Opaca,
        superficie: it.superficie,
        tipoEdificio: it.tipoEdificio,
        dificultad: it.dificultad,
        costoOperacion: it.costoOperacion,
        feeNoruega: it.feeNoruega,
        precioLavado: it.precioLavado,
        diasEjecucionSistema: it.diasEjecucionSistema,
      }))
    : [];

  const puntualData = {
    servicio,
    tipoInformeBase,
    mostrarInformeInternacional,
    m2Fachada: incluyeLavado ? m2 : null,
    rangoTecho: techo || null,
    diasOperacion: (lavado?.dias ?? 0) + (servicio !== 'SOLO_LAVADO' ? insp.diasOperacionInsp : 0),
    costoOperacion: costoOperacionTotal,
    feeNoruega: feeNoruegaTotal,
    margenPct: margenP,
    descuentoPct: incluyeLavado && descuentoManualPct > 0 ? descuentoManualPct : null,
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

  return {
    clienteNombre, clienteContacto, pipedriveDealId, observaciones,
    totalCliente, margenP, requiereAprobacion,
    puntualData, itemsLavadoData,
  };
}

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

  const r = computarPuntual(formData, parametros);
  if (r.error !== undefined) return { error: r.error };
  const { clienteNombre, clienteContacto, pipedriveDealId, observaciones, totalCliente, margenP, requiereAprobacion, puntualData, itemsLavadoData } = r;

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
        // Se reemplazan por completo — más simple y seguro que diffear filas
        // (una edición en Borrador puede agregar/quitar/reordenar ítems libremente).
        itemsLavado: { deleteMany: {}, create: itemsLavadoData },
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
      itemsLavado: { create: itemsLavadoData },
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

// Vista previa SIN GUARDAR (decisión Gerencia 2026-07-25): antes, el único botón
// del cotizador calculaba Y persistía a la vez — cualquier intento de ver el
// precio (ajustar m², probar otro tipo de edificio) creaba una cotización real
// en BORRADOR, acumulando decenas de registros por cada una que de verdad se
// enviaba. Esta acción usa la MISMA fórmula (computarPuntual) pero no toca la
// base de datos — se llama desde el botón "Calcular" del formulario; "Crear
// cotización" sigue siendo el único botón que persiste.
//
// Regla A: el margen/costo real solo se muestra si la sesión es GERENCIA — un
// comercial ve el total y si haría falta aprobación, nunca el margen.
export type PreviewPuntualState = {
  error?: string; ok?: boolean;
  totalCliente?: number; requiereAprobacion?: boolean;
  margenPct?: number;
} | undefined;

export async function previsualizarPuntual(_state: PreviewPuntualState, formData: FormData): Promise<PreviewPuntualState> {
  const session = await verifySession();
  const { parametros } = await getParametrosVigentes();
  const r = computarPuntual(formData, parametros);
  if (r.error !== undefined) return { error: r.error };
  const esGerencia = session.rol === 'GERENCIA';
  return {
    ok: true,
    totalCliente: r.totalCliente,
    requiereAprobacion: r.requiereAprobacion,
    ...(esGerencia ? { margenPct: r.margenP } : {}),
  };
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

// Borrado — solo GERENCIA. Permitido en BORRADOR (nunca se mostró a nadie) y
// en RECHAZADA (Gerencia la rechazó antes de que el link se activara — nunca
// llegó a un cliente real, ver rechazarCotizacion). Nunca en ENVIADA/APROBADA/
// PENDIENTE_APROBACION: esas si pudieron llegar a un cliente y no se puede
// perder esa trazabilidad (decisión Gerencia 2026-07-25).
export async function eliminarCotizacion(cotizacionId: string) {
  await requireRol('GERENCIA');
  const c = await prisma.cotizacion.findUnique({ where: { id: cotizacionId } });
  if (!c) return { error: 'La cotización ya no existe.' };
  if (c.estado !== 'BORRADOR' && c.estado !== 'RECHAZADA') {
    return { error: 'Solo se pueden borrar cotizaciones en Borrador o Rechazadas — esta ya fue aprobada o enviada a un cliente.' };
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
type CareData = {
  planRecomendado: 'BASIC' | 'ESSENTIAL' | 'COMPLETE'; contratoAnios: number; formaPago: 'CONTADO' | 'DIFERIDO_12';
  m2Fachada: number; rangoTecho: number | null;
  superficie: Superficie; tipoEdificio: NivelRecargo; dificultad: NivelRecargo;
  valorAnualBasic: number; valorMensualBasic: number;
  valorAnualEssential: number; valorMensualEssential: number;
  valorAnualComplete: number; valorMensualComplete: number;
  descuentoManualPct: number | null;
};
type ResultadoCare =
  | { error: string }
  | {
      error?: undefined;
      clienteNombre: string; clienteContacto: string | null; pipedriveDealId: string | null;
      observaciones: string | null;
      planRecomendado: 'BASIC' | 'ESSENTIAL' | 'COMPLETE';
      todos: ReturnType<typeof calcularCareTodos>;
      requiereAprobacion: boolean; peorMargen: number;
      careData: CareData;
    };

// Cálculo y validación PUROS de una cotización Care — no toca la base de datos.
// Misma disciplina que computarPuntual: única fuente de verdad compartida entre
// crearCotizacionCare (persiste) y previsualizarCare (solo muestra, nunca guarda).
function computarCare(formData: FormData, parametros: Parametros): ResultadoCare {
  const planRecomendado = String(formData.get('plan')) as 'BASIC' | 'ESSENTIAL' | 'COMPLETE';
  const clienteNombre = String(formData.get('clienteNombre') || '').trim();
  const clienteContacto = String(formData.get('clienteContacto') || '').trim() || null;
  if (!clienteNombre) return { error: 'El nombre del cliente es obligatorio.' };
  const pipedriveDealId = String(formData.get('pipedriveDealId') || '').trim() || null;

  // Los 3 paquetes se cotizan siempre juntos, así que el área de fachada es
  // obligatoria aunque el plan destacado sea Basic (Essential/Complete la necesitan).
  const m2 = Number(formData.get('m2') || 0);
  if (m2 <= 0) return { error: 'Ingrese el área de fachada (m²) — se usa para calcular los 3 planes.' };

  const techo = Number(formData.get('techo') || 0);
  // La duración ya no la elige el comercial: es fija por plan (reestructuración
  // 2026-07-23) — Basic 1 año, Essential y Complete 3 años. Se guarda la del
  // plan recomendado como referencia del registro.
  const contratoAnios = planRecomendado === 'BASIC' ? 1 : 3;
  const formaPago = String(formData.get('formaPago') || 'CONTADO') as 'CONTADO' | 'DIFERIDO_12';
  const observaciones = String(formData.get('observaciones') || '').trim() || null;

  // Mismas variables de recargo que Familia 1 — corrección 2026-07-16, antes
  // calcularCare siempre asumía MIXTA/BAJO/BAJO sin importar el edificio real.
  const superficie = String(formData.get('superficie') || 'MIXTA') as Superficie;
  const tipoEdificio = String(formData.get('tipoEdificio') || 'BAJO') as NivelRecargo;
  const dificultad = String(formData.get('dificultad') || 'BAJO') as NivelRecargo;

  // Descuento manual sobre los 3 paquetes (Gerencia 2026-07-28) — mismo
  // mecanismo que el descuento manual de Familia 1: se aplica por igual a los
  // 3 planes, NUNCA se suma al de compromiso/volumen (se toma el mayor, ver
  // calcularCare), y el piso de margen de 35% se protege ahí mismo.
  const descuentoManualPct = Number(formData.get('descuentoPct') || 0);
  if (descuentoManualPct < 0 || descuentoManualPct >= 100) return { error: 'El descuento debe estar entre 0% y 99%.' };

  const todos = calcularCareTodos(parametros, { m2, techo, superficie, tipoEdificio, dificultad, descuentoManualPct });
  // Piso de margen del 35% (decisión Gerencia 2026-07-25): baja de 35% SOLO con
  // autorización explícita de Gerencia — igual mecanismo que Familia 1, nunca un
  // bloqueo ciego. Para Essential y Complete cuenta el margen de CADA año del
  // contrato (el peor, nunca un promedio que esconda el año más ajustado), y en
  // Complete cuenta además la línea del Informe Internacional, que se factura
  // aparte y por lo tanto tiene su propio margen.
  const margenesMinimos = Object.values(todos).map((t) =>
    Math.min(t.margenP, t.internacionalAparte?.margenP ?? 1),
  );
  const peorMargen = Math.min(...margenesMinimos);

  // El descuento manual solo dispara aprobación de Gerencia cuando de verdad
  // cambia el precio de algún plan frente a lo que ya aplicaría por política
  // (compromiso del plan + volumen) — igual criterio que Familia 1: si el
  // manual queda por debajo de lo que el edificio ya recibía automáticamente,
  // no hay nada que aprobar.
  const todosSinManual = calcularCareTodos(parametros, { m2, techo, superficie, tipoEdificio, dificultad });
  const requiereAprobacionPorDescuentoManual = descuentoManualPct > 0 && (['BASIC', 'ESSENTIAL', 'COMPLETE'] as const)
    .some((plan) => todos[plan].descuentoAplicado > todosSinManual[plan].descuentoAplicado);
  const requiereAprobacion = peorMargen < parametros.MARGEN_MINIMO || requiereAprobacionPorDescuentoManual;

  const careData: CareData = {
    planRecomendado, contratoAnios, formaPago, m2Fachada: m2, rangoTecho: techo || null,
    superficie, tipoEdificio, dificultad,
    valorAnualBasic: todos.BASIC.valorAnual, valorMensualBasic: todos.BASIC.valorMensual,
    valorAnualEssential: todos.ESSENTIAL.valorAnual, valorMensualEssential: todos.ESSENTIAL.valorMensual,
    valorAnualComplete: todos.COMPLETE.valorAnual, valorMensualComplete: todos.COMPLETE.valorMensual,
    descuentoManualPct: descuentoManualPct > 0 ? descuentoManualPct : null,
  };

  return {
    clienteNombre, clienteContacto, pipedriveDealId, observaciones,
    planRecomendado, todos, requiereAprobacion, peorMargen, careData,
  };
}

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

  const r = computarCare(formData, parametros);
  if (r.error !== undefined) return { error: r.error };
  const { clienteNombre, clienteContacto, pipedriveDealId, observaciones, planRecomendado, todos, requiereAprobacion, peorMargen, careData } = r;

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
        margenPct: peorMargen,
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
      margenPct: peorMargen,
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

// Vista previa SIN GUARDAR — mismo mecanismo que previsualizarPuntual: calcula
// con computarCare, nunca toca prisma. Regla A: margen solo si es Gerencia.
export type PreviewCareState = {
  error?: string; ok?: boolean;
  valorAnualBasic?: number; valorMensualBasic?: number;
  valorAnualEssential?: number; valorMensualEssential?: number;
  valorAnualComplete?: number; valorMensualComplete?: number;
  informeInternacionalAparte?: number;
  requiereAprobacion?: boolean;
  peorMargen?: number;
} | undefined;

export async function previsualizarCare(_state: PreviewCareState, formData: FormData): Promise<PreviewCareState> {
  const session = await verifySession();
  const { parametros } = await getParametrosVigentes();
  const r = computarCare(formData, parametros);
  if (r.error !== undefined) return { error: r.error };
  const esGerencia = session.rol === 'GERENCIA';
  return {
    ok: true,
    valorAnualBasic: r.todos.BASIC.valorAnual, valorMensualBasic: r.todos.BASIC.valorMensual,
    valorAnualEssential: r.todos.ESSENTIAL.valorAnual, valorMensualEssential: r.todos.ESSENTIAL.valorMensual,
    valorAnualComplete: r.todos.COMPLETE.valorAnual, valorMensualComplete: r.todos.COMPLETE.valorMensual,
    informeInternacionalAparte: r.todos.COMPLETE.internacionalAparte?.precio,
    requiereAprobacion: r.requiereAprobacion,
    ...(esGerencia ? { peorMargen: r.peorMargen } : {}),
  };
}
