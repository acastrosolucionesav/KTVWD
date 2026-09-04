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

// Correo del usuario de Pipedrive que abrió el modal (App Extension) — se usa
// para encontrar al Usuario correspondiente en KTV (ver resolverUsuarioPipedrive
// en actions/cotizaciones.ts), porque el JWT del modal solo trae el user_id de
// PIPEDRIVE, que no es el id de nuestro propio Usuario.
export async function obtenerCorreoUsuarioPipedrive(userId: number): Promise<string | null> {
  if (!habilitado() || !userId) return null;
  const res = await fetch(`${BASE}/users/${userId}?api_token=${TOKEN}`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  const json = await res.json();
  const email = json?.data?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

type Etapa = { id: number; nombre: string; orden: number; pipelineId: number };
let etapasCache: Etapa[] | null = null;
async function etapas(): Promise<Etapa[] | null> {
  if (etapasCache) return etapasCache;
  const res = await fetch(`${BASE}/stages?api_token=${TOKEN}`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  const json = await res.json();
  const lista: Etapa[] = (json?.data ?? [])
    .filter((s: any) => s?.id)
    .map((s: any) => ({ id: s.id, nombre: String(s.name ?? ''), orden: Number(s.order_nr ?? 0), pipelineId: Number(s.pipeline_id ?? 0) }));
  if (lista.length === 0) return null;
  etapasCache = lista;
  return lista;
}

// A qué etapa debe pasar el trato cuando la propuesta ya salió — null si NO
// hay que moverlo. Se decide con el estado real del trato porque mover de etapa
// es destructivo en el sentido comercial: un trato que ya está en "Trámite
// Aerocivil" o ganado NO puede volver a "Propuesta Enviada" (borraría el avance
// del embudo y los reportes de conversión). Solo se mueve hacia adelante,
// dentro del mismo pipeline del trato, y nunca un trato cerrado.
async function etapaDestinoEnviada(dealId: number): Promise<number | null> {
  const lista = await etapas();
  if (!lista) return null;
  const res = await fetch(`${BASE}/deals/${dealId}?api_token=${TOKEN}`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  const d = (await res.json())?.data;
  if (!d || d.status !== 'open') return null;

  const pipelineId = Number(d.pipeline_id ?? 0);
  const destino = lista.find((s) => s.nombre === NOMBRE_ETAPA_ENVIADA && s.pipelineId === pipelineId)
    ?? lista.find((s) => s.nombre === NOMBRE_ETAPA_ENVIADA);
  if (!destino || destino.pipelineId !== pipelineId) return null;
  if (Number(d.stage_id) === destino.id) return null;

  const actual = lista.find((s) => s.id === Number(d.stage_id));
  if (actual && actual.orden >= destino.orden) return null;
  return destino.id;
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

// Campos personalizados del trato (los crea Gerencia en Pipedrive:
// Configuración → Campos de datos → Trato). SIEMPRE se buscan por NOMBRE y se
// resuelve la key real (`abc123…`) contra la API — la key es un hash distinto
// en cada cuenta de Pipedrive, así que hardcodearla rompería el sistema en
// cuanto se use otra cuenta (o si Gerencia borra y vuelve a crear el campo).
// Se cachea el mapa solo cuando la consulta funcionó; si falla se reintenta en
// el siguiente uso sin romper nada.
type CampoTrato = { key: string; tipo: string };
let mapaCamposCache: Map<string, CampoTrato> | null = null;

// "Días Ejecución", "DIAS EJECUCION" y "días ejecución" son el mismo campo para
// quien lo configuró en Pipedrive — se comparan sin tildes, sin mayúsculas y
// sin el "%" que Gerencia usa en los nombres ("Anticipo %").
function normalizarNombre(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/%/g, ' ').replace(/\s+/g, ' ').trim();
}

async function mapaCamposTrato(): Promise<Map<string, CampoTrato> | null> {
  if (mapaCamposCache) return mapaCamposCache;
  const res = await fetch(`${BASE}/dealFields?api_token=${TOKEN}&limit=500`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return null;
  const json = await res.json();
  const mapa = new Map<string, CampoTrato>();
  for (const f of json?.data ?? []) {
    if (f?.key && f?.name) mapa.set(normalizarNombre(String(f.name)), { key: String(f.key), tipo: String(f.field_type ?? '') });
  }
  if (mapa.size === 0) return null;
  mapaCamposCache = mapa;
  return mapa;
}

async function obtenerCampoCotizador(): Promise<string | null> {
  const mapa = await mapaCamposTrato();
  return mapa?.get('cotizador')?.key ?? null;
}

// Campos comerciales que Gerencia marcó como OBLIGATORIOS para que un trato
// pueda entrar a la etapa "Propuesta Enviada" (Pipedrive los exige tanto al
// arrastrar la tarjeta a mano como al mover la etapa por API). Todos salen de
// datos que el comercial YA llenó en el cotizador, así que se escriben solos
// al guardar la cotización — si no, el comercial tendría que volver a teclear
// lo mismo dentro de Pipedrive para poder mover el trato.
export type CamposComercialesTrato = {
  anticipoPct?: number | null;
  saldoPct?: number | null;
  aerocivil?: string | null;
  diasEjecucion?: number | null;
  vigenteHasta?: Date | null;
};

// Nombre(s) posibles del campo en Pipedrive, en orden de preferencia.
const NOMBRES_CAMPO: Record<keyof CamposComercialesTrato, string[]> = {
  anticipoPct: ['anticipo'],
  saldoPct: ['saldo'],
  aerocivil: ['dias aerocivil', 'aerocivil', 'permiso aerocivil'],
  diasEjecucion: ['dias ejecucion', 'dias de ejecucion'],
  vigenteHasta: ['vigencia', 'vigente hasta'],
};

// Adapta el valor al tipo real del campo en Pipedrive. Es necesario porque no
// controlamos cómo lo creó Gerencia: "Días Aerocivil" puede ser texto ("30 a 40
// días hábiles…") o numérico, y en el segundo caso hay que mandar el número o
// Pipedrive rechaza el trato entero. Los campos de opciones (enum/set) y de
// relación se omiten a propósito: escribirlos exige el id de la opción, y
// mandar texto ahí ensuciaría el dato en vez de ayudar.
function formatearValor(tipo: string, valor: unknown): string | number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (tipo === 'date') {
    const d = valor instanceof Date ? valor : new Date(String(valor));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (tipo === 'double' || tipo === 'monetary' || tipo === 'int') {
    const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.').match(/-?\d+(\.\d+)?/)?.[0] ?? NaN);
    return Number.isFinite(n) ? n : null;
  }
  if (tipo === 'enum' || tipo === 'set' || tipo === 'user' || tipo === 'org' || tipo === 'people' || tipo === 'deal') return null;
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor);
}

async function cuerpoCamposComerciales(campos: CamposComercialesTrato): Promise<Record<string, string | number>> {
  const mapa = await mapaCamposTrato().catch(() => null);
  if (!mapa) return {};
  const cuerpo: Record<string, string | number> = {};
  for (const [prop, nombres] of Object.entries(NOMBRES_CAMPO) as [keyof CamposComercialesTrato, string[]][]) {
    const campo = nombres.map((n) => mapa.get(n)).find(Boolean);
    if (!campo) continue;
    const valor = formatearValor(campo.tipo, campos[prop]);
    if (valor !== null) cuerpo[campo.key] = valor;
  }
  return cuerpo;
}

// Un solo PUT con todo lo que el trato debe reflejar de la cotización: valor,
// link de la propuesta, campos comerciales obligatorios y (opcionalmente) la
// etapa. Nunca lanza — Pipedrive es un espejo del sistema, no su fuente de
// verdad: si falla, la cotización ya quedó guardada igual.
async function actualizarTrato(dealId: number, args: {
  valor?: number | null;
  urlPropuesta?: string | null;
  campos?: CamposComercialesTrato;
  moverAEnviada?: boolean;
}) {
  if (!habilitado()) return;
  const cuerpo: Record<string, unknown> = {};

  if (args.valor !== null && args.valor !== undefined && Number.isFinite(args.valor)) {
    cuerpo.value = Math.round(args.valor);
    cuerpo.currency = 'COP';
  }
  if (args.urlPropuesta) {
    const campoKey = await obtenerCampoCotizador().catch(() => null);
    if (campoKey) cuerpo[campoKey] = args.urlPropuesta;
  }
  if (args.campos) Object.assign(cuerpo, await cuerpoCamposComerciales(args.campos));
  if (args.moverAEnviada) {
    // El cambio de etapa va en el MISMO PUT que los campos comerciales: si la
    // etapa los exige, tienen que llegar juntos o Pipedrive rechaza todo.
    const stageId = await etapaDestinoEnviada(dealId).catch(() => null);
    if (stageId) cuerpo.stage_id = stageId;
  }
  if (Object.keys(cuerpo).length === 0) return;

  const res = await fetch(`${BASE}/deals/${dealId}?api_token=${TOKEN}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  if (!res || !res.ok) {
    console.error('Pipedrive: no se pudo actualizar el trato', dealId, res ? await res.text().catch(() => '') : 'sin respuesta');
  }
}

// Al EDITAR una cotización ya vinculada a un trato: se refresca el espejo del
// trato (valor, link, campos), sin nota — el comercial ajusta varias veces
// durante una negociación y una nota por ajuste enterraría el historial.
export async function actualizarTratoCotizacion(dealId: number, args: {
  valor: number;
  urlPropuesta: string;
  campos?: CamposComercialesTrato;
}) {
  await actualizarTrato(dealId, { valor: args.valor, urlPropuesta: args.urlPropuesta, campos: args.campos });
}

// Al CREAR una cotización vinculada a un trato: nota en el historial + el
// espejo del trato (valor cotizado, enlace público en el campo "Cotizador" y
// los campos comerciales obligatorios de la etapa). El valor se escribe desde
// la creación y no solo al marcarla como enviada: el comercial manda la
// propuesta con la plantilla de correo del propio Pipedrive, así que si el
// valor esperara a "Marcar como enviada" en el sistema, el trato se quedaría
// en COP 0 justo cuando ya se cotizó (encontrado en producción, Petrometal).
// Nunca lanza ni bloquea la creación si Pipedrive falla o no está configurado.
export async function registrarCotizacionCreada(dealId: number, args: {
  idTrazabilidad: string;
  clienteNombre: string;
  urlPropuesta: string;
  familia: 'PUNTUAL' | 'CARE';
  requiereAprobacion: boolean;
  valor?: number;
  campos?: CamposComercialesTrato;
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

  await actualizarTrato(dealId, { valor: args.valor, urlPropuesta: args.urlPropuesta, campos: args.campos });
}

// Al marcar una propuesta (Familia 1 o Care) como enviada: nota con el
// enlace + valor, actualizar el valor del trato, y moverlo a la etapa
// "Propuesta Enviada". No lanza si Pipedrive no está configurado o falla —
// nunca debe bloquear el envío real de la propuesta al cliente.
export async function registrarPropuestaEnviada(dealId: number, args: {
  urlPropuesta: string; valor: number; familia: 'PUNTUAL' | 'CARE'; campos?: CamposComercialesTrato;
}) {
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

  // Los campos comerciales van en el MISMO PUT que el cambio de etapa: si la
  // etapa "Propuesta Enviada" los exige y llegaran vacíos, Pipedrive rechaza
  // el movimiento entero y el trato se queda atrás sin que nadie se entere.
  await actualizarTrato(dealId, {
    valor: args.valor, urlPropuesta: args.urlPropuesta, campos: args.campos, moverAEnviada: true,
  });
}

// El cliente abrió el link público de la propuesta. Es la única prueba dura de
// que la propuesta de verdad salió (el correo se escribe con la plantilla de
// Pipedrive, fuera del sistema), así que la primera apertura deja la nota en el
// trato y lo empuja a "Propuesta Enviada" si venía de una etapa anterior.
//
// Las aperturas siguientes NO dejan nota: un cliente que revisa la propuesta
// cinco veces llenaría el historial del trato y taparía lo que sí importa. El
// conteo completo vive en el sistema (tabla Apertura, visible en el detalle).
export async function registrarAperturaPropuesta(dealId: number, args: {
  idTrazabilidad: string;
  clienteNombre: string;
  esPrimera: boolean;
  // Se reenvían junto con el cambio de etapa por dos razones: la etapa puede
  // exigirlos (y sin ellos rechaza el movimiento completo), y las cotizaciones
  // guardadas antes de que el sistema escribiera el valor en el trato quedan
  // así al día en la primera apertura del cliente, sin tocar nada a mano.
  valor?: number;
  campos?: CamposComercialesTrato;
}) {
  if (!habilitado()) return;

  if (args.esPrimera) {
    const nota = [
      `👀 El cliente ABRIÓ la propuesta ${args.idTrazabilidad} (${args.clienteNombre}).`,
      'Registrado automáticamente por el Sistema Comercial KTV al visitarse el link público.',
    ].join('\n');
    await fetch(`${BASE}/notes?api_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: nota, deal_id: dealId }),
    }).catch((e) => console.error('Pipedrive: error creando nota de apertura', e));

    await actualizarTrato(dealId, { valor: args.valor, campos: args.campos, moverAEnviada: true });
  }
}

