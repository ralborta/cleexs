import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { provisionAccount, randomPortalPassword } from '../apps/api/src/lib/provision-account-core';

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

/** Evita el error críptico de Prisma cuando alguien pega el texto de ejemplo literal. */
function assertDatabaseUrlLooksReal(urlRaw: string): void {
  const u = urlRaw.trim();
  if (!/^postgres(ql)?:\/\//i.test(u)) {
    console.error(`
DATABASE_URL tiene que ser la cadena que Railway te da, empezando con postgresql://
(no tu dominio web, no la URL de la API).
`);
    process.exit(1);
  }
  if (
    /PEGA_AQUI|LA_URL|URL_COMPLETA|usuario:clave@host|placeholder|changeme|TU_API/i.test(u) ||
    /\bpeg[aá](_|)?.{0,3}aqu[ií]/i.test(u)
  ) {
    console.error(`
Parece que pegaste el texto de ejemplo del mensaje de ayuda, no tu URL real.

En Railway:
  1) Abrí el plugin/servicio Postgres (no Vercel, no el servicio Node).
  2) Connect / Variables → copiá el valor de DATABASE_URL tal cual (largo, con usuario, contraseña y host tipo *.railway.app o similar).

No incluyas comillas raras ni la frase "PEGA_AQUI…" — solo la URL completa.
`);
    process.exit(1);
  }
}

const prisma = new PrismaClient();

type CliArgs = {
  email: string;
  domain: string;
  plan: 'free' | 'crecimiento';
  grantCourtesyCrecimiento: boolean;
  portalPassword: string;
  passwordFromCli: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i]!;
    if (!raw.startsWith('--')) continue;

    const eq = raw.indexOf('=');
    if (eq !== -1) {
      map.set(raw.slice(0, eq), raw.slice(eq + 1));
      continue;
    }

    const key = raw;
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      map.set(key, value);
      i += 1;
    } else {
      map.set(key, 'true');
    }
  }

  const email = (map.get('--email') || '').trim().toLowerCase();
  const domain = (map.get('--domain') || '').trim().toLowerCase();
  const planRaw = (map.get('--plan') || 'crecimiento').trim().toLowerCase();
  const plan = planRaw === 'free' ? 'free' : 'crecimiento';
  const grantCourtesyCrecimiento =
    map.get('--courtesy-crecimiento') === 'true' ||
    map.get('--courtesy-premium') === 'true' ||
    plan === 'crecimiento';

  const passwordArg = (map.get('--password') || '').trim();
  const portalPassword = passwordArg || randomPortalPassword();

  if (!email || !email.includes('@')) {
    throw new Error(
      'Falta --email válido. Ejemplos: --email=raul@hind.com   o   --email raul@hind.com',
    );
  }
  if (!domain || !domain.includes('.')) {
    throw new Error('Falta --domain válido. Ejemplo: --domain kiev-srl.com');
  }

  return {
    email,
    domain,
    plan,
    grantCourtesyCrecimiento,
    portalPassword,
    passwordFromCli: Boolean(passwordArg),
  };
}

async function main() {
  loadDatabaseUrlFromEnvFiles();
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(`
Falta DATABASE_URL en el entorno.

Sin crear ningún archivo: copiá la URL de Postgres desde Railway
(Postgres → Variables → DATABASE_URL, o la misma variable que usa tu servicio API)
y ejecutá EN UNA LÍNEA desde la carpeta Cleexs (entre comillas va SOLO lo que copiaste, tal cual, de Railway):

  DATABASE_URL='PEGÁ_ACÁ_LA_URL_REAL_SIN_CAMBIAR_POR_TEXTO_DE_EJEMPLO' npm run db:provision:account -- \\
    --email=raul@hind.com --domain=hind.com --password=Cleexs123 --plan=free

Opcional: archivo .env en la raíz del repo o en apps/api/.env con la misma línea DATABASE_URL=...
`);
    process.exit(1);
  }
  assertDatabaseUrlLooksReal(process.env.DATABASE_URL!);
  const args = parseArgs(process.argv.slice(2));
  const output = await provisionAccount(prisma, args);
  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error('❌ Error en provision-account:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
