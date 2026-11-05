'use client';

import { useEffect, useState } from 'react';

// El token que Pipedrive pone en la URL del modal caduca a los pocos minutos.
// Si el comercial deja la ventana abierta, o Pipedrive reusa la dirección que
// ya tenía cacheada, la página cargaba con un token vencido y moría pidiendo
// cerrar y volver a abrir — cuando el SDK, que ya está inicializado en esta
// misma página, puede emitir uno nuevo sin molestar a nadie.
//
// Se reintenta UNA sola vez (?reintento=1). Si el token nuevo también falla, no
// es cosa del vencimiento y hay que mirarlo de verdad, no girar en un bucle.
export default function RenovarToken() {
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sdk = (window as unknown as { __pdSdk?: { execute: (c: unknown) => Promise<{ token?: string }> } }).__pdSdk;
        const Ext = (window as unknown as { AppExtensionsSDK?: { Command: { GET_SIGNED_TOKEN: unknown } } }).AppExtensionsSDK;
        if (!sdk || !Ext) {
          setFallo('No se pudo hablar con Pipedrive para renovar la sesión.');
          return;
        }
        const r = await sdk.execute(Ext.Command.GET_SIGNED_TOKEN);
        if (!r?.token) {
          setFallo('Pipedrive no entregó una sesión nueva.');
          return;
        }
        const url = new URL(window.location.href);
        url.searchParams.set('token', r.token);
        url.searchParams.set('reintento', '1');
        window.location.replace(url.toString());
      } catch {
        setFallo('No se pudo renovar la sesión de Pipedrive.');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FBFF] px-6">
      <div className="max-w-md text-center bg-white rounded-2xl shadow p-6 border border-gray-200">
        {fallo ? (
          <>
            <p className="text-sm text-gray-600">{fallo}</p>
            <p className="mt-3 text-xs text-gray-400">Recarga la página del trato (Cmd+R) y vuelve a abrir el cotizador.</p>
          </>
        ) : (
          <p className="text-sm text-gray-600">Renovando la sesión de Pipedrive…</p>
        )}
      </div>
    </div>
  );
}
