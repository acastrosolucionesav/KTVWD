import Image from 'next/image';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { logout } from '@/app/actions/auth';

export default async function NavBar() {
  const session = await getSession();
  if (!session) return null;
  return (
    <nav className="bg-[#171E27] text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Image src="/logo-ktv-white.png" alt="KTV Working Drone" width={140} height={31} className="h-6 w-auto" />
          <span className="text-[#66C3F8] font-normal text-sm">Sistema Comercial</span>
        </div>
        <Link href="/cotizador" className="text-sm text-gray-300 hover:text-white">Cotizador</Link>
        <Link href="/care" className="text-sm text-gray-300 hover:text-white">KTV Care</Link>
        <Link href="/cotizaciones" className="text-sm text-gray-300 hover:text-white">Cotizaciones</Link>
        {session.rol === 'GERENCIA' && (
          <Link href="/parametros" className="text-sm text-gray-300 hover:text-white">Parámetros</Link>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-300">
        <span>{session.nombre} · <span className="text-[#66C3F8]">{session.rol}</span></span>
        <form action={logout}><button className="hover:text-white">Salir</button></form>
      </div>
    </nav>
  );
}