// Landing de Alianzas (spec_pagina_alianzas_20260721.md): un candidato llena el
// formulario público y se crea un LEAD en Pipedrive (no un trato del pipeline
// de ventas — un candidato de alianza no es un cliente de servicio). Se crea
// primero la persona y luego el lead ligado a ella, con el título marcado como
// ALIANZA para que se distinga sin depender de etiquetas pre-creadas. Best
// effort: si algo falla devuelve null (la solicitud ya quedó guardada en la BD).
export async function crearLeadAlianza(args: {
  nombre: string; empresa?: string | null; email: string;
  telefono?: string | null; ciudad?: string | null; mensaje?: string | null;
}): Promise<string | null> {
  if (!habilitado()) return null;
  try {
    const personaRes = await fetch(`${BASE}/persons?api_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: args.nombre,
        email: args.email ? [{ value: args.email, primary: true }] : undefined,
        phone: args.telefono ? [{ value: args.telefono, primary: true }] : undefined,
      }),
    });
    if (!personaRes.ok) return null;
    const personaId = (await personaRes.json())?.data?.id;
    if (!personaId) return null;

    const titulo = `ALIANZA — ${args.empresa || args.nombre}${args.ciudad ? ` (${args.ciudad})` : ''}`;
    const leadRes = await fetch(`${BASE}/leads?api_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titulo, person_id: personaId }),
    });
    if (!leadRes.ok) return null;
    const leadId = (await leadRes.json())?.data?.id ?? null;

    if (leadId) {
      const nota = [
        `Solicitud de alianza desde la landing pública.`,
        `Nombre: ${args.nombre}`,
        args.empresa ? `Empresa: ${args.empresa}` : null,
        `Email: ${args.email}`,
        args.telefono ? `Teléfono: ${args.telefono}` : null,
        args.ciudad ? `Ciudad/Región: ${args.ciudad}` : null,
        args.mensaje ? `Mensaje: ${args.mensaje}` : null,
      ].filter(Boolean).join('\n');
      await fetch(`${BASE}/notes?api_token=${TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: nota, lead_id: leadId }),
      }).catch((e) => console.error('Pipedrive: error creando nota de alianza', e));
    }
    return leadId ? String(leadId) : null;
  } catch (e) {
    console.error('Pipedrive: error creando lead de alianza', e);
    return null;
  }
}

// Mismo patrón que crearLeadAlianza — formulario de contacto general del
// sitio público principal (ktvworkingdrone.com.co), marcado como WEB en vez
// de ALIANZA para que Gerencia distinga el canal de origen en Pipedrive.
export async function crearLeadContacto(args: {
  nombre: string; compania?: string | null; email: string;
  telefono?: string | null; mensaje?: string | null;
}): Promise<string | null> {
  if (!habilitado()) return null;
  try {
    const personaRes = await fetch(`${BASE}/persons?api_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: args.nombre,
        email: args.email ? [{ value: args.email, primary: true }] : undefined,
        phone: args.telefono ? [{ value: args.telefono, primary: true }] : undefined,
      }),
    });
    if (!personaRes.ok) return null;
    const personaId = (await personaRes.json())?.data?.id;
    if (!personaId) return null;

    const titulo = `WEB — ${args.compania || args.nombre}`;
    const leadRes = await fetch(`${BASE}/leads?api_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titulo, person_id: personaId }),
    });
    if (!leadRes.ok) return null;
    const leadId = (await leadRes.json())?.data?.id ?? null;

    if (leadId) {
      const nota = [
        `Solicitud de contacto desde ktvworkingdrone.com.co.`,
        `Nombre: ${args.nombre}`,
        args.compania ? `Compañía: ${args.compania}` : null,
        `Email: ${args.email}`,
        args.telefono ? `Teléfono: ${args.telefono}` : null,
        args.mensaje ? `Mensaje: ${args.mensaje}` : null,
      ].filter(Boolean).join('\n');
      await fetch(`${BASE}/notes?api_token=${TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: nota, lead_id: leadId }),
      }).catch((e) => console.error('Pipedrive: error creando nota de contacto', e));
    }
    return leadId ? String(leadId) : null;
  } catch (e) {
    console.error('Pipedrive: error creando lead de contacto', e);
    return null;
  }
}
