// Motor de precios — porta las fórmulas ya validadas de cotizador.html y
// KWD-FIN-MPV-001 v1.5 (Excel oficial). Un solo lugar de verdad para el cálculo.
// IMPORTANTE (Regla A): este módulo puede calcular fee/costo/margen libremente —
// la confidencialidad se aplica al MOMENTO DE ARMAR EL DTO DE CLIENTE (ver dto.ts),
// nunca aquí.

export type Parametros = {
  TARIFA_LISTA: number;
  TRM: number;
  EUR_COP: number;
  FEE_NORUEGA: number;
  PCT_ADMIN: number;
  PCT_IMPREV: number;
  PROD_VIDRIO: number;
  PROD_MIXTA: number;
  PROD_DIFICIL: number;
  CUADRILLA_DIA: number;
  CONSUMIBLES_DIA: number;
  DEPRECIACION_DIA: number;
  // --- Costeo de la inspección propia (confirmado con Gerencia 2026-07-12) ---
  DRON_4T_EUR: number;              // precio base Matrice 4T, verificado en BlueTag
  FACTOR_IMPORT_TRANSPORTE: number; // 50% del valor del dron — confirmado por Gerencia
  DRON_4T_VIDA_ANIOS: number;       // vida útil, igual convención que el resto de equipos
  PROD_INSPECCION_M2_DIA: number;   // ⚠️ PLACEHOLDER — falta calibrar con Órdenes de Vuelo reales
  COSTO_INFORME_ANALISIS: number;   // ⚠️ PENDIENTE — aún no definido con Gerencia (hoy en 0, no cerrar costeo sin esto)
  IVA: number;
  CARE_ESSENTIAL_DESC: number;
  CARE_COMPLETE_DESC: number;
  DV_PRECIO: number;
  DV_TIER_1: number;
  DV_TIER_2: number;
  DV_TIER_3: number;
  ROOF_TIER_1_MAX: number;
  ROOF_TIER_2_MAX: number;
  ROOF_TIER_3_MAX: number;
  ROOF_FEE_1_EUR: number;
  ROOF_FEE_2_EUR: number;
  ROOF_FEE_3_EUR: number;
  MARGEN_MINIMO: number;
  MINIMO_PROYECTO_LAVADO: number; // cargo mínimo facturable por proyecto de lavado — evita margen negativo en edificios chicos
  INT_PISO_MERCADO: number;       // piso de mercado del Informe Internacional (estudio 2026-07: firmas de patología cobran $9M+)
};

// Valores iniciales — idénticos a los de cotizador.html / KWD-FIN-MPV-001 v1.5.
// Se siembran en la tabla `parametros` y desde ahí Gerencia los edita sin tocar código.
export const PARAMETROS_INICIALES: Parametros = {
  TARIFA_LISTA: 6000,
  TRM: 3727.2,
  EUR_COP: 4400,
  FEE_NORUEGA: 0.035,
  PCT_ADMIN: 0.10,
  PCT_IMPREV: 0.05,
  PROD_VIDRIO: 1350,
  PROD_MIXTA: 900,
  PROD_DIFICIL: 600,
  CUADRILLA_DIA: 524049,
  CONSUMIBLES_DIA: 260034,
  DEPRECIACION_DIA: 683118,
  DRON_4T_EUR: 8900,
  FACTOR_IMPORT_TRANSPORTE: 0.5,
  DRON_4T_VIDA_ANIOS: 2,
  PROD_INSPECCION_M2_DIA: 20000, // placeholder inicial — AJUSTAR con datos reales
  COSTO_INFORME_ANALISIS: 0,     // pendiente — ver nota arriba
  IVA: 0.19,
  CARE_ESSENTIAL_DESC: 0.05, // 1 lavada a $5.700/m² — alineado a la regla de negocio (antes 0.06/$5.640 por error)
  CARE_COMPLETE_DESC: 0.10,
  DV_PRECIO: 4500000,
  DV_TIER_1: 3500000,
  DV_TIER_2: 4500000,
  DV_TIER_3: 5500000,
  ROOF_TIER_1_MAX: 10000,
  ROOF_TIER_2_MAX: 25000,
  ROOF_TIER_3_MAX: 40000,
  ROOF_FEE_1_EUR: 798,
  ROOF_FEE_2_EUR: 1198,
  ROOF_FEE_3_EUR: 1598,
  MARGEN_MINIMO: 0.35, // piso real confirmado por Gerencia 2026-07-12 — 25% nunca se trabaja salvo excepción forzada
  MINIMO_PROYECTO_LAVADO: 1500000, // aprobado por Gerencia 2026-07-12 — con este piso el lavado más chico posible da ~35% de margen
  INT_PISO_MERCADO: 9000000,       // aprobado por Gerencia 2026-07-12 — piso del estudio de mercado; solo afecta el tramo pequeño (los otros ya lo superan)
};

