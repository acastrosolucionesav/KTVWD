import 'server-only';

// Destino del "Callback URL" que exige el Developer Hub de Pipedrive al crear
// la app (Cotizador KTV). Pipedrive manda aquí al usuario después de que
// aprueba la instalación, con ?code=...
//
// ⚠️ No basta con responder 200: hay que CANJEAR ese `code` por un token
// (POST a oauth.pipedrive.com/oauth/token). Ese canje es lo que cierra el
// trámite de instalación del lado de Pipedrive. Si no se hace, la app queda
// como no instalada — no aparece en "Installed apps" — y la extensión (el
// Custom Modal del trato) NUNCA se ve, aunque en el Developer Hub todo esté
// bien configurado y el usuario haya aprobado los permisos. El síntoma es
// mudo: ni error ni aviso, simplemente el botón no está.
//
// Los tokens que devuelve el canje no se guardan: la integración lee y
// escribe en Pipedrive con PIPEDRIVE_API_TOKEN (ver src/lib/pipedrive.ts), y
// la identidad de quien abre el modal se valida con el JWT que manda Pipedrive
// (src/lib/pipedriveModalAuth.ts). El canje se hace solo para completar el
// handshake de instalación.
const CLIENT_ID = process.env.PIPEDRIVE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.PIPEDRIVE_CLIENT_SECRET?.trim();
const TOKEN_URL = 'https://oauth.pipedrive.com/oauth/token';

function pagina(titulo: string, mensaje: string, esError = false) {
  return new Response(
    `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${titulo} — KTV Working Drone</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#F7FBFF;display:flex;min-height:100vh;align-items:center;justify-content:center">
  <div style="max-width:420px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;text-align:center">
    <div style="background:#171E27;color:#fff;border-radius:12px;padding:16px;margin:-8px -8px 20px">
      <span style="color:#66C2F8;font-weight:bold;font-size:11px;letter-spacing:1px">KTV WORKING DRONE</span>
      <h1 style="font-size:17px;margin:8px 0 0">${titulo}</h1>
    </div>
    <p style="color:${esError ? '#b91c1c' : '#374151'};font-size:14px;line-height:1.5;margin:0">${mensaje}</p>
  </div>
</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // El usuario canceló la instalación, o Pipedrive reportó un problema.
  const error = url.searchParams.get('error');
  if (error) {
    return pagina(
      'No se completó la instalación',
      'La instalación del Cotizador KTV en Pipedrive fue cancelada o rechazada. Puede volver a intentarlo desde el enlace de instalación.',
      true,
    );
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return pagina('Falta el código de instalación', 'Pipedrive no envió el código de autorización. Vuelva a abrir el enlace de instalación desde el Developer Hub.', true);
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return pagina(
      'Falta configuración en el servidor',
      'No están configuradas PIPEDRIVE_CLIENT_ID y/o PIPEDRIVE_CLIENT_SECRET en el servidor, así que no se puede terminar la instalación. Avise a Gerencia.',
      true,
    );
  }

  // El redirect_uri tiene que ser IDÉNTICO al registrado en el Developer Hub
  // — se reconstruye desde la propia petición para que no se desalinee si
  // algún día cambia el dominio.
  const redirectUri = `${url.origin}${url.pathname}`;

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        // Pipedrive espera las credenciales de la app como Basic auth, no en el cuerpo.
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      console.error('Pipedrive: falló el canje del código de instalación', res.status, detalle);
      return pagina(
        'No se pudo terminar la instalación',
        `Pipedrive rechazó el canje del código (error ${res.status}). Verifique que el Client ID y el Client Secret configurados correspondan a la misma app del Developer Hub, y vuelva a intentar la instalación.`,
        true,
      );
    }
  } catch (e) {
    console.error('Pipedrive: error de red al canjear el código de instalación', e);
    return pagina('No se pudo terminar la instalación', 'Hubo un problema de conexión con Pipedrive al terminar la instalación. Vuelva a intentarlo en unos minutos.', true);
  }

  return pagina(
    'Instalación completada',
    'El Cotizador KTV ya quedó instalado en Pipedrive. Puede cerrar esta ventana y abrir cualquier trato: la opción para cotizar aparece en el menú de los tres puntos, arriba a la derecha. Si no la ve de inmediato, recargue Pipedrive.',
  );
}
