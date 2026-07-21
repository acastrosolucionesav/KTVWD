'use client';

import Image from 'next/image';
import { Suspense, useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { login } from '@/app/actions/auth';

function ResetOkBanner() {
  const params = useSearchParams();
  if (params.get('reset') !== 'ok') return null;
  return (
    <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3 mb-4">
      ✓ Contraseña actualizada. Ingrese con su nueva contraseña.
    </p>
  );
}

// Preserva el destino (?next=) a través del login — ej. cuando el comercial
// llega desde un link de Pipedrive con deal_id y aún no tiene sesión.
function NextField() {
  const next = useSearchParams().get('next');
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FBFF] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 border border-[#66C2F8]/30">
        <div className="mb-6 text-center">
          <Image src="/logo-ktv.png" alt="KTV Working Drone" width={220} height={49} className="mx-auto h-auto w-48" priority />
          <div className="text-xs uppercase tracking-widest text-[#66C2F8] font-bold mt-2">Sistema Comercial</div>
        </div>
        <Suspense fallback={null}>
          <ResetOkBanner />
        </Suspense>
        <form action={action} className="space-y-4">
          <Suspense fallback={null}>
            <NextField />
          </Suspense>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Correo</label>
            <input name="email" type="email" required autoFocus
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8]" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Contraseña</label>
            <input name="password" type="password" required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#66C2F8]" />
          </div>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button type="submit" disabled={pending}
            className="w-full bg-[#66C2F8] text-white font-bold rounded-full py-2.5 disabled:opacity-60">
            {pending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <a href="/olvide-password" className="block text-center text-xs text-gray-400 mt-4 hover:underline">¿Olvidó su contraseña?</a>
      </div>
    </div>
  );
}