export type Superficie = 'VIDRIO' | 'MIXTA' | 'DIFICIL';
export type NivelRecargo = 'BAJO' | 'MEDIO' | 'ALTO';

const RECARGO_PCT: Record<NivelRecargo, number> = { BAJO: 0, MEDIO: 0.05, ALTO: 0.10 };

function productividad(p: Parametros, s: Superficie) {
  return s === 'VIDRIO' ? p.PROD_VIDRIO : s === 'MIXTA' ? p.PROD_MIXTA : p.PROD_DIFICIL;
}

export function calcularLavado(p: Parametros, args: {
  m2: number; superficie: Superficie; tipoEdificio: NivelRecargo; dificultad: NivelRecargo;
  movilizacion: number; comisionPct: number;
}) {
  const costoOpDia = (p.CUADRILLA_DIA + p.CONSUMIBLES_DIA + p.DEPRECIACION_DIA) * (1 + p.PCT_ADMIN + p.PCT_IMPREV);
  const dias = Math.ceil((args.m2 / productividad(p, args.superficie)) * 2) / 2;
  const recargo = RECARGO_PCT[args.tipoEdificio] + RECARGO_PCT[args.dificultad];
  const costoOperacion = dias * costoOpDia * (1 + recargo) + args.movilizacion;
  // Cargo mínimo por proyecto: el costo de salir a operar no baja de medio día aunque el
  // edificio sea diminuto — sin este piso, fachadas chicas daban margen negativo (hasta -377%).
  // (?? 0: snapshots congelados de cotizaciones anteriores a este parámetro no lo traen)
  const precioLavado = Math.max(args.m2 * p.TARIFA_LISTA, p.MINIMO_PROYECTO_LAVADO ?? 0);
  const feeNoruega = precioLavado * p.FEE_NORUEGA;
  const comision = precioLavado * args.comisionPct;
  const costoTotal = costoOperacion + feeNoruega + comision;
  const margenD = precioLavado - costoTotal;
  const margenP = precioLavado > 0 ? margenD / precioLavado : 0;
  return { dias, costoOpDia, costoOperacion, precioLavado, feeNoruega, comision, costoTotal, margenD, margenP };
}

function tierTecho(p: Parametros, techo: number): 0 | 1 | 2 | null {
  if (techo > 0 && techo <= p.ROOF_TIER_1_MAX) return 0;
  if (techo > p.ROOF_TIER_1_MAX && techo <= p.ROOF_TIER_2_MAX) return 1;
  if (techo > p.ROOF_TIER_2_MAX && techo <= p.ROOF_TIER_3_MAX) return 2;
  return null;
}

// Costeo real de la inspección (confirmado con Gerencia 2026-07-12):
// - Dron 4T puesto en Colombia = precio base BlueTag × (1 + 50% import/transporte),
//   depreciado con la misma convención que el resto de equipos (valor/vida/366).
// - Días de campo escalan con el área de techo (no un medio día fijo) — productividad
//   PLACEHOLDER hasta calibrar con Órdenes de Vuelo reales.
// - Costo de construir el informe (análisis + edición de videos): aún NO definido con
//   Gerencia — hoy suma 0, así que el margen mostrado es optimista hasta que se defina.
function costoOperacionInspeccion(p: Parametros, techo: number) {
  const dron4tLandedCop = p.DRON_4T_EUR * (1 + p.FACTOR_IMPORT_TRANSPORTE) * p.EUR_COP;
  const depreciacionDronDia = dron4tLandedCop / p.DRON_4T_VIDA_ANIOS / 366;
  const dias = Math.max(0.5, Math.ceil((techo / p.PROD_INSPECCION_M2_DIA) * 2) / 2);
  const costoDia = (p.CUADRILLA_DIA + p.CONSUMIBLES_DIA + depreciacionDronDia) * (1 + p.PCT_ADMIN + p.PCT_IMPREV);
  return { dias, costo: dias * costoDia + p.COSTO_INFORME_ANALISIS };
}

