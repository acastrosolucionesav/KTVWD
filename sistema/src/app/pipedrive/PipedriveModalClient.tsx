'use client';

import { useCallback, useState } from 'react';
import CotizadorForm, { type CotizacionPuntualExistente } from '../cotizador/CotizadorForm';
import CareForm, { type CotizacionCareExistente } from '../care/CareForm';
import {
  crearCotizacionPuntualPipedrive, crearCotizacionCarePipedrive,
  previsualizarPuntualPipedrive, previsualizarCarePipedrive, marcarEnviadaPipedrive,
  type GuardarPipedriveState, type PreviewPuntualState, type PreviewCareState,
} from '@/app/actions/cotizaciones';

// El JWT de la URL (tokenInicial) caduca a los pocos minutos — para cualquier
// guardado hay que pedirle uno nuevo al SDK de Pipedrive primero. Si por lo
// que sea no se puede refrescar (SDK no inicializó, etc.), se cae de vuelta
// al de la URL en vez de bloquear el guardado — puede que ya haya vencido,
// pero es mejor intentarlo y que el servidor lo rechace con un mensaje claro
// a que el comercial se quede sin poder guardar nada.
async function tokenFresco(tokenInicial: string): Promise<string> {
  try {
    const sdk = (window as unknown as { __pdSdk?: { execute: (cmd: unknown) => Promise<{ token?: string }> } }).__pdSdk;
    const ExtSdk = (window as unknown as { AppExtensionsSDK?: { Command: { GET_SIGNED_TOKEN: unknown } } }).AppExtensionsSDK;
    if (sdk && ExtSdk) {
      const r = await sdk.execute(ExtSdk.Command.GET_SIGNED_TOKEN);
      if (r?.token) return r.token;
    }
  } catch (e) {
    console.warn('No se pudo refrescar el token de Pipedrive; se usa el original', e);
  }
  return tokenInicial;
}

