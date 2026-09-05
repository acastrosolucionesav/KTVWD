import 'server-only';
import nodemailer from 'nodemailer';

// Envío de correo por la cuenta de Google Workspace de KTV (reemplaza a SendGrid,
// 2026-07-22). No depende de ningún proveedor externo nuevo: usa el propio
// dominio ya autenticado (SPF/DKIM de Google) → excelente entrega, sin bloqueos.
// Requiere en la cuenta de Google: verificación en 2 pasos activa + una
// "contraseña de aplicación". Variables en Vercel:
//   GMAIL_USER          → correo que envía (ej. notificaciones@ktvworkingdrone.com.co)
//   GMAIL_APP_PASSWORD  → la contraseña de aplicación (16 caracteres, sin espacios)
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM = process.env.CORREO_FROM || GMAIL_USER || 'no-responder@ktvworkingdrone.com.co';

// Correo real donde Gerencia recibe alertas del sistema.
const GERENCIA_ALERTA = process.env.GERENCIA_ALERTA_EMAIL || 'acastro@ktvworkingdrone.com.co';

function emailHabilitado() {
  return !!(GMAIL_USER && GMAIL_APP_PASSWORD);
}

function envoltura(titulo: string, cuerpoHtml: string) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#171E27;color:#fff;padding:20px;border-radius:12px 12px 0 0">
        <span style="color:#66C2F8;font-weight:bold;font-size:12px;letter-spacing:1px">KTV WORKING DRONE</span>
        <h1 style="font-size:18px;margin:8px 0 0">${titulo}</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
        ${cuerpoHtml}
      </div>
    </div>`;
}

function boton(url: string, texto: string) {
  return `<p style="text-align:center;margin:28px 0">
    <a href="${url}" style="background:#66C2F8;color:#fff;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px">${texto}</a>
  </p>`;
}

async function enviar(to: string, subject: string, html: string) {
  if (!emailHabilitado()) {
    console.error(`Correo (Gmail) no configurado — no se pudo enviar "${subject}". Falta GMAIL_USER / GMAIL_APP_PASSWORD.`);
    return;
  }
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  await transport.sendMail({ from: `"KTV Working Drone" <${FROM}>`, to, subject, html });
}

// ── Diagnóstico (página /diagnostico-correo, solo Gerencia) ────────────────
// Cuando un correo no llega, las causas posibles son media docena y todas se
// ven igual desde afuera: variables que no entraron al despliegue, la clave
// pegada con espacios, la cuenta equivocada, Google rechazando la
// autenticación. Esto las separa sin exponer ningún secreto — nunca devuelve
// la contraseña, solo si está, cuánto mide y si trae espacios.
export function estadoCorreo() {
  return {
    habilitado: emailHabilitado(),
    usuario: GMAIL_USER ?? null,
    remitente: FROM,
    destinatarioAlertas: GERENCIA_ALERTA,
    clavePresente: !!GMAIL_APP_PASSWORD,
    claveLongitud: GMAIL_APP_PASSWORD?.length ?? 0,
    claveConEspacios: /\s/.test(GMAIL_APP_PASSWORD ?? ''),
  };
}

// El mensaje crudo de Gmail es justo lo que hace falta para saber qué corregir
// ("535-5.7.8 Username and Password not accepted" = clave o cuenta mala;
// ETIMEDOUT = ni siquiera se pudo conectar). No lleva datos sensibles.
function detalleError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; response?: string; message?: string };
  return [err?.code, err?.responseCode, err?.response ?? err?.message]
    .filter(Boolean).join(' · ') || 'Error desconocido';
}

export async function enviarCorreoPrueba(): Promise<{ ok: true; destinatario: string } | { ok: false; error: string }> {
  if (!emailHabilitado()) {
    return { ok: false, error: 'Este despliegue no tiene GMAIL_USER / GMAIL_APP_PASSWORD. Guárdalas en Vercel y vuelve a desplegar (Redeploy) — las variables solo entran en despliegues nuevos.' };
  }
  try {
    await enviar(GERENCIA_ALERTA, 'Prueba de correo — Sistema Comercial KTV', envoltura('Prueba de correo', `
      <p style="color:#374151;font-size:14px">Si estás leyendo esto, el envío de correos del Sistema Comercial KTV quedó funcionando.</p>
      <p style="color:#9ca3af;font-size:12px">Enviado desde la página de diagnóstico. Ya funcionan también la alerta de apertura de propuesta, la recuperación de contraseña y el aviso de cotización pendiente de aprobación.</p>
    `));
    return { ok: true, destinatario: GERENCIA_ALERTA };
  } catch (e) {
    return { ok: false, error: detalleError(e) };
  }
}

export async function enviarCorreoRecuperacion(destinatario: string, urlRestablecer: string) {
  await enviar(destinatario, 'Recuperar contraseña — Sistema Comercial KTV', envoltura('Recuperar contraseña', `
    <p style="color:#374151;font-size:14px">Recibimos una solicitud para restablecer la contraseña de su cuenta en el Sistema Comercial KTV.</p>
    ${boton(urlRestablecer, 'Restablecer contraseña')}
    <p style="color:#9ca3af;font-size:12px">Este enlace vence en 1 hora y solo puede usarse una vez. Si usted no solicitó este cambio, ignore este correo — su contraseña actual sigue funcionando.</p>
  `));
}

export async function enviarCorreoAprobacionPendiente(args: { idTrazabilidad: string; clienteNombre: string; margenPct: number; urlDetalle: string }) {
  await enviar(GERENCIA_ALERTA, `Cotización pendiente de aprobación — ${args.idTrazabilidad}`, envoltura('Cotización pendiente de aprobación', `
    <p style="color:#374151;font-size:14px"><b>${args.idTrazabilidad}</b> — Cliente: <b>${args.clienteNombre}</b></p>
    <p style="color:#374151;font-size:14px">Margen: <b>${(args.margenPct * 100).toFixed(1)}%</b> — por debajo del mínimo autorizado. No se puede enviar al cliente hasta que la apruebe o la rechace.</p>
    ${boton(args.urlDetalle, 'Revisar y decidir')}
  `));
}

// Decisión Gerencia 2026-07-30: llega siempre a Gerencia (GERENCIA_ALERTA), nunca al
// comercial que creó la cotización — así se supervisan las aperturas de todo el
// equipo desde un solo correo, sin importar quién sea el dueño de cada trato.
export async function enviarCorreoPropuestaAbierta(args: {
  comercialNombre: string; idTrazabilidad: string; clienteNombre: string; urlDetalle: string;
}) {
  await enviar(GERENCIA_ALERTA, `${args.clienteNombre} abrió su propuesta — ${args.idTrazabilidad}`, envoltura('El cliente abrió su propuesta', `
    <p style="color:#374151;font-size:14px"><b>${args.clienteNombre}</b> acaba de abrir el enlace de su propuesta <b>${args.idTrazabilidad}</b> (cotización de ${args.comercialNombre}).</p>
    ${boton(args.urlDetalle, 'Ver cotización')}
  `));
}

export async function enviarCorreoBienvenida(destinatario: string, nombre: string, urlActivar: string) {
  await enviar(destinatario, 'Bienvenido al Sistema Comercial KTV', envoltura(`Bienvenido, ${nombre}`, `
    <p style="color:#374151;font-size:14px">Se creó su cuenta en el Sistema Comercial KTV con el correo <b>${destinatario}</b>. Cree su contraseña para activarla y empezar a usarla.</p>
    ${boton(urlActivar, 'Crear mi contraseña')}
    <p style="color:#9ca3af;font-size:12px">Este enlace vence en 7 días y solo puede usarse una vez.</p>
  `));
}
