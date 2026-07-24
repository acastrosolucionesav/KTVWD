import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PARAMETROS_INICIALES } from '../src/lib/pricing';

function id() {
  return 'c' + crypto.randomBytes(12).toString('hex');
}

const hash = (pw: string) => bcrypt.hashSync(pw, 10);

const usuarios = [
  { id: id(), nombre: 'Comercial Demo', email: 'comercial@ktvworkingdrone.com.co', rol: 'COMERCIAL' },
  { id: id(), nombre: 'Director Comercial Demo', email: 'director@ktvworkingdrone.com.co', rol: 'DIRECTOR_COMERCIAL' },
  { id: id(), nombre: 'Aura Castro', email: 'gerencia@ktvworkingdrone.com.co', rol: 'GERENCIA' },
];

const lines: string[] = [];
lines.push('-- Seed inicial de producción: 3 usuarios + parámetros del motor de precios.');
lines.push('-- Generado localmente (bcrypt no necesita red); ejecutar UNA sola vez en el SQL Editor de Neon.');
lines.push('');
for (const u of usuarios) {
  const h = hash('ktv2026').replace(/'/g, "''");
  lines.push(
    `INSERT INTO "Usuario" (id, nombre, email, "passwordHash", rol, activo, "creadoAt") VALUES ('${u.id}', '${u.nombre.replace(/'/g, "''")}', '${u.email}', '${h}', '${u.rol}', true, now());`
  );
}
lines.push('');
for (const [clave, valor] of Object.entries(PARAMETROS_INICIALES)) {
  lines.push(
    `INSERT INTO "Parametro" (clave, valor, unidad) VALUES ('${clave}', '${String(valor)}', 'numero');`
  );
}

console.log(lines.join('\n'));
