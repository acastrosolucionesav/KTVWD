'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import { solicitarRecuperacion } from '@/app/actions/auth';

export default function OlvidePasswordPage() {
  const [state, action, pending] = useActionState(solicitarRecuperacion, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FBFF] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 border border-[#66C2F8]/30">
        <div className="mb-6 text-center">
          <Image src="/logo-ktv.png" alt="KTV Working Drone" width={220} height={49} className="mx-auto h-auto w-48" priority />
          <div className="text-xs uppercase tracking-widest text-[#66C2F8] font-bold mt-2">Recuperar contraseña</div>
        </div>

        {state?.ok ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
            Si el correo está registrado, le enviamos un enlace para restablecer su contraseña. Revise su bandeja de entrada (y spam).
          </p>
        ) : (
          <form action={action} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Correo</label>
              <input name="email" type="email" required autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8]" />
            </div>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            <button type="submit" disabled={pending}
              className="w-full bg-[#66C2F8] text-white font-bold rounded-full py-2.5 disabled:opacity-60">
              {pending ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        )}

        <a href="/login" className="block text-center text-xs text-gray-400 mt-5 hover:underline">← Volver al inicio de sesión</a>
      </div>
    </div>
  );
}
