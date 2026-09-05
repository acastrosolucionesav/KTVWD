import { requireRol } from '@/lib/dal';
import { estadoCorreo } from '@/lib/email';
import BotonPrueba from './BotonPrueba';

// Página de diagnóstico del correo (solo Gerencia). Existe porque cuando un
// correo no llega hay media docena de causas que desde afuera se ven idénticas:
// las variables no entraron al despliegue, la contraseña se pegó con espacios,
// la cuenta no es la que generó la contraseña de aplicación, o Google rechaza
// la autenticación. Acá se ven separadas, sin exponer ningún secreto.
export default async function DiagnosticoCorreoPage() {
  await requireRol('GERENCIA');
  const e = estadoCorreo();

  const filas: { label: string; valor: string; mal?: boolean }[] = [
    { label: 'GMAIL_USER (cuenta que envía)', valor: e.usuario ?? 'NO CONFIGURADA', mal: !e.usuario },
    { label: 'GMAIL_APP_PASSWORD', valor: e.clavePresente ? `configurada (${e.claveLongitud} caracteres)` : 'NO CONFIGURADA', mal: !e.clavePresente },
    // La contraseña de aplicación de Google son 16 caracteres. Google la
    // muestra en 4 bloques de 4 y es facilísimo copiar los espacios: quedan 19
    // y la autenticación falla sin decir por qué.
    { label: 'Espacios en la contraseña', valor: e.claveConEspacios ? 'SÍ — hay que quitarlos' : 'no', mal: e.claveConEspacios },
    { label: 'Longitud esperada', valor: e.claveLongitud === 16 || !e.clavePresente ? '16 ✓' : `${e.claveLongitud} (Google entrega 16)`, mal: e.clavePresente && e.claveLongitud !== 16 },
    { label: 'Remitente de los correos', valor: e.remitente },
    { label: 'Las alertas llegan a', valor: e.destinatarioAlertas },
  ];

  return (
    <div className="max-w-2xl mx-auto my-10 space-y-6 px-4">
      <div>
        <h1 className="text-xl font-extrabold text-[#171E27]">Diagnóstico de correo</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lo que ve <b>este</b> despliegue en este momento. Si acabas de guardar las variables en Vercel y
          aquí siguen apareciendo como no configuradas, es que falta volver a desplegar (Redeploy): las
          variables solo entran en despliegues nuevos.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow border border-[#66C2F8]/20 divide-y divide-gray-100">
        {filas.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{f.label}</span>
            <span className={`text-sm font-mono ${f.mal ? 'text-red-600 font-bold' : 'text-[#171E27]'}`}>{f.valor}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow border border-[#66C2F8]/20 p-5 space-y-3">
        <p className="text-sm text-gray-600">
          La prueba real: intenta enviar un correo ahora mismo. Si falla, aquí abajo aparece el motivo
          exacto que devuelve Gmail.
        </p>
        <BotonPrueba />
      </div>
    </div>
  );
}
