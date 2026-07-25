// Auditoría de propuestas Care emitidas con el bug de sobrecobro del informe
// (CORRECCION_DEFINITIVA_care_20260724.md). SOLO LECTURA — no escribe nada.
//
//   npx tsx scripts/auditar-care-sobrecobro.ts
//
// Recalcula cada cotización Care con el motor YA CORREGIDO, usando su propio
// snapshot CONGELADO de parámetros (así la única diferencia posible es la
// fórmula, nunca un cambio de tarifa posterior), y compara contra los valores
// guardados. Agrupa por la acción que necesita cada una.
//
// No corrige nada por diseño: fuera de BORRADOR una cotización no se edita en el
// mismo registro — se desactiva el link viejo y se crea una VERSIÓN NUEVA ligada
// a la anterior (ver Cotizacion.versionAnteriorId). Eso se hace desde el detalle
// de la cotización en el panel, para que quede la auditoría y el tracking.

import { prisma } from '../src/lib/prisma';
import { calcularCareTodos, PARAMETROS_INICIALES, type Parametros } from '../src/lib/pricing';

const cop = (n: number) => 'COP ' + Math.round(n).toLocaleString('es-CO');
const pct = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';

async function main() {
  const cotizaciones = await prisma.cotizacion.findMany({
    where: { familia: 'CARE', care: { isNot: null } },
    include: { care: true, cliente: true },
    orderBy: { creadoAt: 'asc' },
  });

  console.log(`\nCotizaciones Care en base: ${cotizaciones.length}\n`);

  const afectadas: {
    id: string; trazabilidad: string; cliente: string; estado: string;
    aceptada: boolean; linkActivo: boolean; yaCorregida: boolean;
    filas: { plan: string; viejo: number; nuevo: number }[];
    planRecomendado: string; deltaRecomendado: number;
  }[] = [];

  for (const c of cotizaciones) {
    const care = c.care!;
    let snapshot: Parametros;
    try {
      snapshot = { ...PARAMETROS_INICIALES, ...(JSON.parse(c.snapshotParametros) as Partial<Parametros>) };
    } catch {
      console.log(`⚠️  ${c.idTrazabilidad}: snapshot de parámetros ilegible — revisar a mano.`);
      continue;
    }

    const rec = calcularCareTodos(snapshot, {
      m2: care.m2Fachada ?? 0,
      techo: care.rangoTecho ?? 0,
      superficie: care.superficie ?? undefined,
      tipoEdificio: care.tipoEdificio ?? undefined,
      dificultad: care.dificultad ?? undefined,
    });

    const filas = [
      { plan: 'BASIC', viejo: care.valorAnualBasic, nuevo: rec.BASIC.valorAnual },
      { plan: 'ESSENTIAL', viejo: care.valorAnualEssential, nuevo: rec.ESSENTIAL.valorAnual },
      { plan: 'COMPLETE', viejo: care.valorAnualComplete, nuevo: rec.COMPLETE.valorAnual },
    ];
    // Tolerancia de $1 — diferencias de coma flotante no son sobrecobro.
    if (!filas.some((f) => Math.abs(f.viejo - f.nuevo) > 1)) continue;

    const recomendado = filas.find((f) => f.plan === care.planRecomendado)!;
    afectadas.push({
      id: c.id, trazabilidad: c.idTrazabilidad, cliente: c.cliente.nombre, estado: c.estado,
      aceptada: c.aceptadaPorCliente, linkActivo: c.linkActivo, yaCorregida: c.versionAnteriorId !== null,
      filas, planRecomendado: care.planRecomendado,
      deltaRecomendado: recomendado.viejo > 0 ? recomendado.nuevo / recomendado.viejo - 1 : 0,
    });
  }

  if (afectadas.length === 0) {
    console.log('✅ Ninguna cotización Care guardada difiere del motor corregido.\n');
    return;
  }

  console.log(`🚩 ${afectadas.length} cotización(es) con valores distintos a los del motor corregido:\n`);
  for (const a of afectadas) {
    console.log(`── ${a.trazabilidad} · ${a.cliente}`);
    console.log(`   estado ${a.estado}${a.aceptada ? ' · ACEPTADA POR EL CLIENTE' : ''}` +
      `${a.linkActivo ? '' : ' · link ya desactivado'}${a.yaCorregida ? ' · ya es una versión de corrección' : ''}`);
    for (const f of a.filas) {
      const marca = f.plan === a.planRecomendado ? ' ★ recomendado' : '';
      const d = f.viejo > 0 ? f.nuevo / f.viejo - 1 : 0;
      console.log(`   ${f.plan.padEnd(10)} ${cop(f.viejo)} → ${cop(f.nuevo)} /año  (${pct(d)})${marca}`);
      console.log(`   ${''.padEnd(10)} sobre el contrato: ${cop(f.viejo * (f.plan === 'BASIC' ? 1 : 3))} → ${cop(f.nuevo * (f.plan === 'BASIC' ? 1 : 3))}`);
    }
    console.log('');
  }

  // Qué hacer con cada una.
  const aceptadas = afectadas.filter((a) => a.aceptada);
  const borradores = afectadas.filter((a) => !a.aceptada && a.estado === 'BORRADOR');
  const enCurso = afectadas.filter((a) => !a.aceptada && a.estado !== 'BORRADOR');

  console.log('═══ ACCIÓN REQUERIDA ═══\n');
  if (borradores.length) {
    console.log(`• ${borradores.length} en BORRADOR — reabrir en el cotizador y volver a guardar:`);
    console.log('  el recálculo toma el precio corregido y no hay link enviado que invalidar.');
    for (const a of borradores) console.log(`    · ${a.trazabilidad} — ${a.cliente}`);
    console.log('');
  }
  if (enCurso.length) {
    console.log(`• ${enCurso.length} YA ENVIADA(S) y sin aceptar — PRIORIDAD: corregir antes de que el cliente decida.`);
    console.log('  Usar el flujo de corrección del detalle de la cotización (desactiva el link viejo y');
    console.log('  crea una versión nueva ligada a la anterior). No editar el registro a mano: se pierde');
    console.log('  la auditoría y el tracking de apertura.');
    for (const a of enCurso) console.log(`    · ${a.trazabilidad} — ${a.cliente} (${a.estado}, ${pct(a.deltaRecomendado)} en el plan recomendado)`);
    console.log('');
  }
  if (aceptadas.length) {
    console.log(`• ${aceptadas.length} YA ACEPTADA(S) POR EL CLIENTE — no se toca desde el sistema.`);
    console.log('  El cliente aceptó un precio inflado: es una decisión comercial de Gerencia (honrar el');
    console.log('  precio corregido, emitir nota crédito, o renegociar). Escalar, no corregir en silencio.');
    for (const a of aceptadas) console.log(`    · ${a.trazabilidad} — ${a.cliente} (${pct(a.deltaRecomendado)} en el plan recomendado)`);
    console.log('');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
