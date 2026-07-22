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
  // --- Costo real del DV dentro de Care (spec_calcularCare.md 2026-07-14) ---
  // ⚠️ PROVISIONAL — pendiente validar con Gerencia: supone 2 pilotos fijos rotando cada 30 min
  // (norma Aerocivil) y un % de depreciación de flota exclusivo de equipos de inspección (no de
  // lavado). Costo operativo puro (vuelo + IA + validación humana), SIN fee a Noruega.
  COSTO_OPERATIVO_DV_TRAMO_1: number; // techo pequeño — 1 día
  COSTO_OPERATIVO_DV_TRAMO_2: number; // techo mediano — 2 días
  COSTO_OPERATIVO_DV_TRAMO_3: number; // techo grande — 3 días
  // --- Días reales de ejecución del lavado (spec_lavado_items_dias_20260717.md) ---
  // ⚠️ TODO ESTIMADO PROVISIONAL — pendiente calibrar con datos reales de campo en
  // cuanto se ejecute el primer proyecto de lavado. La ficha técnica del fabricante
  // (1.500 m²/hora fachada, 600 m²/hora cristales) es velocidad de laboratorio, no
  // rendimiento sostenido — de ahí el factor de eficiencia operativa conservador.
  PROD_FACHADA_M2_HORA: number;
  PROD_CRISTALES_M2_HORA: number;
  HORAS_JORNADA: number;
  FACTOR_EFICIENCIA_OPERATIVA: number;
  FACTOR_DIFICULTAD_TIEMPO_MEDIO: number;
  FACTOR_DIFICULTAD_TIEMPO_ALTO: number;
};

// Valores iniciales — idénticos a los de cotizador.html / KWD-FIN-MPV-001 v1.5.
// Se siembran en la tabla `parametros` y desde ahí Gerencia los edita sin tocar código.
export const PARAMETROS_INICIALES: Parametros = {
  TARIFA_LISTA: 6000,
  TRM: 3727.2,
  EUR_COP: 4400,
  FEE_NORUEGA: 0.07, // Artículo 8 del contrato de franquicia — 7% de TODA la facturación, corregido 2026-07-16 (antes 3,5% por error)
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
  MINIMO_PROYECTO_LAVADO: 1600000, // recalculado 2026-07-16 tras corrección del fee Noruega a 7% — con este piso el lavado más chico (sin recargo) vuelve a dar ~35% de margen
  INT_PISO_MERCADO: 9000000,       // aprobado por Gerencia 2026-07-12 — piso del estudio de mercado; solo afecta el tramo pequeño (los otros ya lo superan)
  COSTO_OPERATIVO_DV_TRAMO_1: 631000,  // ⚠️ estimado 2026-07-14 — pendiente validar con Gerencia
  COSTO_OPERATIVO_DV_TRAMO_2: 1262000, // ⚠️ estimado 2026-07-14 — pendiente validar con Gerencia
  COSTO_OPERATIVO_DV_TRAMO_3: 1893000, // ⚠️ estimado 2026-07-14 — pendiente validar con Gerencia
  PROD_FACHADA_M2_HORA: 1500,   // ficha técnica del fabricante — velocidad de laboratorio
  PROD_CRISTALES_M2_HORA: 600,  // ficha técnica del fabricante — velocidad de laboratorio
  HORAS_JORNADA: 6,             // confirmado por Gerencia 2026-07-17
  FACTOR_EFICIENCIA_OPERATIVA: 0.45, // ⚠️ ESTIMADO PROVISIONAL — sin proyectos ejecutados aún, calibrar con datos reales
  FACTOR_DIFICULTAD_TIEMPO_MEDIO: 0.90, // ⚠️ ESTIMADO PROVISIONAL
  FACTOR_DIFICULTAD_TIEMPO_ALTO: 0.80,  // ⚠️ ESTIMADO PROVISIONAL
};

