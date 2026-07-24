'use client';

import { useActionState } from 'react';
import { restablecerPassword } from '@/app/actions/auth';

export default function RestablecerForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(restablecerPassword.bind(null, token), undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Nueva contraseña</label>
        <input name="password" type="password" required minLength={8} autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8]" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Confirmar contraseña</label>
        <input name="confirmar" type="password" required minLength={8}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8]" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="w-full bg-[#66C2F8] text-white font-bold rounded-full py-2.5 disabled:opacity-60">
        {pending ? 'Guardando…' : 'Guardar nueva contraseña'}
      </button>
    </form>
  );
}
