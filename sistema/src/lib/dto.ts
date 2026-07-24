import 'server-only';
import { prisma } from '@/lib/prisma';
import { calcularInspeccion, type Parametros } from '@/lib/pricing';

// ============================================================================
// REGLA A (KWD-SIS-PROMPT-001 v2): el fee a Noruega y cualquier desglose de
// costos/margen NUNCA llega a un documento de cliente. Esto NO se implementa
// ocultando campos con CSS/JS — se implementa con un TIPO DE DATO que
// estructuralmente no los contiene. CotizacionClienteDTO abajo no tiene (ni
// puede tener) feeNoruega, costoOperacion ni margenPct: no están en su forma.
// Cualquier función que arme un documento de cliente debe recibir ESTE tipo,
// nunca el registro completo de Prisma.
// ============================================================================

export type CotizacionClienteDTO = {
  idTrazabilidad: string;
  linkToken: string;
  linkActivo: boolean;
  familia: 'PUNTUAL' | 'CARE';
  clienteNombre: string;
  clienteContacto: string | null;
  fecha: string;
  vigenteHasta: string | null;
  observaciones: string | null;
  aceptadaPorCliente: boolean;
  estado: string;
  totalCliente: number; // único número contractual — sin IVA (Regla general de visualización)
  creadoPorNombre: string; // comercial que crea la cotización — firma la propuesta
  // Ítems de terceros (spec_items_terceros_20260716_2.md) — genérico, aplica a
  // cualquier familia. Regla A: SOLO descripción y precio de venta, nunca
  // costoReal/margenNetoDeseado/notaInterna — esos no están en esta forma.
  itemsTerceros: { descripcionCliente: string; precioVenta: number }[];
  // Familia 1
  puntual?: {
    servicio: 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
    incluyeLavado: boolean;
    // Ítems de lavado seleccionables (spec_lavado_items_dias_20260717.md) —
    // determina el texto que ve el cliente (fachada / vidrios / ambos), nunca el precio.
    concepto: 'SOLO_VENTANAS' | 'SOLO_FACHADA' | 'FACHADA_Y_VENTANAS' | null;
    precioLavadoTotal: number | null; // sin IVA — total, nunca precio/m²
    // Múltiples ítems de lavado (spec_multi_item_lavado_20260722.md) — cada uno
    // con su nombre editable y su porción del precio total. Regla A: SOLO
    // nombre y precio, nunca costoOperacion/feeNoruega. Vacío para cotizaciones
    // creadas antes de este cambio (esas siguen mostrando el bloque único de
    // arriba, con `concepto`/`precioLavadoTotal`).
    itemsLavado: { nombre: string; precioTotal: number }[];
    informeBaseNombre: string | null; // "Diagnóstico Visual KTV" | null (gratis, va en incluyeLavado)
    informeBaseValor: number | null;  // valor de referencia del DV cuando va incluido gratis
    informeBaseCobrado: boolean;      // true si el DV se cobra (no hay lavado con qué regalarlo)
    // REGLA B — solo aparece si mostrarInformeInternacional=true en la cotización
    informeInternacional: { precioTotal: number } | null;
    // Condiciones, permisos y plazos — texto libre del comercial, sin cálculo.
    anticipoPct: number | null;
    saldoPct: number | null;
    condicionPagoNota: string | null;
    permisoAerocivil: string | null;
    ejecucionSitio: string | null;
  };
  // Familia 2 — los 3 paquetes se muestran siempre juntos (regla Gerencia 2026-07-13).
  // Reestructuración 2026-07-23: Basic (1 año) / Essential (3 años) / Complete (3 años).
  care?: {
    planRecomendado: 'BASIC' | 'ESSENTIAL' | 'COMPLETE';
    formaPago: 'CONTADO' | 'DIFERIDO_12';
    informeIncluidoValor: number;
    informeInternacional: { precioTotal: number } | null;
    paquetes: {
      plan: 'BASIC' | 'ESSENTIAL' | 'COMPLETE';
      nombre: string;
      nLavadas: number;       // lavadas por año
      contratoAnios: number;  // duración fija del plan (Basic 1, Essential/Complete 3)
      valorAnual: number;
      valorMensual: number;
      recomendado: boolean;
    }[];
  };
};

const NOMBRES_INFORME = {
  DIAGNOSTICO_VISUAL: 'Diagnóstico Visual KTV',
  INTERNACIONAL: 'Informe Internacional KTV',
} as const;