export type Superficie = 'VIDRIO' | 'MIXTA' | 'DIFICIL';
export type NivelRecargo = 'BAJO' | 'MEDIO' | 'ALTO';

const RECARGO_PCT: Record<NivelRecargo, number> = { BAJO: 0, MEDIO: 0.05, ALTO: 0.10 };

function productividad(p: Parametros, s: Superficie) {
  return s === 'VIDRIO' ? p.PROD_VIDRIO : s === 'MIXTA' ? p.PROD_MIXTA : p.PROD_DIFICIL;
}

// Ítems de lavado seleccionables (spec_lavado_items_dias_20260717.md) — mismo
// precio por m², solo cambia qué área se suma y el texto en la propuesta.
export type ConceptoLavado = 'SOLO_VENTANAS' | 'SOLO_FACHADA' | 'FACHADA_Y_VENTANAS';

const FACTOR_DIFICULTAD_TIEMPO: Record<NivelRecargo, keyof Pick<Parametros, 'FACTOR_DIFICULTAD_TIEMPO_MEDIO' | 'FACTOR_DIFICULTAD_TIEMPO_ALTO'> | null> = {
  BAJO: null, MEDIO: 'FACTOR_DIFICULTAD_TIEMPO_MEDIO', ALTO: 'FACTOR_DIFICULTAD_TIEMPO_ALTO',
};

// Días REALES de ejecución en sitio para prometer al cliente (distinto de
// `dias` dentro de calcularLavado, que son días de cuadrilla para COSTEO
// interno). Usa la velocidad del fabricante × jornada × eficiencia operativa,
// con reducción de productividad por dificultad del edificio (el tiempo
// también se alarga en edificios difíciles, no solo el precio).
export function calcularDiasEjecucion(p: Parametros, args: { m2Vidrio: number; m2Opaca: number; dificultad: NivelRecargo }) {
  const factorDificultad = FACTOR_DIFICULTAD_TIEMPO[args.dificultad] ? p[FACTOR_DIFICULTAD_TIEMPO[args.dificultad]!] : 1;
  const prodFachadaDia = p.PROD_FACHADA_M2_HORA * p.HORAS_JORNADA * p.FACTOR_EFICIENCIA_OPERATIVA * factorDificultad;
  const prodCristalesDia = p.PROD_CRISTALES_M2_HORA * p.HORAS_JORNADA * p.FACTOR_EFICIENCIA_OPERATIVA * factorDificultad;
  const diasFachada = prodFachadaDia > 0 ? args.m2Opaca / prodFachadaDia : 0;
  const diasCristales = prodCristalesDia > 0 ? args.m2Vidrio / prodCristalesDia : 0;
  return Math.ceil((diasFachada + diasCristales) * 2) / 2;
}

