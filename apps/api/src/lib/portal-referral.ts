import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { UserRole } from '@prisma/client';

/** Referidos válidos para desbloquear el bundle prometido (curso + reporte + plan). */
export const PORTAL_REFERRAL_GOAL = 20;

export function normalizePortalReferralSlug(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (s.length < 6 || s.length > 64) return null;
  return s;
}

/** Genera y garantiza unicidad de `referral_slug` dentro de una transacción. */
export async function allocateUniqueReferralSlugForTenant(tx: Pick<PrismaClient, 'tenant'>): Promise<string> {
  for (let i = 0; i < 40; i += 1) {
    const slug = crypto.randomBytes(10).toString('hex').slice(0, 16);
    const clash = await tx.tenant.findFirst({
      where: { referralSlug: slug },
      select: { id: true },
    });
    if (!clash) return slug;
  }
  throw new Error('No se pudo generar referralSlug único');
}

async function grantReferralRewardBundle(
  tx: Pick<PrismaClient, 'user' | 'entitlementOverride'>,
  referrerTenantId: string,
) {
  const owner = await tx.user.findFirst({
    where: { tenantId: referrerTenantId, role: UserRole.owner },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const now = new Date();
  const oneYear = new Date(now);
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  await tx.entitlementOverride.create({
    data: {
      tenantId: referrerTenantId,
      userId: owner?.id ?? undefined,
      grantPlan: 'crecimiento',
      active: true,
      startsAt: now,
      endsAt: oneYear,
      reason: 'referral_program_goal_20_bundle',
      createdBy: 'system-referral-reward',
    },
  });
}

/** Tras un alta referida válida: incrementa contador del referrer y aplica recompensa una sola vez al superar el objetivo. */
export async function bumpReferrerAfterSuccessfulReferral(
  tx: Pick<PrismaClient, 'tenant' | 'user' | 'entitlementOverride'>,
  referrerTenantId: string,
): Promise<void> {
  const updated = await tx.tenant.update({
    where: { id: referrerTenantId },
    data: { referralCount: { increment: 1 } },
    select: { referralCount: true, referralRewardAt: true },
  });

  if (updated.referralCount < PORTAL_REFERRAL_GOAL || updated.referralRewardAt != null) {
    return;
  }

  const mark = await tx.tenant.updateMany({
    where: { id: referrerTenantId, referralRewardAt: null },
    data: { referralRewardAt: new Date() },
  });

  if (mark.count === 1) {
    await grantReferralRewardBundle(tx, referrerTenantId);
  }
}

/** Asigna slug de referido si el tenant aún no tiene (tenants previos al programa). */
export async function ensureTenantReferralSlug(prisma: PrismaClient, tenantId: string): Promise<string> {
  const existing = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { referralSlug: true },
  });
  if (existing?.referralSlug) return existing.referralSlug;

  return prisma.$transaction(async (tx) => {
    const row = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { referralSlug: true },
    });
    if (row?.referralSlug) return row.referralSlug;
    const slug = await allocateUniqueReferralSlugForTenant(tx);
    await tx.tenant.update({
      where: { id: tenantId },
      data: { referralSlug: slug },
    });
    return slug;
  });
}

/** Primera atribución: tenant sin referrer + slug válido que apunta a otro tenant. Idempotente. */
export async function maybeAttachReferralForTenant(
  prisma: PrismaClient,
  tenantId: string,
  rawReferrerSlug: string | undefined | null,
): Promise<void> {
  const slug = normalizePortalReferralSlug(rawReferrerSlug ?? undefined);
  if (!slug) return;

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, referredByTenantId: true },
    });
    if (!tenant || tenant.referredByTenantId) return;

    const referrer = await tx.tenant.findFirst({
      where: { referralSlug: slug },
      select: { id: true },
    });
    if (!referrer || referrer.id === tenantId) return;

    await tx.tenant.update({
      where: { id: tenantId },
      data: { referredByTenantId: referrer.id },
    });

    await bumpReferrerAfterSuccessfulReferral(tx, referrer.id);
  });
}
