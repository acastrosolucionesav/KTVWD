import 'server-only';
import { prisma } from '@/lib/prisma';

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
  familia: 'PUNTUAL' | 'CARE';
  clienteNombre: string;
  clienteContacto: string | null;
  fecha: string;
  vigenteHasta: string | null;
  observaciones: string | null;
  aceptadaPorCliente: boolean;
  estado: string;
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
  };
  // Familia 2
  care?: {
    plan: 'INSPECT' | 'ESSENTIAL' | 'COMPLETE';
    contratoAnios: number;
    formaPago: 'CONTADO' | 'DIFERIDO_12';
    valorAnual: number;
    valorMensual: number;
    informeIncluidoValor: number;
    informeInternacional: { precioTotal: number } | null;
  };
};

const NOMBRES_INFORME = {
  DIAGNOSTICO_VISUAL: 'Diagnóstico Visual KTV',
  INTERNACIONAL: 'Informe Internacional KTV',
} as const;

export async function getCotizacionClienteDTO(idTrazabilidad: string): Promise<CotizacionClienteDTO | null> {
  const c = await prisma.cotizacion.findUnique({
    where: { idTrazabilidad },
    include: { cliente: true, puntual: true, care: true },
  });
  if (!c) return null;

  const base: CotizacionClienteDTO = {
    idTrazabilidad: c.idTrazabilidad,
    familia: c.familia,
    clienteNombre: c.cliente.nombre,
    clienteContacto: c.cliente.contacto,
    fecha: c.creadoAt.toISOString(),
    vigenteHasta: c.vigenteHasta ? c.vigenteHasta.toISOString() : null,
    observaciones: c.observaciones,
    aceptadaPorCliente: c.aceptadaPorCliente,
    estado: c.estado,
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
    };
  }

  if (c.familia === 'CARE' && c.care) {
    const care = c.care;
    base.care = {
      plan: care.plan,
      contratoAnios: care.contratoAnios,
      formaPago: care.formaPago,
      valorAnual: care.valorAnual,
      valorMensual: care.valorMensual,
      informeIncluidoValor: 0, // se completa en la capa de presentación desde parametros públicos si aplica
      informeInternacional: null,
    };
  }

  return base;
}
