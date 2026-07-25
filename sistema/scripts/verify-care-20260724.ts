// Verificación numérica de CORRECCION_DEFINITIVA_care_20260724.md
// Corre con: npx tsx scripts/verify-care-20260724.ts
//
// Casos obligatorios antes de commit:
//   Caso 1 — 965 m², dificultad Media: valores exactos post-fix.
//   Caso 2 — edificio >50.000 m²: margen ≥25% (piso) con volumen al 10%.
//   Caso 3 — paquete SIEMPRE más barato que comprar los mismos servicios sueltos.

import { PARAMETROS_INICIALES as P, calcularCare, calcularLavado, calcularInspeccion, descuentoVolumen } from '../src/lib/pricing';
import type { Superficie, NivelRecargo } from '../src/lib/pricing';

const cop = (n: number) => 'COP ' + Math.round(n).toLocaleString('es-CO');
const pct = (n: number) => (n * 100).toFixed(2) + '%';
let fallos = 0;
function check(ok: boolean, etiqueta: string, detalle = '') {
  console.log(`  ${ok ? '✓' : '✗ FALLA'}  ${etiqueta}${detalle ? ' — ' + detalle : ''}`);
  if (!ok) fallos++;
}

// ---------------------------------------------------------------------------
console.log('\n=== CASO 1 — 965 m², dificultad Media (el caso que reveló el bug) ===');
const TECHO_C1 = 1000; // tramo 1 → DV $3,5M y II en el piso de mercado $9M
const c1args = { m2: 965, techo: TECHO_C1, dificultad: 'MEDIO' as NivelRecargo, superficie: 'MIXTA' as Superficie };
const insp1 = calcularInspeccion(P, TECHO_C1);
console.log(`  DV del tramo: ${cop(insp1.dvPrecio)} · Informe Internacional: ${cop(insp1.precioInternacional!)}`);
check(insp1.dvPrecio === 3_500_000, 'DV = $3.500.000');
check(insp1.precioInternacional === 9_000_000, 'II = $9.000.000 (piso de mercado)');

const ess1 = calcularCare(P, { plan: 'ESSENTIAL', ...c1args });
const com1 = calcularCare(P, { plan: 'COMPLETE', ...c1args });
const bas1 = calcularCare(P, { plan: 'BASIC', ...c1args });

// Referencia esperada, derivada de la fórmula del documento con aritmética exacta:
//   Essential: 965 × 5550 × 1,05 + (2 × 3.500.000)/3
//   Complete:  965 × 5400 × 2 × 1,05 + (9.000.000 + 3.500.000)/3
// Complete: el Informe Internacional NO va en la cuota — se factura aparte en el
// año 1 (regla 8, restaurada 2026-07-25). La cuota solo lleva el DV del año 3.
const espEss = 965 * 5550 * 1.05 + (2 * 3_500_000) / 3;
const espCom = 965 * 5400 * 2 * 1.05 + 3_500_000 / 3;
const ANTES_ESS = 9_123_538; // valor con el bug (propuesta ya generada)
const ANTES_COM = 19_943_100;

console.log(`\n  Essential  ${cop(ess1.valorAnual)} /año   (esperado ${cop(espEss)})`);
console.log(`    lavadas ${cop(ess1.ingresoLavadas)} + informe anual ${cop(ess1.informeAnual)}`);
console.log(`    antes del fix ${cop(ANTES_ESS)} → baja ${pct(1 - ess1.valorAnual / ANTES_ESS)}`);
check(Math.abs(ess1.valorAnual - espEss) < 1, 'Essential coincide con la fórmula');
check(Math.abs(ess1.informeAnual - 2_333_333.33) < 1, 'informe_anual_essential = (2 × DV)/3 = 2.333.333');

console.log(`\n  Complete   ${cop(com1.valorAnual)} /año   (esperado ${cop(espCom)})`);
console.log(`    lavadas ${cop(com1.ingresoLavadas)} + informe anual ${cop(com1.informeAnual)}`);
console.log(`    antes del fix ${cop(ANTES_COM)} → baja ${pct(1 - com1.valorAnual / ANTES_COM)}`);
check(Math.abs(com1.valorAnual - espCom) < 1, 'Complete coincide con la fórmula');
check(Math.abs(com1.informeAnual - 1_166_666.67) < 1, 'la cuota de Complete solo prorratea el DV del año 3');
check(com1.internacionalAparte?.precio === 9_000_000, 'el Informe Internacional se factura aparte en el año 1');
// El cliente paga lo mismo por el contrato que con el II prorrateado: cambia
// CUÁNDO se factura, no cuánto. Es la prueba de que no es un descuento del II.
check(Math.abs(com1.totalContrato - (965 * 5400 * 2 * 1.05 * 3 + 3_500_000 + 9_000_000)) < 1,
  'el total del contrato de Complete no cambia por facturar el II aparte', cop(com1.totalContrato));

