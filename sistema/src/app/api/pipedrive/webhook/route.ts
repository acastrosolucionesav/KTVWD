import 'server-only';
import { NextResponse } from 'next/server';
import { registrarEnvioMaterial, MATERIALES } from '@/lib/pipedrive';

// Receptor de la Automatización de Pipedrive: el comercial marca como "hecha"
// una actividad nativa (ej. "Enviar Brochure Frío" o "Enviar Catálogo Care")
// dentro del trato, sin salir de Pipedrive — la Automatización dispara este
// webhook, que deja una nota estructurada en el mismo trato. No mueve etapa
// ni toca el valor (eso solo pasa al marcar la propuesta real como enviada
// desde el sistema — ver registrarPropuestaEnviada).
//
// Autenticación: un secreto compartido en la URL configurada en Pipedrive
// (?secret=...), NO en el cuerpo — evita que cualquiera con la URL pública
// del webhook pueda escribir notas en tratos ajenos.
export async function POST(req: Request) {
  const secretEsperado = process.env.PIPEDRIVE_WEBHOOK_SECRET;
  if (!secretEsperado) {
    return NextResponse.json({ ok: false, error: 'PIPEDRIVE_WEBHOOK_SECRET no configurado en el servidor.' }, { status: 500 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get('secret') !== secretEsperado) {
    return NextResponse.json({ ok: false, error: 'Secreto inválido.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo no es JSON válido.' }, { status: 400 });
  }

  const { dealId, material } = (body ?? {}) as { dealId?: unknown; material?: unknown };
  const dealIdNum = Number(dealId);
  if (!dealId || Number.isNaN(dealIdNum)) {
    return NextResponse.json({ ok: false, error: 'Falta dealId (numérico) en el cuerpo.' }, { status: 400 });
  }
  if (typeof material !== 'string' || !(material in MATERIALES)) {
    return NextResponse.json({ ok: false, error: `material inválido — use ${Object.keys(MATERIALES).join(' o ')}.` }, { status: 400 });
  }

  const m = MATERIALES[material as keyof typeof MATERIALES];
  const resultado = await registrarEnvioMaterial(dealIdNum, m);
  if (!resultado.ok) {
    return NextResponse.json({ ok: false, error: resultado.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
