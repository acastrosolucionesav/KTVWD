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
const espEss = 965 * 5550 * 1.05 + (2 * 3_500_000) / 3;
const espCom = 965 * 5400 * 2 * 1.05 + (9_000_000 + 3_500_000) / 3;
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
check(Math.abs(com1.informeAnual - 4_166_666.67) < 1, 'informe_anual_complete = (II + DV)/3 = 4.166.667');

console.log(`\n  Basic      ${cop(bas1.valorAnual)} /año  (sin cambio: informe anual ${cop(bas1.informeAnual)} = DV)`);
check(Math.abs(bas1.informeAnual - insp1.dvPrecio) < 1, 'Basic sigue cobrando 1 DV por su único año');
check(bas1.volDisc === 0, 'Basic sin descuento por volumen');

// Regla de margen de Gerencia: 35% es el objetivo estándar; 25–35% procede solo
// con aprobación de Gerencia (advertencia, no bloqueo); <25% no procede.
console.log('\n  Márgenes por año (35% objetivo · 25% piso duro):');
for (const [n, r] of [['Essential', ess1], ['Complete', com1]] as const) {
  const pa = r.porAnio!;
  console.log(`    ${n}: año1 ${pct(pa[1].margenP)} · año2 ${pct(pa[2].margenP)} · año3 ${pct(pa[3].margenP)}`);
  check(r.margenP >= 0.25, `${n} nunca baja del piso duro de 25%`, `peor año ${pct(r.margenP)}`);
  if (r.margenP < P.MARGEN_MINIMO) {
    console.log(`    ⚠️  ${n} cae a ${pct(r.margenP)} en su peor año (banda 25–35%) — requiere aprobación de Gerencia.`);
    console.log(`        Causa: el ingreso del informe se prorratea en ${r.contratoAnios} años, pero el año que`);
    console.log(`        lo entrega paga su costo COMPLETO. Margen de todo el contrato:`);
    const ingreso3 = r.valorAnual * r.contratoAnios;
    const costo3 = pa[1].costoTotal + pa[2].costoTotal + pa[3].costoTotal;
    console.log(`        ${pct((ingreso3 - costo3) / ingreso3)} (${cop(ingreso3 - costo3)} sobre ${cop(ingreso3)}).`);
  }
}
console.log(`    Basic: ${pct(bas1.margenP)}`);
check(bas1.margenP >= 0.25, 'Basic ≥25%');

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

  const sueltoEss = puntual * 3 + dv * 2;
  const sueltoCom = puntual * 6 + ii + dv;
  const ahorroEss = 1 - (ess.valorAnual * 3) / sueltoEss;
  const ahorroCom = 1 - (com.valorAnual * 3) / sueltoCom;

  if (ahorroEss < peorEss) { peorEss = ahorroEss; }
  if (ahorroCom < peorCom) { peorCom = ahorroCom; peorCaso = `${m2} m², techo ${techo}, ${superficie}, edif ${tipoEdificio}, dif ${dificultad}`; }
  if (ess.valorAnual * 3 >= sueltoEss || com.valorAnual * 3 >= sueltoCom) {
    console.log(`  ✗ FALLA en ${m2} m², techo ${techo}, ${superficie}, ${tipoEdificio}/${dificultad}`);
    console.log(`      Essential ${cop(ess.valorAnual * 3)} vs suelto ${cop(sueltoEss)}`);
    console.log(`      Complete  ${cop(com.valorAnual * 3)} vs suelto ${cop(sueltoCom)}`);
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
// Barrido de margen: el prorrateo suaviza el INGRESO del informe pero no su
// COSTO, así que el año que entrega el informe caro (el año 1 de Complete)
// queda con el margen más bajo. El caso peligroso es fachada chica + techo
// grande: poco ingreso de lavado contra un Informe Internacional caro.
console.log('\n=== Barrido de margen por año — busca el peor caso en todo el rango ===');
{
  let peor = { margen: Infinity, desc: '', plan: '' };
  let bajo25 = 0, banda25a35 = 0, total = 0;
  const bajo25Ejemplos: string[] = [];
  for (const m2 of areas) for (const techo of techos) for (const superficie of superficies)
  for (const tipoEdificio of niveles) for (const dificultad of niveles) {
    for (const plan of ['BASIC', 'ESSENTIAL', 'COMPLETE'] as const) {
      const r = calcularCare(P, { plan, m2, techo, superficie, tipoEdificio, dificultad });
      const desc = `${plan} · ${m2} m², techo ${techo}, ${superficie}, edif ${tipoEdificio}, dif ${dificultad}`;
      total++;
      if (r.margenP < peor.margen) peor = { margen: r.margenP, desc, plan };
      if (r.margenP < 0.25) { bajo25++; if (bajo25Ejemplos.length < 6) bajo25Ejemplos.push(`${desc} → ${pct(r.margenP)}`); }
      else if (r.margenP < P.MARGEN_MINIMO) banda25a35++;
    }
  }
  console.log(`  ${total.toLocaleString('es-CO')} escenarios (3 planes × combinaciones)`);
  console.log(`  Peor margen-año del rango: ${pct(peor.margen)} — ${peor.desc}`);
  console.log(`  En banda 25–35% (procede con aprobación de Gerencia): ${banda25a35.toLocaleString('es-CO')}`);
  console.log(`  Bajo 25% (NO procede — crearCotizacionCare lo bloquea en duro): ${bajo25.toLocaleString('es-CO')}`);
  for (const e of bajo25Ejemplos) console.log(`    · ${e}`);
  if (bajo25 > 0) {
    console.log('\n  ⚠️  PARA GERENCIA — consecuencia del prorrateo, no un error de cálculo:');
    console.log('      El prorrateo reparte el INGRESO del informe entre los 3 años, pero el año que');
    console.log('      lo entrega paga su COSTO completo. En Complete el año 1 paga el Informe');
    console.log('      Internacional entero contra 1/3 de su ingreso, así que el margen del año 1 se');
    console.log('      hunde cuando el II es caro frente al ingreso de lavado — fachada chica con techo');
    console.log('      grande (bodega, centro comercial de una planta). Antes del fix estos casos daban');
    console.log('      margen sano solo porque se sobrecobraba el informe 3 veces.');
    console.log('      Efecto práctico: crearCotizacionCare ya rechaza estas cotizaciones (piso 25%),');
    console.log('      así que NO se puede emitir una propuesta con margen negativo. Pero Complete');
    console.log('      queda inviable para esas geometrías hasta que Gerencia decida el remedio.');
    console.log('      Opciones (decisión de Gerencia, no se ajustó nada por cuenta propia):');
    console.log('        a) Facturar el Informe Internacional APARTE del prorrateo (regla 8 original:');
    console.log('           "el II dentro de Complete se factura aparte, no prorrateado en la cuota").');
    console.log('           Alinea ingreso y costo en el año 1 y elimina el problema de raíz.');
    console.log('        b) Exigir un área mínima de fachada para ofrecer Complete.');
    console.log('        c) Prorratear también el COSTO del informe en la vista de margen por año');
    console.log('           (cambia solo el reporte interno, no lo que paga el cliente).');
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
