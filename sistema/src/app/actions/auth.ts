'use server';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createSession, deleteSession } from '@/lib/session';
import { enviarCorreoRecuperacion } from '@/lib/email';

export type LoginState = { error?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo) return { error: 'Credenciales inválidas.' };

  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) return { error: 'Credenciales inválidas.' };

  await createSession(usuario.id, usuario.rol, usuario.nombre);
  // Respeta ?next= (ej. venir de un link de Pipedrive con deal_id), pero solo
  // rutas internas: debe empezar con "/" y no con "//" (evita redirección a un
  // sitio externo disfrazado). Cualquier otra cosa cae al cotizador normal.
  const next = String(formData.get('next') || '');
  const destino = next.startsWith('/') && !next.startsWith('//') ? next : '/cotizador';
  redirect(destino);
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}

export type SolicitarRecuperacionState = { ok?: boolean; error?: string } | undefined;

// "Olvidé mi contraseña": respuesta genérica siempre (ok:true) exista o no el
// correo — así un tercero no puede usar este formulario para averiguar qué
// correos están registrados en el sistema.
export async function solicitarRecuperacion(_state: SolicitarRecuperacionState, formData: FormData): Promise<SolicitarRecuperacionState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!email) return { error: 'Ingrese su correo.' };

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (usuario && usuario.activo) {
    const token = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { resetToken: token, resetTokenExpiresAt } });
    const url = `${process.env.NEXT_PUBLIC_APP_URL || ''}/restablecer/${token}`;
    await enviarCorreoRecuperacion(usuario.email, url);
  }

  return { ok: true };
}

export type RestablecerPasswordState = { error?: string } | undefined;

export async function restablecerPassword(token: string, _state: RestablecerPasswordState, formData: FormData): Promise<RestablecerPasswordState> {
  const password = String(formData.get('password') || '');
  const confirmar = String(formData.get('confirmar') || '');
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' };
  if (password !== confirmar) return { error: 'Las contraseñas no coinciden.' };

  const usuario = await prisma.usuario.findUnique({ where: { resetToken: token } });
  if (!usuario || !usuario.resetTokenExpiresAt || usuario.resetTokenExpiresAt < new Date()) {
    return { error: 'Este enlace ya venció o no es válido. Solicite uno nuevo.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
  });

  redirect('/login?reset=ok');
}
