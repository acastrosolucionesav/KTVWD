'use server';

import { verifySession } from '@/lib/dal';
import { buscarTratos, registrarEnvioMaterial, MATERIALES } from '@/lib/pipedrive';

export async function buscarDealsPipedrive(termino: string) {
  await verifySession();
  return buscarTratos(termino);
}

export async function registrarEnvioMaterialPipedrive(dealId: number, material: keyof typeof MATERIALES) {
  await verifySession();
  const m = MATERIALES[material];
  if (!m) return { ok: false as const, error: 'Material no válido.' };
  return registrarEnvioMaterial(dealId, m);
}
