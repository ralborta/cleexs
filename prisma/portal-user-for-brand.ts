/**
 * Crear / actualizar usuario de portal para un cliente por nombre de marca.
 * NO usa API ni x-admin-secret. Solo necesitás DATABASE_URL (Postgres).
 *
 * 1) En Railway (o Neon): abrí el plugin Postgres → “Connection URL” / DATABASE_URL.
 * 2) Guardala en un archivo .env en la raíz del repo:
 *      DATABASE_URL="postgresql://..."
 *    (o en apps/api/.env; el script lee ambos)
 *
 * Uso:
 *   npm run db:portal-user-brand -- --brand=Hinds --password=Cleexs123
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ensurePortalUserForBrand } from '../apps/api/src/lib/ensure-portal-user-for-brand';

function loadDatabaseUrlFromEnvFiles(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'apps/api/.env'),
  ];
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

function parseArgs(argv: string[]): { brand: string; password: string } {
  let brand = '';
  let password = '';
  for (const a of argv) {
    let m = a.match(/^--brand=(.+)$/);
    if (m) {
      brand = m[1]!.trim();
      continue;
    }
    m = a.match(/^--password=(.*)$/);
    if (m) {
      password = m[1] ?? '';
      continue;
    }
  }
  return { brand, password };
}

loadDatabaseUrlFromEnvFiles();

const prisma = new PrismaClient();

async function main() {
  const { brand, password } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(`
No hay DATABASE_URL.

Sin servidor API: copiá la URL del Postgres (Railway → tu base → Connect → URL)
y pegala en un archivo .env en la raíz del proyecto:

  DATABASE_URL="postgresql://usuario:contraseña@host:5432/nombre_db"

Luego:

  npm run db:portal-user-brand -- --brand=Hinds --password=Cleexs123
`);
    process.exit(1);
  }

  if (!brand || !password) {
    console.error(`
Uso:
  npm run db:portal-user-brand -- --brand=Hinds --password=Cleexs123

(Obligatorio: --brand y --password; mín. 8 caracteres la contraseña.)
`);
    process.exit(1);
  }

  try {
    const out = await ensurePortalUserForBrand(prisma, { brandName: brand, password });
    console.log('\nListo. Usuario para el portal web:\n');
    console.log(JSON.stringify(out, null, 2));
    console.log('\nEntrá en /portal-cliente con ese email y contraseña.\n');
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
