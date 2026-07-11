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
  DIAS_INSPECCION: number;
  COSTO_DIA_INSPECCION: number;
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
  DIAS_INSPECCION: 0.5,
  COSTO_DIA_INSPECCION: 814381,
  IVA: 0.19,
  CARE_ESSENTIAL_DESC: 0.06,
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
  MARGEN_MINIMO: 0.25,
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
  const precioLavado = args.m2 * p.TARIFA_LISTA;
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

export function calcularInspeccion(p: Parametros, techo: number) {
  const tier = tierTecho(p, techo);
  const dvPrecio = tier !== null ? [p.DV_TIER_1, p.DV_TIER_2, p.DV_TIER_3][tier] : p.DV_PRECIO;
  const feeEur = tier !== null ? [p.ROOF_FEE_1_EUR, p.ROOF_FEE_2_EUR, p.ROOF_FEE_3_EUR][tier] : null;
  const costoOperacionInsp = p.COSTO_DIA_INSPECCION * p.DIAS_INSPECCION;
  const feeNoruegaCop = feeEur !== null ? feeEur * p.EUR_COP : null;
  const precioInternacional = feeNoruegaCop !== null ? 2 * feeNoruegaCop + costoOperacionInsp : null;
  const feeNoruegaSobreVenta = (venta: number) => venta * p.FEE_NORUEGA;

  const dvMargenD = dvPrecio - costoOperacionInsp - feeNoruegaSobreVenta(dvPrecio);
  const intMargenD = precioInternacional !== null
    ? precioInternacional - (feeNoruegaCop as number) - costoOperacionInsp - feeNoruegaSobreVenta(precioInternacional)
    : null;

  return {
    tier, dvPrecio, feeEur, feeNoruegaCop, costoOperacionInsp, precioInternacional,
    fueraDeRango: techo > p.ROOF_TIER_3_MAX,
    dvMargenD, dvMargenP: dvPrecio > 0 ? dvMargenD / dvPrecio : 0,
    intMargenD, intMargenP: precioInternacional && intMargenD !== null ? intMargenD / precioInternacional : null,
  };
}

export function calcularCare(p: Parametros, args: { plan: 'INSPECT' | 'ESSENTIAL' | 'COMPLETE'; m2: number; techo: number }) {
  const insp = calcularInspeccion(p, args.techo);
  const dv = insp.dvPrecio;
  if (args.plan === 'INSPECT') {
    return { valorAnual: dv, valorMensual: dv / 12 };
  }
  if (args.plan === 'ESSENTIAL') {
    const anual = args.m2 * p.TARIFA_LISTA * (1 - p.CARE_ESSENTIAL_DESC) + dv;
    return { valorAnual: anual, valorMensual: anual / 12 };
  }
  const anual = 2 * args.m2 * p.TARIFA_LISTA * (1 - p.CARE_COMPLETE_DESC) + dv;
  return { valorAnual: anual, valorMensual: anual / 12 };
}