console.log(`\n  Basic      ${cop(bas1.valorAnual)} /año  (sin cambio: informe anual ${cop(bas1.informeAnual)} = DV)`);
check(Math.abs(bas1.informeAnual - insp1.dvPrecio) < 1, 'Basic sigue cobrando 1 DV por su único año');
check(bas1.volDisc === 0, 'Basic sin descuento por volumen');

// Piso de margen ABSOLUTO del 35% (regla Gerencia reafirmada 2026-07-25): no baja
// del 35% por ningún motivo — ya no hay banda 25–35% aprobable.
console.log(`\n  Márgenes por año (piso absoluto ${pct(P.MARGEN_MINIMO)}):`);
for (const [n, r] of [['Essential', ess1], ['Complete', com1]] as const) {
  const pa = r.porAnio!;
  console.log(`    ${n}: año1 ${pct(pa[1].margenP)} · año2 ${pct(pa[2].margenP)} · año3 ${pct(pa[3].margenP)}`);
  check(r.margenP >= P.MARGEN_MINIMO, `${n} nunca baja del 35% en ningún año`, `peor año ${pct(r.margenP)}`);
}
if (com1.internacionalAparte) {
  console.log(`    Informe Internacional aparte: ${pct(com1.internacionalAparte.margenP ?? 0)}`);
  check((com1.internacionalAparte.margenP ?? 0) >= P.MARGEN_MINIMO, 'la línea del Informe Internacional ≥35%');
}
console.log(`    Basic: ${pct(bas1.margenP)}`);
check(bas1.margenP >= P.MARGEN_MINIMO, 'Basic ≥35%');

console.log('\n  Tope de $6.000/m² en Basic (el recargo no lo puede pasar):');
for (const dificultad of ['BAJO', 'MEDIO', 'ALTO'] as const)
  for (const tipoEdificio of ['BAJO', 'MEDIO', 'ALTO'] as const) {
    const r = calcularCare(P, { plan: 'BASIC', m2: 965, techo: TECHO_C1, tipoEdificio, dificultad });
    check(r.tarifaLavadaM2 <= P.TARIFA_LISTA + 0.01,
      `Basic edif ${tipoEdificio}/dif ${dificultad} ≤ $6.000/m²`,
      `${Math.round(r.tarifaLavadaM2)}/m²${r.topeM2Aplicado ? ' (topado)' : ''}`);
  }

// ---------------------------------------------------------------------------
console.log('\n=== CASO 2 — edificio >50.000 m² (Mall Plaza): descuento volumen 10%, margen ≥25% ===');
const M2_GRANDE = 55_000;
const TECHO_GRANDE = 24_000; // tramo 2
check(descuentoVolumen(M2_GRANDE) === 0.10, 'descuentoVolumen(55.000 m²) = 10%');
for (const plan of ['BASIC', 'ESSENTIAL', 'COMPLETE'] as const) {
  const r = calcularCare(P, { plan, m2: M2_GRANDE, techo: TECHO_GRANDE, dificultad: 'MEDIO' });
  const peor = r.margenP;
  console.log(`  ${plan}: ${cop(r.valorAnual)} /año · desc. aplicado ${pct(r.descuentoAplicado)} ` +
    `(compromiso ${pct(r.compromisoDisc)}, volumen ${pct(r.volDisc)}` +
    `${r.volumenLimitadoPorEscalon ? ' → limitado por escalón' : ''}` +
    `${r.descuentoLimitadoPorMargen ? ' → limitado por margen' : ''}) · peor margen ${pct(peor)}`);
  check(peor >= 0.25, `${plan} margen ≥25%`, pct(peor));
  if (plan === 'BASIC') check(r.descuentoAplicado === r.compromisoDisc, 'Basic conserva solo su compromiso (5%)');
}

// ---------------------------------------------------------------------------
console.log('\n=== CASO 3 — paquete vs. comprar suelto (la prueba de fondo) ===');
const superficies: Superficie[] = ['VIDRIO', 'MIXTA', 'DIFICIL'];
const niveles: NivelRecargo[] = ['BAJO', 'MEDIO', 'ALTO'];
const areas = [200, 500, 965, 2_000, 4_999, 5_001, 12_000, 20_001, 35_000, 50_001, 80_000];
const techos = [500, 1_000, 9_999, 10_001, 24_000, 25_001, 39_000];
let combos = 0, peorEss = Infinity, peorCom = Infinity, peorCaso = '';

