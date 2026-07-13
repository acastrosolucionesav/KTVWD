import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import RestablecerForm from './RestablecerForm';

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const usuario = await prisma.usuario.findUnique({ where: { resetToken: token } });
  const valido = !!usuario && !!usuario.resetTokenExpiresAt && usuario.resetTokenExpiresAt > new Date();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7FBFF] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 border border-[#66C2F8]/30">
        <div className="mb-6 text-center">
          <Image src="/logo-ktv.png" alt="KTV Working Drone" width={220} height={49} className="mx-auto h-auto w-48" priority />
          <div className="text-xs uppercase tracking-widest text-[#66C2F8] font-bold mt-2">Restablecer contraseña</div>
        </div>

        {valido ? (
          <RestablecerForm token={token} />
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
              Este enlace ya venció o no es válido. Solicite uno nuevo.
            </p>
            <a href="/olvide-password" className="inline-block bg-[#66C2F8] text-white text-sm font-bold rounded-full px-6 py-2.5">
              Solicitar nuevo enlace
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
