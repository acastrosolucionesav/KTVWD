'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FBFF] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 border border-[#66C3F8]/30">
        <div className="mb-6 text-center">
          <div className="text-2xl font-extrabold tracking-tight text-[#171E27]">KTV</div>
          <div className="text-xs uppercase tracking-widest text-[#66C3F8] font-bold mt-1">Sistema Comercial</div>
        </div>
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Correo</label>
            <input name="email" type="email" required autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C3F8]" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Contraseña</label>
            <input name="password" type="password" required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C3F8]" />
          </div>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button type="submit" disabled={pending}
            className="w-full bg-[#66C3F8] text-white font-bold rounded-full py-2.5 disabled:opacity-60">
            {pending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
