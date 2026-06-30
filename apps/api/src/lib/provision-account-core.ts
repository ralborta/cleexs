import type { PrismaClient } from '@prisma/client';
import { TenantType, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  allocateUniqueReferralSlugForTenant,
  bumpReferrerAfterSuccessfulReferral,
  normalizePortalReferralSlug,
} from './portal-referral';

export type ProvisionAccountInput = {
  email: string;
  domain: string;
  plan: 'free' | 'crecimiento';
  grantCourtesyCrecimiento: boolean;
  portalPassword: string;
  passwordFromCli: boolean;
  /** Slug del tenant referidor (programa portal cliente). Opcional. */
  referredBySlug?: string | null;
};

export type ProvisionAccountResult = {
  ok: true;
  email: string;
  tenantId: string;
  tenantCode: string | null;
  brandId: string;
  brandDomain: string | null;
  effectivePlan: string;
  warnings: string[];
  portalLogin: {
    hint: string;
    email: string;
    password?: string;
  };
};

function slugFromDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^-+|-+$/g, '');
}

function companyNameFromDomain(domain: string): string {
  const firstPart = domain.split('.')[0] || 'Empresa';
  return firstPart
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function nextAvailableTenantCode(prisma: PrismaClient, base: string): Promise<string> {
  const normalized = base.replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'tenant-local';
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? normalized : `${normalized}-${i}`;
    const exists = await prisma.tenant.findFirst({
      where: { tenantCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${normalized}-${Date.now().toString(36)}`;
}

export function randomPortalPassword(): string {
  return crypto.randomBytes(10).toString('base64url').slice(0, 16) + 'Aa1';
}

export async function provisionAccount(
  prisma: PrismaClient,
  args: ProvisionAccountInput
): Promise<ProvisionAccountResult> {
  const normalizedDomain = slugFromDomain(args.domain);
  const companyName = companyNameFromDomain(normalizedDomain);
  const now = new Date();
  const oneYear = new Date(now);
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  const rootTenant = await prisma.tenant.findFirst({
    where: { tenantCode: '000' },
    select: { id: true, tenantPath: true, planId: true },
  });
  if (!rootTenant) {
    throw new Error('No existe tenant root (000). Ejecutá primero el seed base.');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: args.email },
    include: { tenant: true },
  });

  let tenantId: string | undefined = existingUser?.tenantId;
  let tenantCode: string | null = existingUser?.tenant?.tenantCode ?? null;

  if (!tenantId) {
    const codeBase = normalizedDomain.split('.')[0] || 'tenant-local';
    const assignedCode = await nextAvailableTenantCode(prisma, codeBase);

    await prisma.$transaction(async (tx) => {
      const referrerSlug = normalizePortalReferralSlug(args.referredBySlug);
      let referrerId: string | undefined;
      if (referrerSlug) {
        const ref = await tx.tenant.findFirst({
          where: { referralSlug: referrerSlug },
          select: { id: true },
        });
        if (ref) referrerId = ref.id;
      }

      const referralSlugNew = await allocateUniqueReferralSlugForTenant(tx);

      const tenant = await tx.tenant.create({
        data: {
          tenantCode: assignedCode,
          tenantPath: `${rootTenant.tenantPath}/${assignedCode}`,
          parentTenantId: rootTenant.id,
          tenantType: TenantType.DIRECT_CLIENT,
          planId: rootTenant.planId,
          status: 'active',
          referralSlug: referralSlugNew,
          referredByTenantId: referrerId,
        },
      });
      tenantId = tenant.id;

      if (referrerId) {
        await bumpReferrerAfterSuccessfulReferral(tx, referrerId);
      }
    });
    tenantCode = assignedCode;
  }

  if (!tenantId) {
    throw new Error('Fallo interno al crear tenant.');
  }

  const tenantIdResolved = tenantId;

  const passwordHash = await bcrypt.hash(args.portalPassword, 12);
  const setPasswordOnUpdate = args.passwordFromCli || !existingUser?.passwordHash;

  const user = await prisma.user.upsert({
    where: { email: args.email },
    update: {
      tenantId: tenantIdResolved,
      role: UserRole.owner,
      name: companyName,
      ...(setPasswordOnUpdate ? { passwordHash } : {}),
    },
    create: {
      email: args.email,
      name: companyName,
      tenantId: tenantIdResolved,
      role: UserRole.owner,
      passwordHash,
    },
  });

  const existingBrand = await prisma.brand.findFirst({
    where: { tenantId: tenantIdResolved, OR: [{ name: companyName }, { domain: normalizedDomain }] },
    select: { id: true },
  });

  const brand = existingBrand
    ? await prisma.brand.update({
        where: { id: existingBrand.id },
        data: {
          name: companyName,
          domain: normalizedDomain,
          industry: 'Servicios',
          country: 'Argentina',
          objective: 'Cuenta piloto provisionada automáticamente',
        },
      })
    : await prisma.brand.create({
        data: {
          tenantId: tenantIdResolved,
          name: companyName,
          domain: normalizedDomain,
          industry: 'Servicios',
          country: 'Argentina',
          objective: 'Cuenta piloto provisionada automáticamente',
        },
      });

  const warnings: string[] = [];

  try {
    await prisma.tenantBrandAccess.upsert({
      where: {
        tenantId_brandId: {
          tenantId: tenantIdResolved,
          brandId: brand.id,
        },
      },
      update: {},
      create: {
        tenantId: tenantIdResolved,
        brandId: brand.id,
        source: 'provision-script',
      },
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'P2021') {
      warnings.push('Tabla tenant_brand_access no existe aún (migración pendiente).');
    } else {
      throw error;
    }
  }

  if (args.grantCourtesyCrecimiento) {
    try {
      const existingOverride = await prisma.entitlementOverride.findFirst({
        where: { tenantId: tenantIdResolved, userId: user.id, active: true },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (existingOverride) {
        await prisma.entitlementOverride.update({
          where: { id: existingOverride.id },
          data: {
            grantPlan: 'crecimiento',
            startsAt: now,
            endsAt: oneYear,
            reason: 'Provision automático piloto',
            active: true,
          },
        });
      } else {
        await prisma.entitlementOverride.create({
          data: {
            tenantId: tenantIdResolved,
            userId: user.id,
            grantPlan: 'crecimiento',
            active: true,
            startsAt: now,
            endsAt: oneYear,
            reason: 'Provision automático piloto',
            createdBy: 'provision-account-script',
          },
        });
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2021') {
        warnings.push('Tabla entitlement_overrides no existe aún (migración pendiente).');
      } else {
        throw error;
      }
    }
  }

  return {
    ok: true,
    email: user.email,
    tenantId: tenantIdResolved,
    tenantCode,
    brandId: brand.id,
    brandDomain: brand.domain,
    effectivePlan: args.grantCourtesyCrecimiento ? 'crecimiento' : args.plan,
    warnings,
    portalLogin: {
      hint: 'POST /api/auth/portal/login con { "email", "password" } → token JWT para el portal.',
      email: user.email,
      password: args.passwordFromCli ? undefined : setPasswordOnUpdate ? args.portalPassword : undefined,
    },
  };
}
