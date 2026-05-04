/**
 * Elige al azar uno de los últimos 20 runs, y asegura un usuario de portal con contraseña nueva.
 * - Si el tenant ya tiene usuarios: actualiza al azar uno de ellos con la nueva clave.
 * - Si no tiene usuarios: crea uno (email derivado de la marca/dominio del run).
 *
 * Uso:
 *   npm run db:random-portal-from-runs
 *
 * Contraseña opcional (si no, se genera):
 *   npx tsx prisma/random-portal-user-from-recent-runs.ts --password="MiClaveSegura1"
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function genPassword(): string {
  return crypto.randomBytes(10).toString('base64url').slice(0, 14) + 'Aa1';
}

function parsePasswordArg(): string | null {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--password' && argv[i + 1]) return argv[i + 1]!;
    const eq = argv[i]?.match(/^--password=(.+)$/);
    if (eq) return eq[1]!;
  }
  return null;
}

function emailForNewUser(runId: string, brandDomain: string | null, brandName: string): string {
  const domain =
    (brandDomain || '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      ?.trim() || 'cleexs.demo';
  const safeDomain = domain.replace(/[^a-z0-9.-]/gi, '') || 'cleexs.demo';
  const short = runId.replace(/-/g, '').slice(0, 10);
  const slug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12);
  return `portal.${slug || 'cliente'}.${short}@${safeDomain}`.toLowerCase();
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      'Falta DATABASE_URL (o apps/api/.env con DATABASE_URL).\n  export DATABASE_URL="postgresql://..."',
    );
    process.exit(1);
  }

  const runs = await prisma.run.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      brand: { select: { id: true, name: true, domain: true } },
      tenant: {
        select: {
          id: true,
          tenantCode: true,
          users: {
            select: { id: true, email: true, role: true },
          },
        },
      },
    },
  });

  if (runs.length === 0) {
    console.error('No hay runs en la base. No se puede elegir uno al azar.');
    process.exit(1);
  }

  const run = randomPick(runs);
  const password = parsePasswordArg() || genPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  let email: string;
  let action: 'updated' | 'created';

  if (run.tenant.users.length > 0) {
    const user = randomPick(run.tenant.users);
    email = user.email;
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    action = 'updated';
  } else {
    const domainPart =
      (run.brand.domain || '')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        ?.trim() || 'cleexs.demo';
    const safeDomain = domainPart.replace(/[^a-z0-9.-]/gi, '') || 'cleexs.demo';

    email = emailForNewUser(run.id, run.brand.domain, run.brand.name);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!taken) break;
      const suffix = crypto.randomBytes(3).toString('hex');
      email = `portal.${run.id.slice(0, 8)}.${suffix}@${safeDomain}`.toLowerCase();
    }

    await prisma.user.create({
      data: {
        email,
        name: run.brand.name,
        tenantId: run.tenant.id,
        role: UserRole.owner,
        passwordHash,
      },
    });
    action = 'created';
  }

  const out = {
    accion: action,
    email,
    password,
    runId: run.id,
    marca: run.brand.name,
    dominio: run.brand.domain,
    tenantCode: run.tenant.tenantCode,
    portalCliente: `/portal-cliente/reporte/${run.id}`,
    portalCrecimientoResultado: `/portal-crecimiento/reporte/${run.id}`,
  };

  console.log('\n✅ Usuario de portal listo (eligió al azar uno de los últimos 20 runs):\n');
  console.log(JSON.stringify(out, null, 2));
  console.log('\nGuardá la contraseña: no se vuelve a mostrar desde la base de datos.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
