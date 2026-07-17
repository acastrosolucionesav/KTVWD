'use client';

import { useActionState, useEffect, useRef } from 'react';
import { crearUsuario } from '@/app/actions/usuarios';

const label = 'block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8] text-sm';

export default function CrearUsuarioForm() {
  const [state, action, pending] = useActionState(crearUsuario, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form action={action} ref={formRef} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[#171E27]">Crear cuenta nueva</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className={label}>Nombre</label>
          <input name="nombre" required className={input} placeholder="Andrea Gómez" />
        </div>
        <div>
          <label className={label}>Correo</label>
          <input name="email" type="email" required className={input} placeholder="andrea@ktvworkingdrone.com.co" />
        </div>
        <div>
          <label className={label}>Rol</label>
          <select name="rol" className={input} defaultValue="COMERCIAL">
            <option value="COMERCIAL">Comercial</option>
            <option value="DIRECTOR_COMERCIAL">Director comercial</option>
            <option value="GERENCIA">Gerencia</option>
          </select>
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">✅ Cuenta creada. Se envió el correo de bienvenida.</p>}

      <button type="submit" disabled={pending}
        className="bg-[#66C2F8] text-white font-bold rounded-full px-6 py-2.5 text-sm disabled:opacity-60">
        {pending ? 'Creando…' : 'Crear usuario'}
      </button>
    </form>
  );
}
