import Link from 'next/link';
import { getSession } from '@/lib/session';
import { logout } from '@/app/actions/auth';

export default async function NavBar() {
  const session = await getSession();
  if (!session) return null;
  return (
    <nav className="bg-[#171E27] text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-extrabold tracking-tight">KTV <span className="text-[#66C3F8] font-normal text-sm">Sistema Comercial</span></span>
        <Link href="/cotizador" className="text-sm text-gray-300 hover:text-white">Cotizador</Link>
        <Link href="/care" className="text-sm text-gray-300 hover:text-white">KTV Care</Link>
        <Link href="/cotizaciones" className="text-sm text-gray-300 hover:text-white">Cotizaciones</Link>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-300">
        <span>{session.nombre} · <span className="text-[#66C3F8]">{session.rol}</span></span>
        <form action={logout}><button className="hover:text-white">Salir</button></form>
      </div>
    </nav>
  );
}
