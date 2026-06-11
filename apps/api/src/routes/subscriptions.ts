import { BillingInterval, PaymentStatus, Prisma, SubscriptionStatus, UserRole } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  ensurePremiumPlan,
  getBillingCurrency,
  getPlanConquistarAmountUsd,
  getBillingUsdToArsRate,
  getPlanBillingAmountUsd,
  usdToArs,
} from '../lib/billing';
import { getPreApprovalClient, getPreferenceClient, getPublicAppUrl } from '../lib/mercadopago';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';

const attributionField = z.string().trim().max(120).optional();
const checkoutSchema = z.object({
  planId: z.enum(['crecimiento']),
  billingMode: z.enum(['monthly', 'annual']).default('monthly'),
  // Atribuci?n de adquisici?n (funnel interno). Opcional.
  refCode: attributionField,
  utmSource: attributionField,
  utmMedium: attributionField,
  utmCampaign: attributionField,
  sourceChannel: attributionField,
});

const planConquistarCheckoutSchema = z.object({
  refCode: attributionField,
  utmSource: attributionField,
  utmMedium: attributionField,
  utmCampaign: attributionField,
  sourceChannel: attributionField,
});

const cleanAttr = (v?: string) => {
  const t = (v || '').trim();
  return t ? t : null;
};

function toBillingInterval(value: z.infer<typeof checkoutSchema>['billingMode']) {
  return value === 'annual' ? BillingInterval.annual : BillingInterval.monthly;
}

function checkoutErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') {
      return 'Falta aplicar la migraci?n de facturaci?n en la base de datos (tabla subscriptions).';
    }
  }
  if (error instanceof Error) {
    if (error.message.includes('MP_ACCESS_TOKEN')) {
      return 'Mercado Pago no est? configurado en el servidor (MP_ACCESS_TOKEN).';
    }
    return error.message;
  }
  return 'No se pudo iniciar el checkout.';
}

function mercadoPagoCheckoutUrl(preapproval: { init_point?: string | null; sandbox_init_point?: string | null }) {
  return preapproval.sandbox_init_point ?? preapproval.init_point ?? null;
}

