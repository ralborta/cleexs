import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Timeout de conexión en producción para evitar que el arranque se cuelgue si la DB tarda
const baseUrl = process.env.DATABASE_URL ?? '';
const urlWithTimeout =
  baseUrl && !baseUrl.includes('connect_timeout')
    ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}connect_timeout=15`
    : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(urlWithTimeout && { datasources: { db: { url: urlWithTimeout } } }),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
