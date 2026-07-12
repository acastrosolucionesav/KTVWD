import 'server-only';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 exige un "driver adapter" explícito — nada de URL implícita.
// Postgres estándar (TCP): sirve igual para el Postgres local de desarrollo
// y para Neon en producción (Vercel sí tiene salida de red completa; el
// bloqueo de TCP directo es una restricción del entorno de este agente,
// no de producción).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
