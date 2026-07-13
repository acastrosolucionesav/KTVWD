'use server';

import { verifySession } from '@/lib/dal';
import { buscarTratos } from '@/lib/pipedrive';

export async function buscarDealsPipedrive(termino: string) {
  await verifySession();
  return buscarTratos(termino);
}
