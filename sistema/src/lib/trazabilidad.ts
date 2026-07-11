export function generarIdTrazabilidad(fecha = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `KTV-${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}-${rand}`;
}
