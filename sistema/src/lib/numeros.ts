// Lectura tolerante de los números que se escriben en el cotizador.
//
// Por qué existe: en Colombia se escribe "12.000.000" y "1.600". Un
// <input type="number"> del navegador trata el punto como separador DECIMAL,
// así que "1.600" le llega al servidor como 1,6 y "12.000.000" —dos puntos, no
// es un número válido— le llega VACÍO, o sea cero. Sin ruido, sin error: el
// costo simplemente desaparece de la cotización. Eso fue lo que pasó con los
// 12 millones de la cotización de Hotel Wise (Gerencia, 2026-11-11).
//
// La regla, pensada para cómo escribe la gente acá:
//   "12.000.000" → 12000000   (puntos de miles)
//   "1.600"      → 1600       (punto de miles)
//   "1,5"        → 1.5        (coma decimal, que es la correcta en es-CO)
//   "1.5"        → 1.5        (un punto con 1-2 cifras detrás: decimal a la inglesa)
//   "$ 12.000"   → 12000      (se ignora todo lo que no sea cifra)
//
// Solo se usa en campos donde un decimal con punto sería absurdo —plata y
// metros cuadrados—. Los días, las horas y los porcentajes siguen leyéndose
// con Number() a secas: ahí "0.5" sí quiere decir medio, y no medio millar.
export function numeroEsCO(v: FormDataEntryValue | string | null | undefined): number {
  const s = String(v ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.includes(',')) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const puntos = s.split('.').length - 1;
  if (puntos === 0) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  // Un solo punto con una o dos cifras detrás: nadie escribe miles así
  // ("1.60" no es mil seiscientos), es un decimal.
  if (puntos === 1 && /\.\d{1,2}$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(s.replace(/\./g, ''));
  return Number.isFinite(n) ? n : 0;
}
