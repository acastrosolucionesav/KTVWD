'use server';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireRol } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { enviarCorreoBienvenida } from '@/lib/email';
import type { Rol } from '@/lib/session';

export type CrearUsuarioState = { error?: string; ok?: boolean } | undefined;

// Gerencia nunca define ni conoce la contraseña de un comercial nuevo: se
// guarda un hash aleatorio de relleno (nadie puede iniciar sesión con él) y
// se manda un link de activación (mismo mecanismo que "olvidé mi contraseña",
// solo que con vencimiento más largo — 7 días en vez de 1 hora) para que la
// persona cree su propia clave.
export async function crearUsuario(_state: CrearUsuarioState, formData: FormData): Promise<CrearUsuarioState> {
  await requireRol('GERENCIA');

  const nombre = String(formData.get('nombre') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const rol = String(formData.get('rol') || '') as Rol;

  if (!nombre || !email) return { error: 'Nombre y correo son obligatorios.' };
  if (!['COMERCIAL', 'DIRECTOR_COMERCIAL', 'GERENCIA'].includes(rol)) return { error: 'Rol inválido.' };

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return { error: 'Ya existe una cuenta con ese correo.' };

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.usuario.create({
    data: { nombre, email, rol, passwordHash, resetToken, resetTokenExpiresAt },
  });

  const url = `${process.env.NEXT_PUBLIC_APP_URL || ''}/restablecer/${resetToken}`;
  await enviarCorreoBienvenida(email, nombre, url);

  revalidatePath('/usuarios');
  return { ok: true };
}

export async function cambiarEstadoUsuario(usuarioId: string, activo: boolean) {
  const session = await requireRol('GERENCIA');
  if (usuarioId === session.userId && !activo) {
    return { error: 'No puede desactivar su propia cuenta.' };
  }
  await prisma.usuario.update({ where: { id: usuarioId }, data: { activo } });
  revalidatePath('/usuarios');
  return { ok: true };
}
