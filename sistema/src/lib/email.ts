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

export async function enviarCorreoBienvenida(destinatario: string, nombre: string, urlActivar: string) {
  await enviar(destinatario, 'Bienvenido al Sistema Comercial KTV', envoltura(`Bienvenido, ${nombre}`, `
    <p style="color:#374151;font-size:14px">Se creó su cuenta en el Sistema Comercial KTV con el correo <b>${destinatario}</b>. Cree su contraseña para activarla y empezar a usarla.</p>
    ${boton(urlActivar, 'Crear mi contraseña')}
    <p style="color:#9ca3af;font-size:12px">Este enlace vence en 7 días y solo puede usarse una vez.</p>
  `));
}
