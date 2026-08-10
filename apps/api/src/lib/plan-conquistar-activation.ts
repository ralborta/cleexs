import { UserRole, type PrismaClient } from '@prisma/client';
import { ensurePremiumPlan, PREMIUM_PLAN_ID } from './billing';
import { getAppBaseUrlForPublicLinks } from './app-public-url';
import { provisionAccount, randomPortalPassword } from './provision-account-core';
import { sendPortalMagicLinkForUser } from './portal-magic-link';
import { sendPlanConquistarPremiumWelcomeEmail } from './plan-conquistar-premium-email';
import {
  buildPlanConquistarDeliverable,
  mergePaymentRawPayload,
  planAtaqueAbsoluteUrl,
} from './plan-conquistar-deliverable';
import { prisma } from './prisma';

const PREMIUM_DAYS = 90;

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function normalizeDomain(raw: string | null | undefined): string {
  const value = (raw || 'cleexs.client').trim();
  if (value.startsWith('brand-')) return 'cleexs.client';
  return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'cleexs.client';
}

export async function ensurePortalUserForDiagnosticCheckout(
  client: PrismaClient,
  diagnosticId: string,
): Promise<{ userId: string; tenantId: string; email: string; generatedPassword?: string } | null> {
  const diagnostic = await client.publicDiagnostic.findUnique({
    where: { id: diagnosticId },
    select: {
      email: true,
      domain: true,
      brandName: true,
      runId: true,
    },
  });

  const emailRaw = diagnostic?.email?.trim().toLowerCase();
  if (!emailRaw || !emailRaw.includes('@') || emailRaw.endsWith('@whatsapp.cleexs.net')) {
    return null;
  }

  const run = diagnostic?.runId
    ? await client.run.findUnique({
        where: { id: diagnostic.runId },
        select: { brandId: true, brand: { select: { domain: true } } },
      })
    : null;

  const brandId = run?.brandId;
  const domain = normalizeDomain(diagnostic?.domain || run?.brand?.domain);

  const existing = await client.user.findUnique({
    where: { email: emailRaw },
    select: { id: true, tenantId: true, email: true },
  });

  if (existing) {
    if (brandId) {
      await client.tenantBrandAccess.upsert({
        where: { tenantId_brandId: { tenantId: existing.tenantId, brandId } },
        update: {},
        create: { tenantId: existing.tenantId, brandId, source: 'plan_conquistar_checkout' },
      });
    }
    return { userId: existing.id, tenantId: existing.tenantId, email: existing.email };
  }

  const generatedPassword = randomPortalPassword();
  const provisioned = await provisionAccount(client, {
    email: emailRaw,
    domain,
    plan: 'free',
    grantCourtesyCrecimiento: false,
    portalPassword: generatedPassword,
    passwordFromCli: false,
  });

  const user = await client.user.findUnique({
    where: { email: emailRaw },
    select: { id: true, tenantId: true, email: true },
  });
  if (!user) return null;

  if (brandId) {
    try {
      await client.tenantBrandAccess.upsert({
        where: { tenantId_brandId: { tenantId: user.tenantId, brandId } },
        update: {},
        create: { tenantId: user.tenantId, brandId, source: 'plan_conquistar_checkout' },
      });
    } catch {
      // acceso delegado opcional si la migración no está aplicada
    }
  }

  return {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    generatedPassword,
  };
}

/** Checkout Premium desde /planes u otros entrypoints sin diagnóstico previo. */
export async function ensurePortalUserForEmailCheckout(
  client: PrismaClient,
  rawEmail: string,
): Promise<{ userId: string; tenantId: string; email: string; generatedPassword?: string } | null> {
  const emailRaw = rawEmail.trim().toLowerCase();
  if (!emailRaw || !emailRaw.includes('@') || emailRaw.endsWith('@whatsapp.cleexs.net')) {
    return null;
  }

  const existing = await client.user.findUnique({
    where: { email: emailRaw },
    select: { id: true, tenantId: true, email: true },
  });
  if (existing) {
    return { userId: existing.id, tenantId: existing.tenantId, email: existing.email };
  }

  const generatedPassword = randomPortalPassword();
  await provisionAccount(client, {
    email: emailRaw,
    domain: 'cleexs.client',
    plan: 'free',
    grantCourtesyCrecimiento: false,
    portalPassword: generatedPassword,
    passwordFromCli: false,
  });

  const user = await client.user.findUnique({
    where: { email: emailRaw },
    select: { id: true, tenantId: true, email: true },
  });
  if (!user) return null;

  return {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    generatedPassword,
  };
}

