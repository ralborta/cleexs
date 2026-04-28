import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { provisionAccount, randomPortalPassword } from '../apps/api/src/lib/provision-account-core';

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
    const key = argv[i];
    const value = argv[i + 1];
    if (key?.startsWith('--') && value && !value.startsWith('--')) {
      map.set(key, value);
      i += 1;
    } else if (key?.startsWith('--')) {
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
    throw new Error('Falta --email válido. Ejemplo: --email ralborta@kiev-srl.com');
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
