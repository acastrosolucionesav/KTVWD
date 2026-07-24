import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSession, type Rol } from '@/lib/session';

// Data Access Layer — centraliza la verificación de sesión (patrón recomendado
// por la documentación oficial de Next.js para Server Components/Actions).
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) redirect('/login');
  return session;
});

// Para páginas/acciones que exigen un rol específico (ej. solo Gerencia ve costos).
export async function requireRol(...roles: Rol[]) {
  const session = await verifySession();
  if (!roles.includes(session.rol)) {
    throw new Error(`Acceso denegado: se requiere rol ${roles.join(' o ')}`);
  }
  return session;
}