export function calcularLavado(p: Parametros, args: {
  m2: number; superficie: Superficie; tipoEdificio: NivelRecargo; dificultad: NivelRecargo;
  movilizacion: number; comisionPct: number; descuentoPct?: number;
}) {
  const costoOpDia = (p.CUADRILLA_DIA + p.CONSUMIBLES_DIA + p.DEPRECIACION_DIA) * (1 + p.PCT_ADMIN + p.PCT_IMPREV);
  const dias = Math.ceil((args.m2 / productividad(p, args.superficie)) * 2) / 2;
  const recargo = RECARGO_PCT[args.tipoEdificio] + RECARGO_PCT[args.dificultad];
  const costoOperacion = dias * costoOpDia * (1 + recargo) + args.movilizacion;
  // Cargo mínimo por proyecto: el costo de salir a operar no baja de medio día aunque el
  // edificio sea diminuto — sin este piso, fachadas chicas daban margen negativo (hasta -377%).
  // (?? 0: snapshots congelados de cotizaciones anteriores a este parámetro no lo traen)
  const precioBase = Math.max(args.m2 * p.TARIFA_LISTA, p.MINIMO_PROYECTO_LAVADO ?? 0);
  // Corrección Gerencia 2026-07-16: el recargo por edificio/dificultad SIEMPRE se
  // traslada al precio — antes solo subía el costo interno y KTV absorbía la
  // diferencia en silencio. Un recargo es, por definición, algo que paga el cliente.
  const precioConRecargo = precioBase * (1 + recargo);
  // Piso de margen: los días se redondean a bloques de 0.5 pero el precio escala
  // continuo por m² — justo después de cada salto de medio día, el costo sube más
  // rápido que el precio. Este piso garantiza que ningún lavado salga jamás por
  // debajo del margen mínimo por un efecto de redondeo (no cambia el precio normal
  // el resto del tiempo, solo actúa cuando el redondeo lo exige).
  const precioPisoMargen = costoOperacion / (1 - p.MARGEN_MINIMO - p.FEE_NORUEGA - args.comisionPct);
  const precioListaSinDescuento = Math.max(precioConRecargo, precioPisoMargen);
  // Descuento manual (Gerencia 2026-07-17): se aplica DESPUÉS del piso de margen
  // automático — es una decisión comercial deliberada, no un efecto de redondeo a
  // corregir. El fee/comisión se recalculan sobre el precio YA descontado (son
  // regalías sobre facturación real, nunca sobre el precio de lista). El piso de
  // 35% para descuentos se valida en la acción del servidor, no aquí.
  const precioLavado = precioListaSinDescuento * (1 - (args.descuentoPct ?? 0) / 100);
  const feeNoruega = precioLavado * p.FEE_NORUEGA;
  const comision = precioLavado * args.comisionPct;
  const costoTotal = costoOperacion + feeNoruega + comision;
  const margenD = precioLavado - costoTotal;
  const margenP = precioLavado > 0 ? margenD / precioLavado : 0;
  return { dias, costoOpDia, costoOperacion, precioLavado, precioListaSinDescuento, feeNoruega, comision, costoTotal, margenD, margenP };
}

// ============================================================================
// Ítems de lavado — MÚLTIPLES por cotización (spec_multi_item_lavado_20260722.md):
// un cliente puede pedir varios edificios/superficies distintos en un solo
// documento (ej. torre + fachada Alucobond + letreros). Cada ítem se costea
// por separado (su propia área/dificultad determina su costo de cuadrilla),
// pero el piso de proyecto (MINIMO_PROYECTO_LAVADO — una sola movilización) y
// el piso de margen se evalúan UNA vez sobre el TOTAL, nunca por ítem — igual
// que antes se evaluaban sobre el único ítem de una cotización de un solo
// edificio. El precio final ya con piso/descuento se reparte de vuelta a cada
// ítem a prorrata de su peso en el precio de lista, para que el cliente vea
// un precio propio por cada línea que sume exactamente al total.
export type ItemLavadoInput = {
  nombre: string; concepto: ConceptoLavado;
  m2Vidrio: number; m2Opaca: number; superficie: Superficie; tipoEdificio: NivelRecargo; dificultad: NivelRecargo;
};

