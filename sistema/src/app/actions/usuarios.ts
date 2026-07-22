'use server';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireRol } from '@/lib/dal';
import { prisma } from '@/lib/prisma';
import { enviarCorreoBienvenida } from '@/lib/email';
import type { Rol } from '@/lib/session';

export type CrearUsuarioState = { error?: string; ok?: boolean; enlace?: string } | undefined;

// Genera (o regenera) el enlace para que un usuario cree/cambie su contraseña,
// y lo DEVUELVE para mostrarlo en pantalla — así Gerencia lo copia y lo manda
// por WhatsApp o como quiera, sin depender de que el correo salga (SendGrid).
// Sirve tanto para activar un usuario nuevo como para un "olvidé mi contraseña".
export async function generarEnlaceAcceso(usuarioId: string): Promise<{ enlace?: string; error?: string }> {
  await requireRol('GERENCIA');
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!u) return { error: 'El usuario ya no existe.' };
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.usuario.update({ where: { id: usuarioId }, data: { resetToken, resetTokenExpiresAt } });
  return { enlace: `${process.env.NEXT_PUBLIC_APP_URL || ''}/restablecer/${resetToken}` };
}

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
  // Se intenta el correo, pero NO se depende de él: el enlace se devuelve para
  // mostrarlo en pantalla y que Gerencia lo comparta por WhatsApp/como quiera.
  await enviarCorreoBienvenida(email, nombre, url).catch((e) => console.error('Error correo bienvenida', e));

  revalidatePath('/usuarios');
  return { ok: true, enlace: url };
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
