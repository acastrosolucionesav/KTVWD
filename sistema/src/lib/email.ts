import 'server-only';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Remitente: debe ser un correo/dominio verificado en SendGrid (Sender
// Authentication) o el envío será rechazado.
const FROM = process.env.SENDGRID_FROM || 'no-responder@ktvworkingdrone.com.co';

export async function enviarCorreoRecuperacion(destinatario: string, urlRestablecer: string) {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SENDGRID_API_KEY no configurada — no se pudo enviar el correo de recuperación.');
    return;
  }
  await sgMail.send({
    from: FROM,
    to: destinatario,
    subject: 'Recuperar contraseña — Sistema Comercial KTV',
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <div style="background:#171E27;color:#fff;padding:20px;border-radius:12px 12px 0 0">
          <span style="color:#66C2F8;font-weight:bold;font-size:12px;letter-spacing:1px">KTV WORKING DRONE</span>
          <h1 style="font-size:18px;margin:8px 0 0">Recuperar contraseña</h1>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p style="color:#374151;font-size:14px">Recibimos una solicitud para restablecer la contraseña de su cuenta en el Sistema Comercial KTV.</p>
          <p style="text-align:center;margin:28px 0">
            <a href="${urlRestablecer}" style="background:#66C2F8;color:#fff;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px">Restablecer contraseña</a>
          </p>
          <p style="color:#9ca3af;font-size:12px">Este enlace vence en 1 hora y solo puede usarse una vez. Si usted no solicitó este cambio, ignore este correo — su contraseña actual sigue funcionando.</p>
        </div>
      </div>
    `,
  });
}
