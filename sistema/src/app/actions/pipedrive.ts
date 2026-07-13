'use server';

import { verifySession } from '@/lib/dal';
import { buscarTratos, registrarEnvioMaterial } from '@/lib/pipedrive';

export async function buscarDealsPipedrive(termino: string) {
  await verifySession();
  return buscarTratos(termino);
}

const MATERIALES = {
  LANDING: { titulo: 'Brochure de prospección (landing)', url: 'https://landing.ktvworkingdrone.com.co' },
  PLANES: { titulo: 'Catálogo de planes KTV Care', url: 'https://landing.ktvworkingdrone.com.co/planes.html' },
} as const;

export async function registrarEnvioMaterialPipedrive(dealId: number, material: keyof typeof MATERIALES) {
  await verifySession();
  const m = MATERIALES[material];
  if (!m) return { ok: false as const, error: 'Material no válido.' };
  return registrarEnvioMaterial(dealId, m);
}
