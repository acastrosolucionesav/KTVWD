import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import CrearUsuarioForm from './CrearUsuarioForm';
import UsuarioFila from './UsuarioFila';

export default async function UsuariosPage() {
  const session = await verifySession();
  if (session.rol !== 'GERENCIA') redirect('/cotizador');

  const usuarios = await prisma.usuario.findMany({ orderBy: { creadoAt: 'asc' } });

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-lg font-extrabold text-[#171E27]">Usuarios del sistema</h1>
        <p className="text-sm text-gray-500 mt-1">
          Solo Gerencia. Al crear una cuenta se genera un enlace (vence en 7 días) para que la persona
          cree su propia contraseña — nadie más la conoce ni la define. Ese enlace se muestra en pantalla
          para que lo copie y lo envíe por WhatsApp o como prefiera (además se intenta por correo). El
          mismo botón &quot;Generar enlace de acceso&quot; sirve si alguien olvidó su contraseña.
        </p>
      </div>

      <CrearUsuarioForm />

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <UsuarioFila key={u.id} usuario={u} esMismoUsuario={u.id === session.userId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
