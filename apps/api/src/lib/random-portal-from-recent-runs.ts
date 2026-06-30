import type { PrismaClient } from '@prisma/client';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { randomPortalPassword } from './provision-account-core';

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export type RandomPortalFromRunsResult = {
  accion: 'updated' | 'created';
  email: string;
  password: string;
  runId: string;
  marca: string;
  dominio: string | null;
  tenantCode: string;
  portalCliente: string;
  portalCrecimientoResultado: string;
};

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

/**
 * Elige al azar un run entre los últimos N; asigna contraseña de portal a un usuario del tenant o crea owner.
 */
export async function randomPortalFromRecentRuns(
  prisma: PrismaClient,
  input: { poolSize?: number; password?: string | null },
): Promise<RandomPortalFromRunsResult> {
  const poolSize = Math.min(100, Math.max(1, input.poolSize ?? 20));
  const password = (input.password?.trim() || randomPortalPassword()).slice(0, 200);
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  const runs = await prisma.run.findMany({
    orderBy: { createdAt: 'desc' },
    take: poolSize,
    include: {
      brand: { select: { id: true, name: true, domain: true } },
      tenant: {
        select: {
          id: true,
          tenantCode: true,
          users: { select: { id: true, email: true, role: true } },
        },
      },
    },
  });

  if (runs.length === 0) {
    throw new Error('No hay corridas (runs) en la base.');
  }

  const run = randomPick(runs);
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

  return {
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
}
