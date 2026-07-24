import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 renombró "Middleware" a "Proxy" (misma funcionalidad).
// Chequeo optimista: solo verifica que exista la cookie de sesión. La
// verificación real (rol, expiración) se hace en el DAL (dal.ts) en cada
// Server Component/Action — este proxy solo evita el viaje innecesario al
// login cuando es obvio que no hay sesión.

const PUBLICAS = ['/login', '/propuesta'];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const esPublica = PUBLICAS.some((p) => path === p || path.startsWith(p + '/'));
  const tieneSesion = request.cookies.get('session')?.value;

  if (!esPublica && !tieneSesion) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/propuesta).*)'],
};
