// Candado de naming: "Informe Internacional KTV" nunca debe llamarse
// "certificado" — es una metodología alineada con estándares internacionales
// (Inotek, Noruega), no una certificación formal. Corrección 2026-07-14.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..', '..');
const TARGET_DIRS = [join(ROOT, 'sistema', 'src'), join(ROOT, 'landing')];
const EXTS = ['.ts', '.tsx', '.html'];
const WINDOW = 200; // caracteres de contexto para considerar "cerca"

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'generated') continue;
      yield* walk(full);
    } else if (EXTS.some((e) => entry.endsWith(e))) {
      yield full;
    }
  }
}

let fallas = [];
for (const dir of TARGET_DIRS) {
  for (const file of walk(dir)) {
    const texto = readFileSync(file, 'utf8');
    const idxInforme = [...texto.matchAll(/informe internacional/gi)].map((m) => m.index);
    for (const i of idxInforme) {
      const alrededor = texto.slice(Math.max(0, i - WINDOW), i + WINDOW).toLowerCase();
      if (alrededor.includes('certificado')) {
        fallas.push(file);
        break;
      }
    }
  }
}

if (fallas.length) {
  console.error('✗ Naming check falló: "certificado" aparece cerca de "Informe Internacional" en:');
  for (const f of fallas) console.error('  - ' + f);
  console.error('El Informe Internacional KTV es una metodología alineada con estándares internacionales (Inotek, Noruega), no una certificación formal. No usar la palabra "certificado" en su descripción.');
  process.exit(1);
} else {
  console.log('✓ Naming check OK — "Informe Internacional" no aparece junto a "certificado".');
}
