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
  // Familia 1
  puntual?: {
    servicio: 'INSPECCION_SOLA' | 'LAVADO_MAS_INSPECCION' | 'SOLO_LAVADO';
    incluyeLavado: boolean;
    precioLavadoTotal: number | null; // sin IVA — total, nunca precio/m²
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
  // Familia 2 — los 3 paquetes se muestran siempre juntos (regla Gerencia 2026-07-13)
  care?: {
    planRecomendado: 'INSPECT' | 'ESSENTIAL' | 'COMPLETE';
    contratoAnios: number;
    formaPago: 'CONTADO' | 'DIFERIDO_12';
    informeIncluidoValor: number;
    informeInternacional: { precioTotal: number } | null;
    paquetes: {
      plan: 'INSPECT' | 'ESSENTIAL' | 'COMPLETE';
      nombre: string;
      nLavadas: number;
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
    include: { cliente: true, puntual: true, care: true },
  });
  if (!c) return null;

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
    totalCliente: c.totalCliente,
  };

  if (c.familia === 'PUNTUAL' && c.puntual) {
    const p = c.puntual;
    const incluyeLavado = p.servicio !== 'INSPECCION_SOLA';
    const dvEsGratis = p.servicio === 'LAVADO_MAS_INSPECCION' && p.tipoInformeBase === 'DIAGNOSTICO_VISUAL';
    base.puntual = {
      servicio: p.servicio,
      incluyeLavado,
      precioLavadoTotal: incluyeLavado ? p.precioLavado ?? null : null,
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
      contratoAnios: care.contratoAnios,
      formaPago: care.formaPago,
      informeIncluidoValor: insp.dvPrecio,
      informeInternacional: null,
      paquetes: [
        { plan: 'INSPECT', nombre: 'KTV Care Inspect', nLavadas: 0, valorAnual: care.valorAnualInspect, valorMensual: care.valorMensualInspect, recomendado: care.planRecomendado === 'INSPECT' },
        { plan: 'ESSENTIAL', nombre: 'KTV Care Essential', nLavadas: 1, valorAnual: care.valorAnualEssential, valorMensual: care.valorMensualEssential, recomendado: care.planRecomendado === 'ESSENTIAL' },
        { plan: 'COMPLETE', nombre: 'KTV Care Complete', nLavadas: 2, valorAnual: care.valorAnualComplete, valorMensual: care.valorMensualComplete, recomendado: care.planRecomendado === 'COMPLETE' },
      ],
    };
  }

  return base;
}