export default function PipedriveModalClient({
  dealId, userId, tokenInicial, puntualExistente, careExistente, dealPrefill,
}: {
  dealId: number;
  userId: number;
  tokenInicial: string;
  puntualExistente?: CotizacionPuntualExistente;
  careExistente?: CotizacionCareExistente;
  dealPrefill?: { clienteNombre: string; clienteContacto: string };
}) {
  const [familia, setFamilia] = useState<'PUNTUAL' | 'CARE' | null>(
    puntualExistente ? 'PUNTUAL' : careExistente ? 'CARE' : null,
  );
  // Qué cotización está viva en esta ventana — la que ya existía para el trato,
  // o la que se acabe de guardar (el formulario lo avisa por onGuardado).
  const [cotizacionId, setCotizacionId] = useState<string | undefined>(puntualExistente?.id ?? careExistente?.id);
  // Cada guardado deja el trato desactualizado otra vez (la cotización vuelve a
  // Borrador con números nuevos), así que se rearma el botón de "Ya la envié".
  const alGuardar = useCallback((id: string) => { setCotizacionId(id); setEnvio({}); }, []);
  const [envio, setEnvio] = useState<{ pendiente?: boolean; ok?: boolean; error?: string }>({});

  // El comercial escribe el correo con la plantilla dentro del propio trato, así
  // que el sistema no tiene forma de enterarse solo de que ya se envió. Este
  // botón es ese aviso: marca la cotización como ENVIADA, pone el valor en el
  // trato y lo mueve a "Propuesta Enviada" (llenando de paso los campos que esa
  // etapa exige, que si no bloquean el movimiento).
  async function marcarComoEnviada() {
    if (!cotizacionId) return;
    setEnvio({ pendiente: true });
    const token = await tokenFresco(tokenInicial);
    const r = await marcarEnviadaPipedrive(token, String(dealId), String(userId), cotizacionId);
    setEnvio({ ok: r.ok, error: r.error });
  }

  const barraEnvio = !cotizacionId ? null : (
      <div className="max-w-2xl mx-auto mt-8 -mb-4 bg-white rounded-2xl border border-[#66C2F8]/40 px-5 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-bold text-[#171E27]">¿Ya le enviaste el correo al cliente?</p>
          <p className="text-[11px] text-gray-500">
            Al confirmarlo, el trato pasa a <b>Propuesta Enviada</b> con el valor cotizado. El correo se sigue
            escribiendo desde el trato con la plantilla de siempre.
          </p>
        </div>
        <button type="button" onClick={marcarComoEnviada} disabled={envio.pendiente || envio.ok}
          className="bg-[#171E27] text-white font-bold rounded-full px-5 py-2.5 text-sm disabled:opacity-60">
          {envio.ok ? '✓ Trato actualizado' : envio.pendiente ? 'Actualizando…' : 'Ya la envié'}
        </button>
        {envio.error && <p className="w-full text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{envio.error}</p>}
      </div>
  );

  async function accionPuntual(_prevState: GuardarPipedriveState | undefined, formData: FormData): Promise<GuardarPipedriveState> {
    const token = await tokenFresco(tokenInicial);
    return crearCotizacionPuntualPipedrive(token, String(dealId), String(userId), formData);
  }
  async function accionCare(_prevState: GuardarPipedriveState | undefined, formData: FormData): Promise<GuardarPipedriveState> {
    const token = await tokenFresco(tokenInicial);
    return crearCotizacionCarePipedrive(token, String(dealId), String(userId), formData);
  }
  // "Calcular" también tiene que autenticarse con el JWT: la versión normal
  // llama a verifySession() y, sin cookie, redirige al login dentro del iframe.
  async function previewPuntual(prevState: PreviewPuntualState, formData: FormData): Promise<PreviewPuntualState> {
    const token = await tokenFresco(tokenInicial);
    return previsualizarPuntualPipedrive(token, String(dealId), String(userId), prevState, formData);
  }
  async function previewCare(prevState: PreviewCareState, formData: FormData): Promise<PreviewCareState> {
    const token = await tokenFresco(tokenInicial);
    return previsualizarCarePipedrive(token, String(dealId), String(userId), prevState, formData);
  }

  // Ni Puntual ni Care tienen todavía una cotización vigente para este trato
  // — el comercial elige qué crear antes de ver el formulario correspondiente.
  if (!familia) {
    return (
      <div className="max-w-md mx-auto p-8 pt-16 text-center space-y-5">
        <h1 className="text-lg font-extrabold text-[#171E27]">¿Qué quieres cotizar?</h1>
        <div className="flex flex-col gap-3">
          <button onClick={() => setFamilia('PUNTUAL')} className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-3">
            Servicio puntual (lavado / inspección)
          </button>
          <button onClick={() => setFamilia('CARE')} className="bg-white border-2 border-[#66C2F8] text-[#171E27] font-bold rounded-full px-6 py-3">
            Programa KTV Care
          </button>
        </div>
      </div>
    );
  }

  // El trato SIEMPRE se vincula (viene de selectedIds, es un hecho), aunque no
  // se haya podido traer su nombre/contacto desde la API de Pipedrive — si el
  // prefill fuera undefined, el formulario mostraría el buscador manual de
  // tratos y la cotización quedaría sin vincular al trato desde el que se abrió.
  const prefill = { id: String(dealId), clienteNombre: dealPrefill?.clienteNombre ?? '', clienteContacto: dealPrefill?.clienteContacto ?? '' };

  if (familia === 'PUNTUAL') {
    return (
      <>
        {barraEnvio}
        <CotizadorForm
          existente={puntualExistente}
          dealPrefill={puntualExistente ? undefined : prefill}
          accion={accionPuntual}
          accionPreview={previewPuntual}
          onGuardado={alGuardar}
        />
      </>
    );
  }
  return (
    <>
      {barraEnvio}
      <CareForm
        existente={careExistente}
        dealPrefill={careExistente ? undefined : prefill}
        accion={accionCare}
        accionPreview={previewCare}
        onGuardado={alGuardar}
      />
    </>
  );
}
