import 'server-only';
import { prisma } from '@/lib/prisma';
import { PARAMETROS_INICIALES, type Parametros } from '@/lib/pricing';

// Lee los parámetros vigentes de la base de datos (editables por Gerencia).
// Devuelve también el snapshot crudo (para congelar en cada cotización).
export async function getParametrosVigentes(): Promise<{ parametros: Parametros; snapshotJson: string }> {
  const filas = await prisma.parametro.findMany();
  const mapa = Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
  const parametros = { ...PARAMETROS_INICIALES } as Record<string, number>;
  for (const clave of Object.keys(parametros)) {
    if (mapa[clave] !== undefined) parametros[clave] = Number(mapa[clave]);
  }
  return { parametros: parametros as unknown as Parametros, snapshotJson: JSON.stringify(parametros) };
}
