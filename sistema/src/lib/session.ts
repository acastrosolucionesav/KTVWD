import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type Rol = 'COMERCIAL' | 'DIRECTOR_COMERCIAL' | 'GERENCIA';
export type SessionPayload = { userId: string; rol: Rol; nombre: string; expiresAt: number };

const secretKey = process.env.SESSION_SECRET || 'dev-secret-cambiar-en-produccion-ktv-2026';
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, { algorithms: ['HS256'] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, rol: Rol, nombre: string) {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const session = await encrypt({ userId, rol, nombre, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
    sameSite: 'lax',
    path: '/',
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('session')?.value;
  if (!cookie) return null;
  return decrypt(cookie);
}
