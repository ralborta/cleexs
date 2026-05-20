import { BillingCurrency, BillingInterval, SubscriptionStatus, type PrismaClient } from '@prisma/client';

const DEFAULT_USD_TO_ARS_RATE = 1400;
const PREMIUM_MONTHLY_USD = 99;
const PREMIUM_ANNUAL_DISCOUNT = 0.8;

export const DEFAULT_BILLING_CURRENCY = BillingCurrency.ARS;

export function getBillingUsdToArsRate(): number {
  const raw = process.env.BILLING_USD_TO_ARS_RATE;
  const parsed = raw ? Number(raw) : DEFAULT_USD_TO_ARS_RATE;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_USD_TO_ARS_RATE;
  return parsed;
}

export function usdToArs(amountUsd: number, rate = getBillingUsdToArsRate()): number {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    throw new Error('amountUsd debe ser un numero positivo.');
  }
  return Math.round(amountUsd * rate);
}

export function getPlanBillingAmountUsd(planKey: string, interval: BillingInterval): number {
  if (planKey !== 'crecimiento') {
    throw new Error(`Plan no cobrable por Mercado Pago: ${planKey}`);
  }

  if (interval === BillingInterval.annual) {
    return Math.round(PREMIUM_MONTHLY_USD * PREMIUM_ANNUAL_DISCOUNT) * 12;
  }

  return PREMIUM_MONTHLY_USD;
}

export function getBillingCurrency(): BillingCurrency {
  const raw = process.env.BILLING_CURRENCY?.trim().toUpperCase();
  return raw === BillingCurrency.USD ? BillingCurrency.USD : DEFAULT_BILLING_CURRENCY;
}

export async function getActiveSubscription(prisma: PrismaClient, tenantId: string, now = new Date()) {
  return prisma.subscription.findFirst({
    where: {
      tenantId,
      status: SubscriptionStatus.authorized,
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function hasActiveSubscription(prisma: PrismaClient, tenantId: string, now = new Date()) {
  const subscription = await getActiveSubscription(prisma, tenantId, now);
  return Boolean(subscription);
}
