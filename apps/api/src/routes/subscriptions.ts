import { BillingInterval, SubscriptionStatus, UserRole } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  getBillingCurrency,
  getBillingUsdToArsRate,
  getPlanBillingAmountUsd,
  usdToArs,
} from '../lib/billing';
import { getPreApprovalClient, getPublicAppUrl } from '../lib/mercadopago';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';

const checkoutSchema = z.object({
  planId: z.enum(['crecimiento']),
  billingMode: z.enum(['monthly', 'annual']).default('monthly'),
});

function toBillingInterval(value: z.infer<typeof checkoutSchema>['billingMode']) {
  return value === 'annual' ? BillingInterval.annual : BillingInterval.monthly;
}

async function resolveChargeablePlan(planKey: 'crecimiento') {
  const plan = await prisma.plan.findFirst({
    where: {
      OR: [
        { name: { contains: 'crecimiento', mode: 'insensitive' } },
        { name: { contains: 'premium', mode: 'insensitive' } },
        { name: { contains: 'growth', mode: 'insensitive' } },
        { name: { contains: 'pro', mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!plan) {
    throw new Error(`No se encontró el plan cobrable ${planKey} en la tabla plans.`);
  }

  return plan;
}

const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof checkoutSchema> }>('/subscriptions/checkout', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    if (!portalUser) {
      return reply.code(401).send({
        error: 'Para pagar necesitás iniciar sesión en el portal, así podemos activar el plan en tu cuenta.',
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: portalUser.userId },
      select: { role: true },
    });
    if (actor?.role !== UserRole.owner) {
      return reply.code(403).send({ error: 'Solo el administrador de la cuenta puede contratar el plan.' });
    }

    const parsed = checkoutSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Payload inválido para crear suscripción.' });

    const interval = toBillingInterval(parsed.data.billingMode);
    const plan = await resolveChargeablePlan(parsed.data.planId);
    const fxRate = getBillingUsdToArsRate();
    const amountUsd = getPlanBillingAmountUsd(parsed.data.planId, interval);
    const amountArs = usdToArs(amountUsd, fxRate);
    const publicUrl = getPublicAppUrl();
    const reason =
      interval === BillingInterval.annual
        ? `Cleexs Premium anual - ${amountUsd} USD referenciales`
        : `Cleexs Premium mensual - ${amountUsd} USD referenciales`;

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: portalUser.tenantId,
        planId: plan.id,
        status: SubscriptionStatus.pending,
        billingInterval: interval,
        currency: getBillingCurrency(),
        amountUsd,
        amountArs,
        fxRate,
        payerEmail: portalUser.email,
        reason,
      },
    });

    try {
      const preapproval = await getPreApprovalClient().create({
        body: {
          reason,
          payer_email: portalUser.email,
          external_reference: subscription.id,
          back_url: `${publicUrl}/pago/exito?subscription=${encodeURIComponent(subscription.id)}`,
          status: 'pending',
          auto_recurring: {
            frequency: interval === BillingInterval.annual ? 12 : 1,
            frequency_type: 'months',
            transaction_amount: amountArs,
            currency_id: 'ARS',
          },
        },
      });

      const checkoutUrl = preapproval.init_point;
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          mpPreapprovalId: preapproval.id,
          payerEmail: preapproval.payer_email ?? portalUser.email,
          initPoint: checkoutUrl,
          sandboxInitPoint: checkoutUrl,
        },
      });

      return {
        ok: true,
        subscriptionId: subscription.id,
        mpPreapprovalId: preapproval.id,
        checkoutUrl,
        amount: {
          usd: amountUsd,
          ars: amountArs,
          fxRate,
          currency: 'ARS',
        },
      };
    } catch (error) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.cancelled, cancelledAt: new Date() },
      });
      fastify.log.error({ err: error }, 'Mercado Pago preapproval create failed');
      return reply.code(502).send({ error: 'Mercado Pago no pudo crear la suscripción.' });
    }
  });

  fastify.get('/me/subscription', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    if (!portalUser) return reply.code(401).send({ error: 'No autenticado.' });

    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: portalUser.tenantId },
      include: {
        plan: { select: { name: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            planName: subscription.plan.name,
            billingInterval: subscription.billingInterval,
            amountUsd: subscription.amountUsd.toString(),
            amountArs: subscription.amountArs.toString(),
            fxRate: subscription.fxRate.toString(),
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelledAt: subscription.cancelledAt,
            mpPreapprovalId: subscription.mpPreapprovalId,
          }
        : null,
      payments:
        subscription?.payments.map((payment) => ({
          id: payment.id,
          status: payment.status,
          amountArs: payment.amountArs.toString(),
          amountUsd: payment.amountUsd?.toString() ?? null,
          paidAt: payment.paidAt,
          paymentMethodId: payment.paymentMethodId,
          paymentTypeId: payment.paymentTypeId,
        })) ?? [],
    };
  });

  fastify.post('/subscriptions/cancel', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    if (!portalUser) return reply.code(401).send({ error: 'No autenticado.' });

    const actor = await prisma.user.findUnique({
      where: { id: portalUser.userId },
      select: { role: true },
    });
    if (actor?.role !== UserRole.owner) {
      return reply.code(403).send({ error: 'Solo el administrador de la cuenta puede cancelar el plan.' });
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: portalUser.tenantId,
        status: { in: [SubscriptionStatus.pending, SubscriptionStatus.authorized, SubscriptionStatus.paused] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription?.mpPreapprovalId) {
      return reply.code(404).send({ error: 'No hay una suscripción activa para cancelar.' });
    }

    await getPreApprovalClient().update({
      id: subscription.mpPreapprovalId,
      body: { status: 'cancelled' },
    });

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.cancelled, cancelledAt: new Date() },
    });

    return { ok: true };
  });
};

export default subscriptionRoutes;
