import 'server-only';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { obtenerCorreoUsuarioPipedrive } from '@/lib/pipedrive';

// Verificación del JWT que Pipedrive manda al abrir el Custom Modal embebido
// en el trato (App Extension del Developer Hub, ver skill ktv-cotizador). Es
// la ÚNICA prueba de que quien abrió la ventana está de verdad dentro de
// Pipedrive — la lectura/escritura de datos del trato sigue yendo por
// PIPEDRIVE_API_TOKEN (src/lib/pipedrive.ts), este archivo no toca esa parte.
//
// Firmado HS256 con el Client Secret de la app — si el campo "JWT secret" del
// Developer Hub se dejó vacío (recomendado), Pipedrive firma con el Client
// Secret directamente, así que validamos con esa misma variable.
//
// .trim() es obligatorio: un espacio o salto de línea de más al copiar el
// secret desde Pipedrive rompe la firma por completo y el error que da
// (firma inválida) es idéntico al de un secret realmente equivocado — cuesta
// horas de diagnóstico si no se hace desde el principio.
const CLIENT_SECRET = process.env.PIPEDRIVE_CLIENT_SECRET?.trim();

export type SesionModalPipedrive = { dealId: number; userId: number };

export async function verificarTokenModal(
  token: string | undefined,
  dealIdParam: string | undefined,
  userIdParam: string | undefined,
): Promise<SesionModalPipedrive | null> {
  if (!CLIENT_SECRET || !token || !dealIdParam || !userIdParam) return null;

  const dealId = Number(dealIdParam);
  const userId = Number(userIdParam);
  if (!Number.isFinite(dealId) || !Number.isFinite(userId)) return null;

  try {
    const key = new TextEncoder().encode(CLIENT_SECRET);
    // jwtVerify ya hace la comparación de firma en tiempo constante y rechaza
    // un token vencido (claim exp) — no hay que reimplementar nada de eso.
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });

    // ⚠️ Pendiente de confirmar con un token real de Pipedrive: si el payload
    // trae el deal_id/user_id embebido (con ese nombre u otro, p.ej.
    // "selectedIds"), hay que cruzarlo aquí contra dealIdParam/userIdParam y
    // rechazar si no coincide. Sin ese cruce, alguien podría quedarse con un
    // token válido y cambiar el deal_id de la URL para ver un trato ajeno —
    // mientras no se confirme el nombre exacto del claim, esta función SOLO
    // garantiza que el token es de nuestra app y no está vencido, no que
    // corresponde exactamente a ese deal_id/user_id de la URL.
    const dealIdEnToken = (payload as Record<string, unknown>).deal_id ?? (payload as Record<string, unknown>).dealId;
    if (dealIdEnToken !== undefined && String(dealIdEnToken) !== dealIdParam) return null;

    return { dealId, userId };
  } catch {
    return null;
  }
}

// Cruza el user_id de Pipedrive contra los Usuario de KTV por correo — el JWT
// prueba que el pedido viene de Pipedrive y de qué user_id de PIPEDRIVE, pero
// eso no es el id de nuestro Usuario ni prueba nada sobre permisos dentro de
// KTV. Si no hay una cuenta KTV activa con ese correo, no se resuelve
// identidad — nunca se crea un Usuario solo ni se asume un rol por defecto.
export async function resolverUsuarioPipedrive(pipedriveUserId: number): Promise<{ id: string; nombre: string } | null> {
  const email = await obtenerCorreoUsuarioPipedrive(pipedriveUserId);
  if (!email) return null;
  const usuario = await prisma.usuario.findUnique({ where: { email }, select: { id: true, nombre: true, activo: true } });
  if (!usuario || !usuario.activo) return null;
  return { id: usuario.id, nombre: usuario.nombre };
}
