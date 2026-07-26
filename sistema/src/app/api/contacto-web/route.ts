import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { crearLeadContacto } from '@/lib/pipedrive';

// Receptor del formulario de contacto del sitio público principal
// (ktvworkingdrone.com.co) — un sitio ESTÁTICO, fuera de este proyecto Next,
// así que llega por fetch() cruzando de dominio, no por un server action.
// Mismo patrón que crearSolicitudAlianza: se guarda SIEMPRE en la base (nunca
// se pierde un interesado aunque Pipedrive falle) y, best-effort, se crea un
// lead en Pipedrive marcado como WEB.
//
// CORS abierto a propósito: es un formulario público de captación de leads,
// sin sesión ni dato confidencial en la respuesta — el mismo riesgo que
// cualquier formulario de contacto público.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Cuerpo no es JSON válido.' }, { status: 400, headers: CORS_HEADERS });
  }
  const { nombre, compania, email, telefono, mensaje } = (body ?? {}) as Record<string, unknown>;

  const nombreLimpio = String(nombre || '').trim();
  const emailLimpio = String(email || '').trim().toLowerCase();
  if (!nombreLimpio) {
    return NextResponse.json({ ok: false, error: 'Por favor indíquenos su nombre.' }, { status: 400, headers: CORS_HEADERS });
  }
  if (!emailLimpio || !emailLimpio.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Por favor indíquenos un correo válido.' }, { status: 400, headers: CORS_HEADERS });
  }

  const companiaLimpia = String(compania || '').trim() || null;
  const telefonoLimpio = String(telefono || '').trim() || null;
  const mensajeLimpio = String(mensaje || '').trim() || null;

  const solicitud = await prisma.solicitudContacto.create({
    data: { nombre: nombreLimpio, compania: companiaLimpia, email: emailLimpio, telefono: telefonoLimpio, mensaje: mensajeLimpio },
  });

  // Best-effort: nunca bloquea la confirmación al visitante si Pipedrive falla.
  const leadId = await crearLeadContacto({
    nombre: nombreLimpio, compania: companiaLimpia, email: emailLimpio, telefono: telefonoLimpio, mensaje: mensajeLimpio,
  }).catch(() => null);
  if (leadId) {
    await prisma.solicitudContacto.update({ where: { id: solicitud.id }, data: { pipedriveLeadId: leadId } }).catch(() => {});
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
