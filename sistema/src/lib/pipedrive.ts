import 'server-only';

const DOMINIO = process.env.PIPEDRIVE_DOMAIN || 'ktvworkingdrone';
const TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const BASE = `https://${DOMINIO}.pipedrive.com/api/v1`;
const NOMBRE_ETAPA_ENVIADA = 'Propuesta Enviada';

function habilitado() {
  return !!TOKEN;
}

export type PipedriveDealResumen = {
  id: number;
  title: string;
  value: number;
  currency: string;
  personName: string | null;
  orgName: string | null;
};

// Búsqueda en vivo para que el comercial vincule la cotización a un trato
// existente — nunca se crea/edita nada en Pipedrive hasta que la propuesta
// se marca como enviada.
export async function buscarTratos(termino: string): Promise<PipedriveDealResumen[]> {
  if (!habilitado() || termino.trim().length < 2) return [];
  const url = `${BASE}/deals/search?term=${encodeURIComponent(termino)}&api_token=${TOKEN}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  const items: any[] = json?.data?.items ?? [];
  return items.map((it) => ({
    id: it.item.id,
    title: it.item.title,
    value: it.item.value ?? 0,
    currency: it.item.currency ?? 'COP',
    personName: it.item.person?.name ?? null,
    orgName: it.item.organization?.name ?? null,
  }));
}

let etapaEnviadaIdCache: number | null = null;
async function obtenerEtapaPropuestaEnviada(): Promise<number | null> {
  if (etapaEnviadaIdCache !== null) return etapaEnviadaIdCache;
  const res = await fetch(`${BASE}/stages?api_token=${TOKEN}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json();
  const etapa = (json?.data ?? []).find((s: any) => s.name === NOMBRE_ETAPA_ENVIADA);
  if (!etapa) return null;
  etapaEnviadaIdCache = etapa.id;
  return etapa.id;
}

// Materiales comerciales que se pueden registrar en un trato — compartido
// entre la acción manual (/materiales, botón "Registrar envío") y el webhook
// de la automatización de Pipedrive (el comercial marca la actividad nativa
// "Enviar Brochure..." como hecha, sin salir de Pipedrive).
export const MATERIALES = {
  LANDING: { titulo: 'Brochure de prospección (landing)', url: 'https://landing.ktvworkingdrone.com.co' },
  PLANES: { titulo: 'Catálogo de planes KTV Care', url: 'https://landing.ktvworkingdrone.com.co/planes.html' },
} as const;

// Registra en el trato que el comercial envió un material comercial
// (brochure de prospección en frío o catálogo de planes de calentamiento).
// Deja una nota en el historial del trato — no mueve etapa ni toca el valor.
export async function registrarEnvioMaterial(dealId: number, args: { titulo: string; url: string }) {
  if (!habilitado()) return { ok: false as const, error: 'Pipedrive no está configurado.' };
  const nota = `${args.titulo} enviado al cliente por el Sistema Comercial KTV.\nEnlace: ${args.url}`;
  const res = await fetch(`${BASE}/notes?api_token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: nota, deal_id: dealId }),
  }).catch(() => null);
  if (!res || !res.ok) return { ok: false as const, error: 'No se pudo registrar en Pipedrive.' };
  return { ok: true as const };
}

// Al marcar una propuesta (Familia 1 o Care) como enviada: nota con el
// enlace + valor, actualizar el valor del trato, y moverlo a la etapa
// "Propuesta Enviada". No lanza si Pipedrive no está configurado o falla —
// nunca debe bloquear el envío real de la propuesta al cliente.
export async function registrarPropuestaEnviada(dealId: number, args: { urlPropuesta: string; valor: number; familia: 'PUNTUAL' | 'CARE' }) {
  if (!habilitado()) return;

  const nota = [
    `Propuesta ${args.familia === 'CARE' ? 'KTV Care' : 'de servicio puntual'} enviada por el Sistema Comercial KTV.`,
    `Valor cotizado: COP ${Math.round(args.valor).toLocaleString('es-CO')}`,
    `Enlace: ${args.urlPropuesta}`,
  ].join('\n');

  await fetch(`${BASE}/notes?api_token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: nota, deal_id: dealId }),
  }).catch((e) => console.error('Pipedrive: error creando nota', e));

  const stageId = await obtenerEtapaPropuestaEnviada().catch(() => null);
  await fetch(`${BASE}/deals/${dealId}?api_token=${TOKEN}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: Math.round(args.valor), ...(stageId ? { stage_id: stageId } : {}) }),
  }).catch((e) => console.error('Pipedrive: error actualizando el trato', e));
}