// Módulo 2: la búsqueda pública es por linkToken (no adivinable), nunca por
// idTrazabilidad (secuencial por fecha — un tercero podría enumerarlo).
export async function getCotizacionClienteDTO(linkToken: string): Promise<CotizacionClienteDTO | null> {
  const c = await prisma.cotizacion.findUnique({
    where: { linkToken },
    include: { cliente: true, puntual: true, care: true, creadoPor: true, itemsTerceros: true, itemsLavado: { orderBy: { orden: 'asc' } } },
  });
  if (!c) return null;

  const itemsTerceros = c.itemsTerceros.map((it) => ({ descripcionCliente: it.descripcionCliente, precioVenta: it.precioVenta }));
  const sumaItemsTerceros = c.itemsTerceros.reduce((s, it) => s + it.precioVenta, 0);

  const base: CotizacionClienteDTO = {
    idTrazabilidad: c.idTrazabilidad,
    linkToken: c.linkToken,
    linkActivo: c.linkActivo,
    familia: c.familia,
    clienteNombre: c.cliente.nombre,
    clienteContacto: c.cliente.contacto,
    fecha: c.creadoAt.toISOString(),
    vigenteHasta: c.vigenteHasta ? c.vigenteHasta.toISOString() : null,
    observaciones: c.observaciones,
    aceptadaPorCliente: c.aceptadaPorCliente,
    estado: c.estado,
    // Familia 1: el total es único, así que los ítems de terceros se suman de
    // una vez. Care: el total es el valor ANUAL del plan recomendado (un
    // programa recurrente) — los ítems de terceros son un cargo aparte, no se
    // mezclan ahí (se muestran por separado, ver propuesta/[id]/page.tsx).
    totalCliente: c.familia === 'PUNTUAL' ? c.totalCliente + sumaItemsTerceros : c.totalCliente,
    creadoPorNombre: c.creadoPor.nombre,
    itemsTerceros,
  };

  if (c.familia === 'PUNTUAL' && c.puntual) {
    const p = c.puntual;
    const incluyeLavado = p.servicio !== 'INSPECCION_SOLA';
    const dvEsGratis = p.servicio === 'LAVADO_MAS_INSPECCION' && p.tipoInformeBase === 'DIAGNOSTICO_VISUAL';
    base.puntual = {
      servicio: p.servicio,
      incluyeLavado,
      concepto: p.concepto,
      precioLavadoTotal: incluyeLavado ? p.precioLavado ?? null : null,
      itemsLavado: c.itemsLavado.map((it) => ({ nombre: it.nombre, precioTotal: it.precioLavado })),
      informeBaseNombre: p.tipoInformeBase ? NOMBRES_INFORME[p.tipoInformeBase] : null,
      informeBaseValor: p.precioInformeBase ?? null,
      informeBaseCobrado: !dvEsGratis && !!p.tipoInformeBase,
      informeInternacional: p.mostrarInformeInternacional && p.precioInformeAdicional
        ? { precioTotal: p.precioInformeAdicional }
        : null,
      anticipoPct: p.anticipoPct ?? null,
      saldoPct: p.saldoPct ?? null,
      condicionPagoNota: p.condicionPagoNota,
      permisoAerocivil: p.permisoAerocivil,
      ejecucionSitio: p.ejecucionSitio,
    };
  }

  if (c.familia === 'CARE' && c.care) {
    const care = c.care;
    // El DV incluido se recalcula del snapshot CONGELADO al crear la cotización
    // (nunca de los parámetros vigentes hoy — "cotización enviada = foto congelada").
    const snapshot = JSON.parse(c.snapshotParametros) as Parametros;
    const insp = calcularInspeccion(snapshot, care.rangoTecho ?? 0);
    base.care = {
      planRecomendado: care.planRecomendado,
      formaPago: care.formaPago,
      informeIncluidoValor: insp.dvPrecio,
      // Cuadro de referencia único debajo de los 3 paquetes (corrección 2026-07-16):
      // mismo precio de venta que usa Complete año 1 y Familia 1 — nunca fee ni
      // costo interno (Regla A). Se muestra siempre, en los 3 planes.
      informeInternacional: insp.precioInternacional ? { precioTotal: insp.precioInternacional } : null,
      paquetes: [
        { plan: 'BASIC', nombre: 'KTV Care Basic', nLavadas: 1, contratoAnios: 1, valorAnual: care.valorAnualBasic, valorMensual: care.valorMensualBasic, recomendado: care.planRecomendado === 'BASIC' },
        { plan: 'ESSENTIAL', nombre: 'KTV Care Essential', nLavadas: 1, contratoAnios: 3, valorAnual: care.valorAnualEssential, valorMensual: care.valorMensualEssential, recomendado: care.planRecomendado === 'ESSENTIAL' },
        { plan: 'COMPLETE', nombre: 'KTV Care Complete', nLavadas: 2, contratoAnios: 3, valorAnual: care.valorAnualComplete, valorMensual: care.valorMensualComplete, recomendado: care.planRecomendado === 'COMPLETE' },
      ],
    };
  }

  return base;
}
