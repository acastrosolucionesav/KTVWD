'use client';

import { useActionState } from 'react';
import { crearSolicitudAlianza } from '@/app/actions/alianzas';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-[#66C2F8] text-sm';

export default function AlianzaForm() {
  const [state, action, pending] = useActionState(crearSolicitudAlianza, undefined);

  if (state?.ok) {
    return (
      <div className="bg-white rounded-2xl border border-[#66C2F8]/40 p-8 text-center shadow-sm">
        <p className="text-4xl mb-3">✓</p>
        <h3 className="text-lg font-extrabold text-[#171E27]">Gracias, nos pondremos en contacto</h3>
        <p className="text-sm text-gray-500 mt-2">
          Recibimos su interés en ser aliado de KTV Working Drone. Un miembro de nuestro equipo
          comercial se comunicará con usted muy pronto para conversar sobre el modelo de asociación
          que mejor se ajuste a su empresa.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-4">
      <p className="text-sm text-gray-600">Conversemos sobre cuál modelo de asociación tiene sentido para su empresa.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>Nombre *</label>
          <input name="nombre" required className={input} placeholder="Su nombre" />
        </div>
        <div>
          <label className={label}>Empresa</label>
          <input name="empresa" className={input} placeholder="Nombre de su empresa" />
        </div>
        <div>
          <label className={label}>Correo *</label>
          <input name="email" type="email" required className={input} placeholder="correo@empresa.com" />
        </div>
        <div>
          <label className={label}>Teléfono</label>
          <input name="telefono" className={input} placeholder="Celular / WhatsApp" />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Ciudad / Región de interés</label>
          <input name="ciudad" className={input} placeholder="Ej. Bogotá, Antioquia, Costa Caribe…" />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Mensaje</label>
          <textarea name="mensaje" rows={3} className={input} placeholder="Cuéntenos brevemente sobre su empresa y qué modelo de alianza le interesa." />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}

      <button type="submit" disabled={pending}
        className="w-full bg-[#66C2F8] text-white font-bold rounded-full py-3 disabled:opacity-60">
        {pending ? 'Enviando…' : 'Quiero ser aliado →'}
      </button>
    </form>
  );
}
