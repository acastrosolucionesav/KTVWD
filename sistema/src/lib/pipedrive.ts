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

// Trae UN trato por su id — para el flujo "abrir el cotizador desde Pipedrive":
// el comercial hace clic en el link del campo Cotizador del trato (que trae
// ?deal_id=N) y el cotizador carga solo, sin que tenga que buscar el trato.
export async function obtenerTrato(dealId: number): Promise<PipedriveDealResumen | null> {
  if (!habilitado() || !dealId) return null;
  const res = await fetch(`${BASE}/deals/${dealId}?api_token=${TOKEN}`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  const json = await res.json();
  const d = json?.data;
  if (!d) return null;
  return {
    id: d.id,
    title: d.title,
    value: d.value ?? 0,
    currency: d.currency ?? 'COP',
    personName: d.person_id?.name ?? null,
    orgName: d.org_id?.name ?? null,
  };
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

// Campo personalizado "Cotizador" del trato (lo crea Gerencia una sola vez en
// Pipedrive: Configuración → Campos de datos → Trato). Se busca por nombre y
// se cachea la key solo cuando se encuentra — si aún no existe, se reintenta
// en el siguiente uso sin romper nada.
let campoCotizadorKeyCache: string | null = null;
async function obtenerCampoCotizador(): Promise<string | null> {
  if (campoCotizadorKeyCache) return campoCotizadorKeyCache;
  const res = await fetch(`${BASE}/dealFields?api_token=${TOKEN}`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  const json = await res.json();
  const campo = (json?.data ?? []).find((f: any) => String(f.name ?? '').trim().toLowerCase() === 'cotizador');
  if (campo?.key) campoCotizadorKeyCache = campo.key;
  return campoCotizadorKeyCache;
}

// Al CREAR una cotización vinculada a un trato: nota en el historial + el
// enlace público de la propuesta en el campo "Cotizador" del panel de
// Detalles — el comercial ve el link ahí mismo, sin salir de Pipedrive.
// Nunca lanza ni bloquea la creación si Pipedrive falla o no está configurado.
export async function registrarCotizacionCreada(dealId: number, args: {
  idTrazabilidad: string;
  clienteNombre: string;
  urlPropuesta: string;
  familia: 'PUNTUAL' | 'CARE';
  requiereAprobacion: boolean;
}) {
  if (!habilitado()) return;

  const nota = [
    `COTIZACIÓN ${args.idTrazabilidad} — ${args.familia === 'CARE' ? 'programa KTV Care' : 'servicio puntual'} — Cliente: ${args.clienteNombre}`,
    args.requiereAprobacion
      ? 'Pendiente de aprobación de Gerencia antes de poder enviarse al cliente.'
      : 'Generada en el Sistema Comercial KTV (estado Borrador).',
    `Enlace de la propuesta: ${args.urlPropuesta}`,
  ].join('\n');

  await fetch(`${BASE}/notes?api_token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: nota, deal_id: dealId }),
  }).catch((e) => console.error('Pipedrive: error creando nota de cotización', e));

  const campoKey = await obtenerCampoCotizador().catch(() => null);
  if (campoKey) {
    await fetch(`${BASE}/deals/${dealId}?api_token=${TOKEN}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campoKey]: args.urlPropuesta }),
    }).catch((e) => console.error('Pipedrive: error llenando el campo Cotizador', e));
  }
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