export async function activatePlanConquistarPremiumAfterPayment(input: {
  tenantId: string;
  paymentId: string;
  mpPaymentId?: string | null;
  approvedAt: Date;
  payerEmail?: string | null;
}) {
  await ensurePremiumPlan(prisma);

  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: { planId: PREMIUM_PLAN_ID },
  });

  const reason = `Plan Conquistar 90 días - MP ${input.mpPaymentId ?? input.paymentId}`;
  const endsAt = addDays(input.approvedAt, PREMIUM_DAYS);

  const existingOverride = await prisma.entitlementOverride.findFirst({
    where: {
      tenantId: input.tenantId,
      active: true,
      reason: { contains: 'Plan Conquistar' },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!existingOverride) {
    await prisma.entitlementOverride.create({
      data: {
        tenantId: input.tenantId,
        grantPlan: 'crecimiento',
        reason,
        startsAt: input.approvedAt,
        endsAt,
        active: true,
        createdBy: 'mercadopago-webhook',
      },
    });
  } else if (!existingOverride.endsAt || existingOverride.endsAt < endsAt) {
    await prisma.entitlementOverride.update({
      where: { id: existingOverride.id },
      data: {
        grantPlan: 'crecimiento',
        reason,
        startsAt: input.approvedAt,
        endsAt,
        active: true,
      },
    });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: { rawPayload: true, payerEmail: true },
  });
  const raw = (payment?.rawPayload ?? {}) as Record<string, unknown>;
  const generatedPassword =
    typeof raw.generatedPassword === 'string' ? raw.generatedPassword : undefined;
  const diagnosticId =
    typeof raw.diagnosticId === 'string' && raw.diagnosticId.trim()
      ? raw.diagnosticId.trim()
      : null;

  let planDeliverable: Awaited<ReturnType<typeof buildPlanConquistarDeliverable>> = null;
  if (diagnosticId) {
    try {
      planDeliverable = await buildPlanConquistarDeliverable(diagnosticId);
    } catch {
      planDeliverable = null;
    }
  }

  const planAtaquePath =
    planDeliverable?.planAtaquePath ||
    (diagnosticId
      ? `/portal-crecimiento/plan-ataque?diagnosticId=${encodeURIComponent(diagnosticId)}`
      : '/portal-crecimiento');
  const planAtaqueUrl = planAtaqueAbsoluteUrl(planAtaquePath);

  if (planDeliverable || diagnosticId) {
    await prisma.payment.update({
      where: { id: input.paymentId },
      data: {
        rawPayload: mergePaymentRawPayload(raw, {
          planDeliverable: planDeliverable ?? undefined,
          planAtaquePath,
          planGeneratedAt: new Date().toISOString(),
        }),
      },
    });
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId: input.tenantId, role: UserRole.owner },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, passwordHash: true },
  });

  const loginEmail = (input.payerEmail || owner?.email || payment?.payerEmail || '').trim().toLowerCase();
  let emailSent = false;
  let emailSkipReason: string | undefined;
  let magicLinkUrl: string | null = null;

  if (loginEmail && owner?.id) {
    const magic = await sendPortalMagicLinkForUser({
      userId: owner.id,
      createdBy: 'subscription-premium',
      portalTarget: 'premium',
      runId: planDeliverable?.runId ?? undefined,
      redirectPath: planAtaquePath,
      subject: 'Plan Conquistar activo · Tu Plan de Ataque está listo',
      intro:
        'Tu pago fue confirmado. Entrá con un click a tu Plan de Ataque personalizado (90 días) y al portal Premium.',
    });
    emailSent = magic.sent;
    emailSkipReason = magic.reason;
    magicLinkUrl = magic.magicLinkUrl ?? null;
  } else if (loginEmail) {
    const mail = await sendPlanConquistarPremiumWelcomeEmail({
      to: loginEmail,
      loginEmail,
      portalUrl: planAtaqueUrl,
      premiumUntil: endsAt,
      temporaryPassword: generatedPassword,
    });
    emailSent = mail.sent;
    emailSkipReason = mail.reason;
  }

  return {
    premiumDays: PREMIUM_DAYS,
    premiumUntil: endsAt.toISOString(),
    emailSent,
    emailSkipReason,
    loginEmail: loginEmail || null,
    magicLinkUrl,
    planAtaquePath,
    diagnosticId,
    planGenerated: Boolean(planDeliverable),
  };
}
