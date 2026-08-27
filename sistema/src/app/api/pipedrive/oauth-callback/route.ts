import 'server-only';

// Destino del "Callback URL" que exige el Developer Hub de Pipedrive al crear
// la app (Cotizador KTV). Pipedrive manda aquí al usuario después de que
// aprueba la instalación, con ?code=... — y si esta ruta responde 404, la
// instalación queda a medias y la extensión (el Custom Modal del trato) NO
// aparece en Pipedrive, aunque en el Developer Hub todo se vea bien
// configurado. Ese fue exactamente el síntoma la primera vez que se instaló.
//
// No se canjea el `code` por tokens de OAuth a propósito: la integración lee
// y escribe en Pipedrive con PIPEDRIVE_API_TOKEN (ver src/lib/pipedrive.ts), y
// la identidad de quien abre el modal se valida con el JWT que manda Pipedrive
// (src/lib/pipedriveModalAuth.ts). Esta ruta solo tiene que cerrar el circuito
// de instalación con un 200 y una página que le diga a la persona qué sigue.
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

  return pagina(
    'Instalación completada',
    'El Cotizador KTV ya quedó instalado en Pipedrive. Puede cerrar esta ventana y abrir cualquier trato: la opción para cotizar aparece en el menú de los tres puntos, arriba a la derecha. Si no la ve de inmediato, recargue Pipedrive.',
  );
}