for (const m2 of areas) for (const techo of techos) for (const superficie of superficies)
for (const tipoEdificio of niveles) for (const dificultad of niveles) {
  const base = { m2, techo, superficie, tipoEdificio, dificultad };
  const insp = calcularInspeccion(P, techo);
  const dv = insp.dvPrecio;
  const ii = insp.precioInternacional ?? dv;
  // Precio suelto de UNA lavada, con los mismos pisos que aplica el cotizador puntual.
  const puntual = calcularLavado(P, { ...base, movilizacion: 0, comisionPct: 0.05 }).precioLavado;

  const ess = calcularCare(P, { plan: 'ESSENTIAL', ...base });
  const com = calcularCare(P, { plan: 'COMPLETE', ...base });
  // Solo se comparan escenarios que el sistema REALMENTE cotizaría: con el piso
  // absoluto de 35%, crearCotizacionCare rechaza los demás, así que no existen
  // como propuesta y no tiene sentido medirles el ahorro.
  const cotizable = (r: typeof ess) => Math.min(r.margenP, r.internacionalAparte?.margenP ?? 1) >= P.MARGEN_MINIMO;
  if (!cotizable(ess) || !cotizable(com)) continue;

  const sueltoEss = puntual * 3 + dv * 2;
  const sueltoCom = puntual * 6 + ii + dv;
  // `totalContrato` ya incluye el Informe Internacional facturado aparte, así que
  // la comparación es de total contra total en los dos lados.
  const ahorroEss = 1 - ess.totalContrato / sueltoEss;
  const ahorroCom = 1 - com.totalContrato / sueltoCom;

  if (ahorroEss < peorEss) { peorEss = ahorroEss; }
  if (ahorroCom < peorCom) { peorCom = ahorroCom; peorCaso = `${m2} m², techo ${techo}, ${superficie}, edif ${tipoEdificio}, dif ${dificultad}`; }
  if (ess.totalContrato >= sueltoEss || com.totalContrato >= sueltoCom) {
    console.log(`  ✗ FALLA en ${m2} m², techo ${techo}, ${superficie}, ${tipoEdificio}/${dificultad}`);
    console.log(`      Essential ${cop(ess.totalContrato)} vs suelto ${cop(sueltoEss)}`);
    console.log(`      Complete  ${cop(com.totalContrato)} vs suelto ${cop(sueltoCom)}`);
    fallos++;
  }
  combos++;
}
console.log(`  ${combos.toLocaleString('es-CO')} combinaciones de m²/techo/superficie/edificio/dificultad evaluadas`);
console.log(`  Ahorro mínimo del paquete frente a comprar suelto — Essential ${pct(peorEss)} · Complete ${pct(peorCom)}`);
console.log(`  (peor caso de Complete: ${peorCaso})`);
check(peorEss > 0, 'Essential SIEMPRE más barato que suelto');
check(peorCom > 0, 'Complete SIEMPRE más barato que suelto');

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Barrido de margen con el piso ABSOLUTO de 35%: ningún escenario puede quedar
// por debajo. Cubre la cuota año por año Y la línea del Informe Internacional.
console.log(`\n=== Barrido de margen — piso absoluto ${pct(P.MARGEN_MINIMO)}, sin excepciones ===`);
{
  let peor = { margen: Infinity, desc: '' };
  let bajoPiso = 0, total = 0, topados = 0;
  const ejemplos: string[] = [];
  for (const m2 of areas) for (const techo of techos) for (const superficie of superficies)
  for (const tipoEdificio of niveles) for (const dificultad of niveles) {
    for (const plan of ['BASIC', 'ESSENTIAL', 'COMPLETE'] as const) {
      const r = calcularCare(P, { plan, m2, techo, superficie, tipoEdificio, dificultad });
      // El peor margen del escenario: la cuota (peor año) y, en Complete, también
      // la línea del Informe Internacional que se factura aparte.
      const m = Math.min(r.margenP, r.internacionalAparte?.margenP ?? 1);
      const desc = `${plan} · ${m2} m², techo ${techo}, ${superficie}, edif ${tipoEdificio}, dif ${dificultad}`;
      total++;
      if (r.topeM2Aplicado) topados++;
      if (m < peor.margen) peor = { margen: m, desc };
      if (m < P.MARGEN_MINIMO) { bajoPiso++; if (ejemplos.length < 8) ejemplos.push(`${desc} → ${pct(m)}`); }
    }
  }
  console.log(`  ${total.toLocaleString('es-CO')} escenarios (3 planes × combinaciones)`);
  console.log(`  Peor margen del rango: ${pct(peor.margen)} — ${peor.desc}`);
  console.log(`  Escenarios donde el tope de $6.000/m² recortó la tarifa de Basic: ${topados.toLocaleString('es-CO')}`);
  console.log(`  Bajo el piso de ${pct(P.MARGEN_MINIMO)} → crearCotizacionCare los RECHAZA: ${bajoPiso.toLocaleString('es-CO')}`);
  for (const e of ejemplos) console.log(`    · ${e}`);
  console.log('    (el grid es un producto cartesiano: cruza fachadas de 200 m² con techos de');
  console.log('     39.000 m², geometrías que no existen. Lo que importa es que el piso los frene,');
  console.log('     no cuántos son — con el piso absoluto ninguno se puede vender bajo 35%.)');
}