const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof checkoutSchema> }>('/subscriptions/checkout', async (request, reply) => {
    try {
      const portalUser = await resolvePortalUserFromRequest(request);
      if (!portalUser) {
        return reply.code(401).send({
          error: 'Para pagar necesit?s iniciar sesi?n en el portal, as? podemos activar el plan en tu cuenta.',
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
      if (!parsed.success) return reply.code(400).send({ error: 'Payload inv?lido para crear suscripci?n.' });

      if (!process.env.MP_ACCESS_TOKEN?.trim()) {
        return reply.code(503).send({ error: 'Mercado Pago no est? configurado en el servidor (MP_ACCESS_TOKEN).' });
      }

      const interval = toBillingInterval(parsed.data.billingMode);
      const plan = await ensurePremiumPlan(prisma);
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
          refCode: cleanAttr(parsed.data.refCode),
          utmSource: cleanAttr(parsed.data.utmSource),
          utmMedium: cleanAttr(parsed.data.utmMedium),
          utmCampaign: cleanAttr(parsed.data.utmCampaign),
          sourceChannel: cleanAttr(parsed.data.sourceChannel),
        },
      });

      try {
        const preapproval = await getPreApprovalClient().create({
          body: {
            reason,
            payer_email: portalUser.email,
            external_reference: subscription.id,
            back_url: `${publicUrl}/pago/exito?subscription=${encodeURIComponent(subscription.id)}`,
            auto_recurring: {
              frequency: interval === BillingInterval.annual ? 12 : 1,
              frequency_type: 'months',
              transaction_amount: amountArs,
              currency_id: 'ARS',
            },
          },
        });

        const mpLinks = preapproval as typeof preapproval & {
          init_point?: string | null;
          sandbox_init_point?: string | null;
        };
        const checkoutUrl = mercadoPagoCheckoutUrl(mpLinks);
        if (!checkoutUrl) {
          throw new Error('Mercado Pago no devolvi? URL de checkout.');
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            mpPreapprovalId: preapproval.id,
            payerEmail: preapproval.payer_email ?? portalUser.email,
            initPoint: mpLinks.init_point ?? checkoutUrl,
            sandboxInitPoint: mpLinks.sandbox_init_point ?? checkoutUrl,
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
        return reply.code(502).send({ error: 'Mercado Pago no pudo crear la suscripci?n. Revis? credenciales TEST y el monto en ARS.' });
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'subscriptions/checkout failed');
      return reply.code(500).send({ error: checkoutErrorMessage(error) });
    }
  });

  fastify.post<{ Body: z.infer<typeof planConquistarCheckoutSchema> }>(
    '/subscriptions/plan-conquistar/checkout',
    async (request, reply) => {
      try {
        const portalUser = await resolvePortalUserFromRequest(request);
        if (!portalUser) {
          return reply.code(401).send({
            error: 'Para comprar el Plan Conquistar necesitás iniciar sesión en el portal.',
          });
        }

        const actor = await prisma.user.findUnique({
          where: { id: portalUser.userId },
          select: { role: true },
        });
        if (actor?.role !== UserRole.owner) {
          return reply.code(403).send({ error: 'Solo el administrador de la cuenta puede contratar el plan.' });
        }

        const parsed = planConquistarCheckoutSchema.safeParse(request.body ?? {});
        if (!parsed.success) return reply.code(400).send({ error: 'Payload inválido para crear el checkout.' });

        if (!process.env.MP_ACCESS_TOKEN?.trim()) {
          return reply.code(503).send({ error: 'Mercado Pago no está configurado en el servidor (MP_ACCESS_TOKEN).' });
        }

        const fxRate = getBillingUsdToArsRate();
        const amountUsd = getPlanConquistarAmountUsd();
        const amountArs = usdToArs(amountUsd, fxRate);
        const publicUrl = getPublicAppUrl();

        const localPayment = await prisma.payment.create({
          data: {
            tenantId: portalUser.tenantId,
            status: PaymentStatus.pending,
            currency: getBillingCurrency(),
            amountUsd,
            amountArs,
            fxRate,
            payerEmail: portalUser.email,
            rawPayload: {
              product: 'plan_conquistar_90d',
              source: 'checkout_created',
              refCode: cleanAttr(parsed.data.refCode),
              utmSource: cleanAttr(parsed.data.utmSource),
              utmMedium: cleanAttr(parsed.data.utmMedium),
              utmCampaign: cleanAttr(parsed.data.utmCampaign),
              sourceChannel: cleanAttr(parsed.data.sourceChannel),
            },
          },
        });

        try {
          const preference = await getPreferenceClient().create({
            body: {
              external_reference: localPayment.id,
              back_urls: {
                success: `${publicUrl}/pago/exito?product=plan-conquistar&payment=${encodeURIComponent(localPayment.id)}`,
                pending: `${publicUrl}/pago/exito?product=plan-conquistar&payment=${encodeURIComponent(localPayment.id)}&status=pending`,
                failure: `${publicUrl}/plan-conquistar?payment=failed`,
              },
              auto_return: 'approved',
              payer: {
                email: portalUser.email,
              },
              metadata: {
                product: 'plan_conquistar_90d',
                payment_id: localPayment.id,
                tenant_id: portalUser.tenantId,
                user_id: portalUser.userId,
              },
              items: [
                {
                  id: 'plan_conquistar_90d',
                  title: 'Plan Conquistar ChatGPT en 90 días',
                  description: 'Plan de acción personalizado + Cleexs Premium por 90 días',
                  quantity: 1,
                  unit_price: amountArs,
                  currency_id: 'ARS',
                },
              ],
            },
          });

          const links = preference as typeof preference & {
            id?: string;
            init_point?: string | null;
            sandbox_init_point?: string | null;
          };
          const checkoutUrl = links.sandbox_init_point ?? links.init_point ?? null;
          if (!checkoutUrl) throw new Error('Mercado Pago no devolvió URL de checkout.');

          await prisma.payment.update({
            where: { id: localPayment.id },
            data: {
              rawPayload: {
                product: 'plan_conquistar_90d',
                source: 'preference_created',
                preferenceId: links.id ?? null,
                checkoutUrl,
                amountUsd,
                amountArs,
                fxRate,
                refCode: cleanAttr(parsed.data.refCode),
                utmSource: cleanAttr(parsed.data.utmSource),
                utmMedium: cleanAttr(parsed.data.utmMedium),
                utmCampaign: cleanAttr(parsed.data.utmCampaign),
                sourceChannel: cleanAttr(parsed.data.sourceChannel),
              },
            },
          });

          return {
            ok: true,
            paymentId: localPayment.id,
            checkoutUrl,
            amount: {
              usd: amountUsd,
              ars: amountArs,
              fxRate,
              currency: 'ARS',
            },
          };
        } catch (error) {
          await prisma.payment.update({
            where: { id: localPayment.id },
            data: {
              status: PaymentStatus.cancelled,
              rawPayload: {
                product: 'plan_conquistar_90d',
                source: 'preference_failed',
                error: error instanceof Error ? error.message : String(error),
              },
            },
          });
          fastify.log.error({ err: error }, 'Mercado Pago preference create failed');
          return reply.code(502).send({ error: 'Mercado Pago no pudo crear el pago único del Plan Conquistar.' });
        }
      } catch (error) {
        fastify.log.error({ err: error }, 'plan-conquistar checkout failed');
        return reply.code(500).send({ error: checkoutErrorMessage(error) });
      }
    }
  );

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
      return reply.code(404).send({ error: 'No hay una suscripci?n activa para cancelar.' });
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
