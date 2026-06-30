/**
 * Lista los últimos N análisis (runs), con marca, tenant y usuarios del tenant.
 * No muestra contraseñas (en BD solo hay hash bcrypt; no son recuperables).
 *
 * Uso (desde la raíz del monorepo):
 *   export DATABASE_URL="postgresql://..."
 *   npm run db:list-recent-runs
 *
 * Si no exportás DATABASE_URL, se intenta leer `apps/api/.env` (solo línea DATABASE_URL=).
 *
 * Opcional — cantidad distinta de 20:
 *   npx tsx prisma/list-recent-runs-portal-users.ts 50
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

function loadDatabaseUrlFromApiEnv(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const candidates = [resolve(process.cwd(), 'apps/api/.env'), resolve(process.cwd(), '.env')];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)$/);
        if (!m) continue;
        let v = m[1].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (v) {
          process.env.DATABASE_URL = v;
          return;
        }
      }
    } catch {
      /* noop */
    }
  }
}

loadDatabaseUrlFromApiEnv();

const prisma = new PrismaClient();

const take = Math.min(100, Math.max(1, Number(process.argv[2]) || 20));

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      'Falta DATABASE_URL. Ejemplo:\n  export DATABASE_URL="postgresql://user:pass@host:5432/db"\n  npx tsx prisma/list-recent-runs-portal-users.ts',
    );
    process.exit(1);
  }

  const runs = await prisma.run.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      brand: { select: { id: true, name: true, domain: true } },
      tenant: {
        select: {
          id: true,
          tenantCode: true,
          tenantPath: true,
          users: {
            select: {
              id: true,
              email: true,
              role: true,
              passwordHash: true,
            },
            orderBy: { email: 'asc' },
          },
        },
      },
    },
  });

  const rows = runs.map((r, index) => {
    const users = r.tenant.users.map((u) => ({
      email: u.email,
      role: u.role,
      portalPasswordSet: Boolean(u.passwordHash),
    }));

    return {
      n: index + 1,
      runId: r.id,
      createdAt: r.createdAt.toISOString(),
      status: r.status,
      runType: r.runType,
      marca: r.brand.name,
      dominio: r.brand.domain ?? '—',
      tenantCode: r.tenant.tenantCode,
      tenantPath: r.tenant.tenantPath,
      usuarios: users.length
        ? users.map((u) => `${u.email} (${u.role}${u.portalPasswordSet ? ', portal OK' : ', sin clave portal'})`).join(' | ')
        : '(sin usuarios)',
    };
  });

  console.log(`\nÚltimos ${take} runs (más recientes primero).\n`);
  console.log(JSON.stringify(rows, null, 2));
  console.log(
    '\nNota: si “sin clave portal”, ese usuario no puede entrar a /portal-cliente hasta provisionar contraseña (db:provision:account o API provision-account).\n',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
