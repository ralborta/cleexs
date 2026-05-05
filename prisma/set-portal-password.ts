/**
 * Pone contraseña de portal a un usuario que YA EXISTE en la base (por email).
 * No hace falta API ni x-admin-secret. Solo DATABASE_URL en .env (raíz o apps/api/.env).
 *
 *   npm run db:set-portal-password -- --email=raul@hinds.com --password=Cleexs123
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

function loadDatabaseUrlFromEnvFiles(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  for (const file of [resolve(process.cwd(), '.env'), resolve(process.cwd(), 'apps/api/.env')]) {
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

function assertDatabaseUrlLooksReal(urlRaw: string): void {
  const u = urlRaw.trim();
  if (!/^postgres(ql)?:\/\//i.test(u)) {
    console.error(`
DATABASE_URL tiene que empezar con postgresql:// (valor del Postgres en Railway → Variables).
`);
    process.exit(1);
  }
  if (
    /PEGA_AQUI|LA_URL|URL_COMPLETA|usuario:clave@host|placeholder|changeme|TU_API/i.test(u) ||
    /\bpeg[aá](_|)?.{0,3}aqu[ií]/i.test(u)
  ) {
    console.error(`
Parece que pegaste texto de ejemplo, no la URL real de Postgres (Railway → Postgres → Variables → DATABASE_URL).
`);
    process.exit(1);
  }
}

function parseArgs(argv: string[]): { email: string; password: string } {
  let email = '';
  let password = '';
  for (const a of argv) {
    let m = a.match(/^--email=(.+)$/i);
    if (m) {
      email = m[1]!.trim().toLowerCase();
      continue;
    }
    m = a.match(/^--password=(.*)$/);
    if (m) {
      password = m[1] ?? '';
    }
  }
  return { email, password };
}

loadDatabaseUrlFromEnvFiles();
const prisma = new PrismaClient();

async function main() {
  const { email, password } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL?.trim()) {
    console.error(`
Falta DATABASE_URL en el entorno.

Sin crear ningún archivo: copiá la URL desde Railway (Postgres o servicio API) y ejecutá:

  DATABASE_URL="postgresql://..." npm run db:set-portal-password -- --email=raul@hind.com --password=Cleexs123

Opcional: archivo .env en Cleexs o apps/api/.env con DATABASE_URL="..."
`);
    process.exit(1);
  }
  assertDatabaseUrlLooksReal(process.env.DATABASE_URL!);

  if (!email.includes('@') || password.length < 8) {
    console.error(`
Uso:
  npm run db:set-portal-password -- --email=raul@hinds.com --password=Cleexs123

La contraseña debe tener al menos 8 caracteres.
`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, tenantId: true },
  });

  if (!user) {
    console.error(
      `No existe un usuario con email "${email}". Creá la cuenta primero con:\n` +
        `  npm run db:provision:account -- --email=${email} --domain=TU_DOMINIO_WEB.com --password=${password} --plan=free\n`,
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log('\nListo. Podés entrar en /portal-cliente con:\n');
  console.log(JSON.stringify({ email: user.email, password }, null, 2));
  console.log('');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
