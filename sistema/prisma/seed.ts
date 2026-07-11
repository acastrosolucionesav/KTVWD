import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import { PARAMETROS_INICIALES } from '../src/lib/pricing';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  await prisma.usuario.upsert({
    where: { email: 'comercial@ktvworkingdrone.com.co' },
    update: {},
    create: {
      nombre: 'Comercial Demo',
      email: 'comercial@ktvworkingdrone.com.co',
      passwordHash: hash('ktv2026'),
      rol: 'COMERCIAL',
    },
  });
  await prisma.usuario.upsert({
    where: { email: 'director@ktvworkingdrone.com.co' },
    update: {},
    create: {
      nombre: 'Director Comercial Demo',
      email: 'director@ktvworkingdrone.com.co',
      passwordHash: hash('ktv2026'),
      rol: 'DIRECTOR_COMERCIAL',
    },
  });
  await prisma.usuario.upsert({
    where: { email: 'gerencia@ktvworkingdrone.com.co' },
    update: {},
    create: {
      nombre: 'Aura Castro',
      email: 'gerencia@ktvworkingdrone.com.co',
      passwordHash: hash('ktv2026'),
      rol: 'GERENCIA',
    },
  });

  for (const [clave, valor] of Object.entries(PARAMETROS_INICIALES)) {
    await prisma.parametro.upsert({
      where: { clave },
      update: {},
      create: { clave, valor: String(valor), unidad: 'numero' },
    });
  }

  await prisma.clienteProspecto.upsert({
    where: { id: 'demo-plaza-claro' },
    update: {},
    create: {
      id: 'demo-plaza-claro',
      nombre: 'CC Plaza Claro — Multiplika',
      contacto: 'Hernando Cáceres',
      empresa: 'Multiplika',
      canalOrigen: 'referido',
    },
  });

  console.log('Seed listo: 3 usuarios, parámetros iniciales, 1 cliente demo.');
}

main().finally(() => prisma.$disconnect());
