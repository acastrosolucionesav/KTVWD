'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createSession, deleteSession } from '@/lib/session';

export type LoginState = { error?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo) return { error: 'Credenciales inválidas.' };

  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) return { error: 'Credenciales inválidas.' };

  await createSession(usuario.id, usuario.rol, usuario.nombre);
  redirect('/cotizador');
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}
