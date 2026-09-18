import 'server-only';
import type { Prisma } from '@/generated/prisma/client';

// Datos operativos de una cotización aceptada, para la Orden de Servicio.
//
// ⚠️ REGLA CENTRAL (KWD-SIS-PROMPT-001 v2): la Orden de Servicio NO LLEVA
// CIFRAS DE DINERO. Ni el total, ni el precio por ítem, ni el costo, ni el
// margen, ni el valor de los ítems de terceros. Lo único que se dice del
// dinero es si el anticipo está confirmado, y eso es un sí/no.
//
// Los m² SÍ van: no son plata, son la magnitud del trabajo, y sin ellos
// Operaciones no puede planear días, baterías ni cuadrilla. Esta función
// existe justamente para que el armado de esos datos viva en UN solo lugar —
// la usan el correo a Operaciones y la pantalla de la orden, así que no puede
// pasar que una filtre algo que la otra oculta.

const NOMBRES_SERVICIO: Record<string, string> = {
  INSPECCION_SOLA: 'Inspección de fachada y cubierta (Diagnóstico Visual KTV)',
  LAVADO_MAS_INSPECCION: 'Lavado de fachada + Inspección KTV Colombia',
  SOLO_LAVADO: 'Lavado de fachada',
};

const NOMBRES_CONCEPTO: Record<string, string> = {
  SOLO_VENTANAS: 'ventanas',
  SOLO_FACHADA: 'fachada',
  FACHADA_Y_VENTANAS: 'fachada + ventanas',
};

const NOMBRES_SUPERFICIE: Record<string, string> = { VIDRIO: 'vidrio', MIXTA: 'mixta', DIFICIL: 'difícil' };
const NOMBRES_NIVEL: Record<string, string> = { BAJO: 'baja', MEDIO: 'media', ALTO: 'alta' };

const NOMBRES_PLAN: Record<string, string> = {
  BASIC: 'KTV Care Basic — 1 año, 1 lavada al año, Diagnóstico Visual anual',
  ESSENTIAL: 'KTV Care Essential — 3 años, 1 lavada al año, Diagnóstico Visual años 1 y 3',
  COMPLETE: 'KTV Care Complete — 3 años, 2 lavadas al año, Informe Internacional año 1 + Diagnóstico Visual año 3',
};

function m2(n: number | null | undefined) {
  return `${Math.round(n ?? 0).toLocaleString('es-CO')} m²`;
}

export type CotizacionParaOrden = Prisma.CotizacionGetPayload<{
  include: { cliente: true; puntual: true; care: true; itemsLavado: true; itemsTerceros: true; creadoPor: true };
}>;

export function datosOperativos(c: CotizacionParaOrden): { servicio: string; lineas: string[] } {
  const lineas: string[] = [];

  if (c.familia === 'CARE' && c.care) {
    const k = c.care;
    lineas.push(`Fachada: ${m2(k.m2Fachada)}`);
    if (k.rangoTecho) lineas.push(`Techo (para el Diagnóstico Visual): ${m2(k.rangoTecho)}`);
    lineas.push(`Superficie ${NOMBRES_SUPERFICIE[k.superficie ?? 'MIXTA']} · edificio ${NOMBRES_NIVEL[k.tipoEdificio ?? 'BAJO']} · dificultad ${NOMBRES_NIVEL[k.dificultad ?? 'BAJO']}`);
    lineas.push(`Duración del contrato: ${k.contratoAnios} año${k.contratoAnios === 1 ? '' : 's'}`);
    if (c.observaciones) lineas.push(`Observaciones: ${c.observaciones}`);
    return { servicio: NOMBRES_PLAN[k.planRecomendado] ?? k.planRecomendado, lineas };
  }

  const p = c.puntual;
  const servicio = p ? (NOMBRES_SERVICIO[p.servicio] ?? p.servicio) : 'Servicio puntual';

  // Multi-ítem: cada edificio/superficie se ejecuta distinto, así que van
  // separados y no sumados (ver spec_multi_item_lavado_20260722.md).
  for (const it of [...c.itemsLavado].sort((a, b) => a.orden - b.orden)) {
    const areas = [it.m2Vidrio > 0 ? `vidrio ${m2(it.m2Vidrio)}` : null, it.m2Opaca > 0 ? `opaca ${m2(it.m2Opaca)}` : null]
      .filter(Boolean).join(' · ');
    lineas.push(`${it.nombre || 'Lavado'} (${NOMBRES_CONCEPTO[it.concepto] ?? it.concepto}): ${areas} — superficie ${NOMBRES_SUPERFICIE[it.superficie]} · edificio ${NOMBRES_NIVEL[it.tipoEdificio]} · dificultad ${NOMBRES_NIVEL[it.dificultad]}`);
  }

  if (p) {
    // Cotizaciones viejas (de antes del multi-ítem) traen el único ítem en las
    // columnas de CotizacionPuntual — se leen igual para no dejar una orden vacía.
    if (c.itemsLavado.length === 0 && p.concepto) {
      lineas.push(`Lavado (${NOMBRES_CONCEPTO[p.concepto] ?? p.concepto}): vidrio ${m2(p.m2Vidrio)} · opaca ${m2(p.m2Opaca)}`);
    }
    if (p.rangoTecho) lineas.push(`Techo (para el Diagnóstico Visual): ${m2(p.rangoTecho)}`);
    const dias = p.diasEjecucion ?? p.diasEjecucionSistema;
    if (dias) lineas.push(`Días de ejecución en sitio: ${dias}`);
    if (p.permisoAerocivil) lineas.push(`Permiso Aeronáutica Civil: ${p.permisoAerocivil}`);
  }

  // De los ítems de terceros solo va QUÉ es — Operaciones necesita saber que
  // hay que coordinarlo, nunca lo que costó ni lo que se cobró.
  for (const t of c.itemsTerceros) lineas.push(`Incluye además: ${t.descripcionCliente}`);

  if (c.observaciones) lineas.push(`Observaciones: ${c.observaciones}`);
  return { servicio, lineas };
}