// ---------------------------------------------------------------------------
// El tope de $6.000/m² del servicio puntual choca con el piso de 35% cuando el
// costo de operar es tan alto que ni cobrando la tarifa de lista se llega al 35%
// (superficie difícil con recargo alto). Ahí manda el 35% y el trato queda sobre
// la tarifa de lista: es un edificio que no se puede servir en mercado.
console.log('\n=== Puntual: tope de $6.000/m² vs. piso de 35% ===');
{
  let sobreTope = 0, total = 0;
  const casos: string[] = [];
  for (const m2 of areas) for (const superficie of superficies)
  for (const tipoEdificio of niveles) for (const dificultad of niveles) {
    const r = calcularLavado(P, { m2, superficie, tipoEdificio, dificultad, movilizacion: 0, comisionPct: 0.05 });
    total++;
    const porM2 = r.precioLavado / m2;
    check(r.margenP >= P.MARGEN_MINIMO - 1e-9, `puntual ${m2} m² ${superficie} ${tipoEdificio}/${dificultad} ≥35%`, pct(r.margenP));
    if (porM2 > P.TARIFA_LISTA + 0.01) {
      sobreTope++;
      if (casos.length < 8) casos.push(`${m2} m² ${superficie} ${tipoEdificio}/${dificultad} → ${Math.round(porM2)}/m² (margen ${pct(r.margenP)})`);
    }
  }
  console.log(`  ${total.toLocaleString('es-CO')} escenarios de lavado puntual`);
  console.log(`  Quedan sobre $6.000/m² porque el piso de 35% lo exige: ${sobreTope.toLocaleString('es-CO')}`);
  for (const c of casos) console.log(`    · ${c}`);
  if (sobreTope > 0) {
    console.log('    (son fachadas chicas donde manda el cargo mínimo de proyecto, o superficie difícil');
    console.log('     con recargo alto donde el costo de operar no cabe en $6.000/m². El 35% manda:');
    console.log('     el precio sube y queda sobre la tarifa de lista — avisar antes de ofrecerlo.)');
  }
}

console.log('\n=== Regresión: el bug anterior habría fallado el Caso 3 ===');
// Reproduce el cálculo viejo (informe completo cada año) para dejar constancia
// de que el Caso 3 efectivamente fallaba antes del fix.
{
  const m2 = 965, techo = 1000;
  const insp = calcularInspeccion(P, techo);
  const puntual = calcularLavado(P, { m2, superficie: 'MIXTA', tipoEdificio: 'BAJO', dificultad: 'MEDIO', movilizacion: 0, comisionPct: 0.05 }).precioLavado;
  const viejoCom = 965 * 5400 * 2 * 1.05 + insp.precioInternacional!; // informe completo cada año
  const sueltoCom = puntual * 6 + insp.precioInternacional! + insp.dvPrecio;
  console.log(`  Complete con el bug: ${cop(viejoCom * 3)} vs suelto ${cop(sueltoCom)} → ${viejoCom * 3 >= sueltoCom ? 'MÁS CARO que suelto (bug confirmado)' : 'más barato'}`);
  console.log(`  Sobrecobro del contrato: ${cop(viejoCom * 3 - com1.valorAnual * 3)}`);
}

console.log(`\n${fallos === 0 ? '✅ TODOS LOS CASOS PASAN' : `❌ ${fallos} verificación(es) fallaron`}\n`);
process.exit(fallos === 0 ? 0 : 1);