export function calcularInspeccion(p: Parametros, techo: number) {
  const tier = tierTecho(p, techo);
  const dvPrecio = tier !== null ? [p.DV_TIER_1, p.DV_TIER_2, p.DV_TIER_3][tier] : p.DV_PRECIO;
  const feeEur = tier !== null ? [p.ROOF_FEE_1_EUR, p.ROOF_FEE_2_EUR, p.ROOF_FEE_3_EUR][tier] : null;
  const { dias: diasOperacionInsp, costo: costoOperacionInsp } = costoOperacionInspeccion(p, techo);
  const feeNoruegaCop = feeEur !== null ? feeEur * p.EUR_COP : null;
  // Piso de mercado: la fórmula (2×fee + operación) daba $7,5M en el tramo pequeño, por
  // debajo de lo que cobran las firmas de patología en Colombia ($9M+, estudio 2026-07).
  const precioInternacional = feeNoruegaCop !== null
    ? Math.max(2 * feeNoruegaCop + costoOperacionInsp, p.INT_PISO_MERCADO ?? 0) // ?? 0: snapshots viejos sin este parámetro
    : null;
  const feeNoruegaSobreVenta = (venta: number) => venta * p.FEE_NORUEGA;

  const dvMargenD = dvPrecio - costoOperacionInsp - feeNoruegaSobreVenta(dvPrecio);
  const intMargenD = precioInternacional !== null
    ? precioInternacional - (feeNoruegaCop as number) - costoOperacionInsp - feeNoruegaSobreVenta(precioInternacional)
    : null;

  return {
    tier, dvPrecio, feeEur, feeNoruegaCop, diasOperacionInsp, costoOperacionInsp, precioInternacional,
    fueraDeRango: techo > p.ROOF_TIER_3_MAX,
    dvMargenD, dvMargenP: dvPrecio > 0 ? dvMargenD / dvPrecio : 0,
    intMargenD, intMargenP: precioInternacional && intMargenD !== null ? intMargenD / precioInternacional : null,
  };
}

// Care ahora también devuelve costo y margen REALES (año 1), no solo el valor:
// - Lavadas: mismas fórmulas de días×costo/día del lavado puntual. El formulario Care no
//   captura superficie, así que se costea con la productividad MIXTA (la más conservadora
//   de las habituales) — si el edificio es vidrio puro, el margen real será mejor que este.
// - Inspección (DV incluido): mismo costoOperacionInspeccion que Familia 1.
// - Fee Noruega 3,5% sobre todo el valor anual + comisión comercial (5% venta en frío por
//   defecto — año 1; las renovaciones al 1% mejoran el margen en años siguientes).
export function calcularCare(p: Parametros, args: {
  plan: 'INSPECT' | 'ESSENTIAL' | 'COMPLETE'; m2: number; techo: number; comisionPct?: number;
}) {
  const insp = calcularInspeccion(p, args.techo);
  const dv = insp.dvPrecio;

  const nLavadas = args.plan === 'INSPECT' ? 0 : args.plan === 'ESSENTIAL' ? 1 : 2;
  let valorAnual: number;
  if (args.plan === 'INSPECT') {
    valorAnual = dv;
  } else if (args.plan === 'ESSENTIAL') {
    valorAnual = args.m2 * p.TARIFA_LISTA * (1 - p.CARE_ESSENTIAL_DESC) + dv;
  } else {
    valorAnual = 2 * args.m2 * p.TARIFA_LISTA * (1 - p.CARE_COMPLETE_DESC) + dv;
  }

  const costoOpDia = (p.CUADRILLA_DIA + p.CONSUMIBLES_DIA + p.DEPRECIACION_DIA) * (1 + p.PCT_ADMIN + p.PCT_IMPREV);
  const diasPorLavada = nLavadas > 0 ? Math.ceil((args.m2 / p.PROD_MIXTA) * 2) / 2 : 0;
  const costoLavadas = diasPorLavada * nLavadas * costoOpDia;
  const costoInspeccion = insp.costoOperacionInsp;
  const feeNoruega = valorAnual * p.FEE_NORUEGA;
  const comision = valorAnual * (args.comisionPct ?? 0.05);
  const costoTotal = costoLavadas + costoInspeccion + feeNoruega + comision;
  const margenD = valorAnual - costoTotal;
  const margenP = valorAnual > 0 ? margenD / valorAnual : 0;

  return {
    valorAnual, valorMensual: valorAnual / 12,
    nLavadas, diasOperacion: diasPorLavada * nLavadas + insp.diasOperacionInsp,
    costoLavadas, costoInspeccion, feeNoruega, comision, costoTotal, margenD, margenP,
  };
}

// Regla Gerencia 2026-07-13: la propuesta de Care siempre muestra los 3
// paquetes juntos (comparación), nunca uno solo — este helper calcula los 3
// de una vez con los mismos m2/techo capturados en el formulario.
export function calcularCareTodos(p: Parametros, args: { m2: number; techo: number; comisionPct?: number }) {
  return {
    INSPECT: calcularCare(p, { plan: 'INSPECT', ...args }),
    ESSENTIAL: calcularCare(p, { plan: 'ESSENTIAL', ...args }),
    COMPLETE: calcularCare(p, { plan: 'COMPLETE', ...args }),
  };
}