export function calcularLavadoMultiItem(p: Parametros, args: { items: ItemLavadoInput[]; comisionPct: number; descuentoPct?: number }) {
  const costoOpDia = (p.CUADRILLA_DIA + p.CONSUMIBLES_DIA + p.DEPRECIACION_DIA) * (1 + p.PCT_ADMIN + p.PCT_IMPREV);

  const filas = args.items.map((it) => {
    const m2 = it.m2Vidrio + it.m2Opaca;
    const dias = Math.ceil((m2 / productividad(p, it.superficie)) * 2) / 2;
    const recargo = RECARGO_PCT[it.tipoEdificio] + RECARGO_PCT[it.dificultad];
    const costoOperacion = dias * costoOpDia * (1 + recargo);
    // Sin piso de proyecto ni piso de margen aquí — se aplican una sola vez
    // abajo, sobre la suma de todos los ítems (ver comentario de arriba).
    const precioConRecargo = m2 * p.TARIFA_LISTA * (1 + recargo);
    const diasEjecucionSistema = calcularDiasEjecucion(p, { m2Vidrio: it.m2Vidrio, m2Opaca: it.m2Opaca, dificultad: it.dificultad });
    return { ...it, m2, dias, recargo, costoOperacion, precioConRecargo, diasEjecucionSistema };
  });

  const sumaCostoOperacion = filas.reduce((s, f) => s + f.costoOperacion, 0);
  const sumaPrecioConRecargo = filas.reduce((s, f) => s + f.precioConRecargo, 0);
  const sumaDias = filas.reduce((s, f) => s + f.dias, 0);
  const diasEjecucionSistema = filas.reduce((s, f) => s + f.diasEjecucionSistema, 0);

  const precioBase = Math.max(sumaPrecioConRecargo, p.MINIMO_PROYECTO_LAVADO ?? 0);
  const precioPisoMargen = sumaCostoOperacion / (1 - p.MARGEN_MINIMO - p.FEE_NORUEGA - args.comisionPct);
  const precioListaSinDescuento = Math.max(precioBase, precioPisoMargen);
  const precioLavado = precioListaSinDescuento * (1 - (args.descuentoPct ?? 0) / 100);
  const feeNoruega = precioLavado * p.FEE_NORUEGA;
  const comision = precioLavado * args.comisionPct;
  const costoTotal = sumaCostoOperacion + feeNoruega + comision;
  const margenD = precioLavado - costoTotal;
  const margenP = precioLavado > 0 ? margenD / precioLavado : 0;

  // Reparto proporcional del precio final a cada ítem — el último absorbe el
  // residuo de redondeo para que la suma cuadre exacto con `precioLavado`.
  let acumulado = 0;
  const items = filas.map((f, i) => {
    const peso = sumaPrecioConRecargo > 0 ? f.precioConRecargo / sumaPrecioConRecargo : 1 / filas.length;
    const feeNoruegaItem = feeNoruega * peso;
    let precioItem: number;
    if (i === filas.length - 1) {
      precioItem = Math.round((precioLavado - acumulado) * 100) / 100;
    } else {
      precioItem = Math.round(precioLavado * peso * 100) / 100;
      acumulado += precioItem;
    }
    return { ...f, peso, precioLavado: precioItem, feeNoruega: feeNoruegaItem };
  });

  return {
    dias: sumaDias, costoOpDia, costoOperacion: sumaCostoOperacion, precioLavado, precioListaSinDescuento,
    feeNoruega, comision, costoTotal, margenD, margenP, diasEjecucionSistema, items,
  };
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

// Care — costo y margen REALES (spec_calcularCare.md 2026-07-14):
// - Lavadas: mismas fórmulas de días×costo/día del lavado puntual — superficie real
//   (productividad) y recargo de edificio/dificultad, igual que Familia 1. Corrección
//   2026-07-16: antes SIEMPRE asumía MIXTA/BAJO/BAJO sin importar el edificio real, el
//   mismo hueco de margen que ya se corrigió en calcularLavado — el recargo también se
//   traslada al precio de la lavada dentro de la cuota, no solo al costo.
// - Inspección: DV e II NUNCA son el mismo costo — el DV no paga fee a Noruega, el II sí.
//   costo_DV = COSTO_OPERATIVO_DV_TRAMO[tramo] (costo operativo puro, sin fee).
//   costo_II = fee Noruega (mismo cálculo que Familia 1) + costoOperacionInsp existente.
// - Complete entrega 2 inspecciones en los 3 años del contrato (nunca 3): año 1 = II
//   (costo mucho mayor por el fee), año 2 sin inspección (solo las 2 lavadas de fachada
//   se mantienen), año 3 = DV — decisión Gerencia 2026-07-15, para dejar un punto de
//   contacto con informe justo antes de la renovación. El precio de venta (valorAnual)
//   es una cuota estable — no cambia por año — pero el margen SÍ depende del año, así
//   que se devuelve un desglose por año (`porAnio`) en vez de un margen único que
//   promediaría (y escondería) un año 1 más ajustado.
// - Fee Noruega 7% sobre el valor anual + comisión comercial (5% venta en frío por
//   defecto — año 1; las renovaciones al 1% mejoran el margen en años siguientes).
export function calcularCare(p: Parametros, args: {
  plan: 'INSPECT' | 'ESSENTIAL' | 'COMPLETE'; m2: number; techo: number; comisionPct?: number;
  superficie?: Superficie; tipoEdificio?: NivelRecargo; dificultad?: NivelRecargo;
}) {
  const superficie = args.superficie ?? 'MIXTA';
  const recargo = RECARGO_PCT[args.tipoEdificio ?? 'BAJO'] + RECARGO_PCT[args.dificultad ?? 'BAJO'];

  const insp = calcularInspeccion(p, args.techo);
  const dv = insp.dvPrecio;

  const tier = tierTecho(p, args.techo);
  const tablaCostoDV = [p.COSTO_OPERATIVO_DV_TRAMO_1, p.COSTO_OPERATIVO_DV_TRAMO_2, p.COSTO_OPERATIVO_DV_TRAMO_3];
  const costoDV = tier !== null ? tablaCostoDV[tier] : p.COSTO_OPERATIVO_DV_TRAMO_3; // fuera de rango: tramo más conservador
  const costoII = insp.feeNoruegaCop !== null ? insp.feeNoruegaCop + insp.costoOperacionInsp : null;

  const costoOpDia = (p.CUADRILLA_DIA + p.CONSUMIBLES_DIA + p.DEPRECIACION_DIA) * (1 + p.PCT_ADMIN + p.PCT_IMPREV);
  const diasUnaLavada = Math.ceil((args.m2 / productividad(p, superficie)) * 2) / 2;
  const costoUnaLavada = diasUnaLavada * costoOpDia * (1 + recargo);

  const nLavadas = args.plan === 'INSPECT' ? 0 : args.plan === 'ESSENTIAL' ? 1 : 2;
  let valorAnual: number;
  if (args.plan === 'INSPECT') {
    valorAnual = dv;
  } else if (args.plan === 'ESSENTIAL') {
    valorAnual = args.m2 * p.TARIFA_LISTA * (1 - p.CARE_ESSENTIAL_DESC) * (1 + recargo) + dv;
  } else {
    // Complete cobra por el Informe Internacional (lo que realmente entrega en año 1,
    // aunque sea una sola vez en los 3 años), no por el DV — mucho más barato — como
    // se hacía antes. Corrección Gerencia 2026-07-14: la cuota estaba fijada con el
    // valor equivocado, por eso el margen de año 1 caía por debajo del piso del 35%.
    valorAnual = 2 * args.m2 * p.TARIFA_LISTA * (1 - p.CARE_COMPLETE_DESC) * (1 + recargo) + (insp.precioInternacional ?? dv);
  }

  const feeNoruega = valorAnual * p.FEE_NORUEGA;
  const comision = valorAnual * (args.comisionPct ?? 0.05);
  const costoLavadas = costoUnaLavada * nLavadas;
  const diasOperacionLavadas = diasUnaLavada * nLavadas;

  if (args.plan === 'COMPLETE') {
    const margenP = (costo: number) => (valorAnual > 0 ? (valorAnual - costo) / valorAnual : 0);

    // Año 1: II (costo mucho mayor por el fee Noruega).
    const costoTotalAnio1 = (costoII ?? 0) + costoLavadas + feeNoruega + comision;
    // Año 2: sin inspección — solo se mantienen las 2 lavadas de fachada.
    const costoTotalAnio2 = costoLavadas + feeNoruega + comision;
    // Año 3: DV — punto de contacto con informe justo antes de la renovación.
    const costoTotalAnio3 = costoDV + costoLavadas + feeNoruega + comision;

    const porAnio = {
      1: { entregable: 'II' as const, costoTotal: costoTotalAnio1, margenD: valorAnual - costoTotalAnio1, margenP: margenP(costoTotalAnio1) },
      2: { entregable: null, costoTotal: costoTotalAnio2, margenD: valorAnual - costoTotalAnio2, margenP: margenP(costoTotalAnio2) },
      3: { entregable: 'DV' as const, costoTotal: costoTotalAnio3, margenD: valorAnual - costoTotalAnio3, margenP: margenP(costoTotalAnio3) },
    };
    // margenP a nivel de paquete = el peor de los 3 años — nunca promediar (esconde el año 1).
    const margenPMinimo = Math.min(porAnio[1].margenP, porAnio[2].margenP, porAnio[3].margenP);

    return {
      valorAnual, valorMensual: valorAnual / 12,
      nLavadas, diasOperacion: diasOperacionLavadas + insp.diasOperacionInsp,
      costoLavadas, feeNoruega, comision, porAnio, margenP: margenPMinimo,
    };
  }

  // INSPECT y ESSENTIAL: un único año, siempre DV — sin cambio de entregable.
  const costoTotal = costoDV + costoLavadas + feeNoruega + comision;
  const margenD = valorAnual - costoTotal;
  const margenP = valorAnual > 0 ? margenD / valorAnual : 0;

  return {
    valorAnual, valorMensual: valorAnual / 12,
    nLavadas, diasOperacion: diasOperacionLavadas + insp.diasOperacionInsp,
    costoLavadas, costoInspeccion: costoDV, feeNoruega, comision, costoTotal, margenD, margenP,
  };
}

// Regla Gerencia 2026-07-13: la propuesta de Care siempre muestra los 3
// paquetes juntos (comparación), nunca uno solo — este helper calcula los 3
// de una vez con los mismos m2/techo capturados en el formulario.
export function calcularCareTodos(p: Parametros, args: {
  m2: number; techo: number; comisionPct?: number;
  superficie?: Superficie; tipoEdificio?: NivelRecargo; dificultad?: NivelRecargo;
}) {
  return {
    INSPECT: calcularCare(p, { plan: 'INSPECT', ...args }),
    ESSENTIAL: calcularCare(p, { plan: 'ESSENTIAL', ...args }),
    COMPLETE: calcularCare(p, { plan: 'COMPLETE', ...args }),
  };
}

// ============================================================================
// Ítems de Terceros (spec_items_terceros_20260716_2.md): productos o servicios
// que KTV subcontrata y revende con margen, facturados bajo el nombre de KTV.
// Margen NETO fijo, no editable — se resuelve DESPUÉS de restar el 7% de
// Noruega (Art. 2 del contrato: el royalty aplica también a estos ítems), no
// antes. "Producto" = compra y entrega sin coordinar personal en sitio (15%
// neto). "Servicio" = coordina personal de un tercero en sitio del cliente,
// asume riesgo de marca (25% neto).
// ============================================================================
export type TipoItemTercero = 'PRODUCTO' | 'SERVICIO';

export const MARGEN_NETO_TERCERO: Record<TipoItemTercero, number> = { PRODUCTO: 0.15, SERVICIO: 0.25 };

export function calcularItemTercero(p: Parametros, args: { tipo: TipoItemTercero; costoReal: number }) {
  const margenNetoDeseado = MARGEN_NETO_TERCERO[args.tipo];
  const precioVenta = args.costoReal / (1 - p.FEE_NORUEGA - margenNetoDeseado);
  return { margenNetoDeseado, precioVenta };
}
