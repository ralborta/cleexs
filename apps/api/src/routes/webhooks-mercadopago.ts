import {
  BillingInterval,
  PaymentStatus,
  SubscriptionStatus,
  type Prisma,
  type Subscription,
} from '@prisma/client';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { getPaymentClient, getPreApprovalClient, verifyMercadoPagoWebhookSignature } from '../lib/mercadopago';
import { prisma } from '../lib/prisma';

type MercadoPagoWebhookBody = {
  id?: string | number;
  type?: string;
  topic?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

type RawPayment = {
  id?: number;
  status?: string;
  status_detail?: string;
  currency_id?: string;
  transaction_amount?: number;
  date_approved?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  external_reference?: string;
  payer?: { email?: string };
  metadata?: Record<string, unknown>;
  transaction_details?: { net_received_amount?: number };
  preapproval_id?: string;
  merchant_order_id?: string | number;
};

type RawPreApproval = {
  id?: string;
  status?: string;
  external_reference?: string;
  payer_email?: string;
  reason?: string;
  next_payment_date?: string;
  auto_recurring?: {
    transaction_amount?: number;
    currency_id?: string;
  };
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function parseDate(value?: string | number | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function mapSubscriptionStatus(status?: string): SubscriptionStatus {
  switch ((status || '').toLowerCase()) {
    case 'authorized':
      return SubscriptionStatus.authorized;
    case 'paused':
      return SubscriptionStatus.paused;
    case 'cancelled':
    case 'canceled':
      return SubscriptionStatus.cancelled;
    case 'expired':
      return SubscriptionStatus.expired;
    default:
      return SubscriptionStatus.pending;
  }
}

function mapPaymentStatus(status?: string): PaymentStatus {
  switch ((status || '').toLowerCase()) {
    case 'approved':
      return PaymentStatus.approved;
    case 'rejected':
      return PaymentStatus.rejected;
    case 'cancelled':
    case 'canceled':
      return PaymentStatus.cancelled;
    case 'refunded':
      return PaymentStatus.refunded;
    case 'charged_back':
    case 'charged-back':
      return PaymentStatus.charged_back;
    default:
      return PaymentStatus.pending;
  }
}

function eventTypeOf(body: MercadoPagoWebhookBody) {
  return body.type || body.topic || 'unknown';
}

function resourceIdOf(body: MercadoPagoWebhookBody) {
  return body.data?.id ?? body.id ?? null;
}

async function findFreePlanId() {
  const plan = await prisma.plan.findFirst({
    where: {
      OR: [
        { name: { contains: 'free', mode: 'insensitive' } },
        { name: { contains: 'gratis', mode: 'insensitive' } },
        { name: { contains: 'basic', mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return plan?.id ?? null;
}

async function activateSubscription(subscription: Subscription, currentPeriodEnd?: Date | null) {
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.authorized,
        startedAt: subscription.startedAt ?? new Date(),
        currentPeriodStart: subscription.currentPeriodStart ?? new Date(),
        currentPeriodEnd: currentPeriodEnd ?? subscription.currentPeriodEnd,
        cancelledAt: null,
      },
    }),
    prisma.tenant.update({
      where: { id: subscription.tenantId },
      data: { planId: subscription.planId },
    }),
  ]);
}

async function maybeDowngradeCancelledSubscription(subscription: Subscription) {
  const freePlanId = await findFreePlanId();
  if (!freePlanId) return;

  const tenant = await prisma.tenant.findUnique({
    where: { id: subscription.tenantId },
    select: { planId: true },
  });

  if (tenant?.planId === subscription.planId) {
    await prisma.tenant.update({
      where: { id: subscription.tenantId },
      data: { planId: freePlanId },
    });
  }
}

async function processPreApproval(resourceId: string) {
  const preapproval = (await getPreApprovalClient().get({ id: resourceId })) as RawPreApproval;
  const localSubscription = preapproval.external_reference
    ? await prisma.subscription.findUnique({ where: { id: preapproval.external_reference } })
    : await prisma.subscription.findUnique({ where: { mpPreapprovalId: resourceId } });

  if (!localSubscription) return { processed: false, reason: 'subscription_not_found' };

  const status = mapSubscriptionStatus(preapproval.status);
  const currentPeriodEnd = parseDate(preapproval.next_payment_date);
  const updated = await prisma.subscription.update({
    where: { id: localSubscription.id },
    data: {
      status,
      mpPreapprovalId: preapproval.id ?? localSubscription.mpPreapprovalId,
      payerEmail: preapproval.payer_email ?? localSubscription.payerEmail,
      reason: preapproval.reason ?? localSubscription.reason,
      currentPeriodEnd: currentPeriodEnd ?? localSubscription.currentPeriodEnd,
      cancelledAt: status === SubscriptionStatus.cancelled ? new Date() : localSubscription.cancelledAt,
    },
  });

  if (status === SubscriptionStatus.authorized) {
    await activateSubscription(updated, currentPeriodEnd);
  } else if (status === SubscriptionStatus.cancelled || status === SubscriptionStatus.expired) {
    await maybeDowngradeCancelledSubscription(updated);
  }

  return { processed: true };
}

async function findSubscriptionForPayment(payment: RawPayment) {
  const externalReference = typeof payment.external_reference === 'string' ? payment.external_reference : undefined;
  if (externalReference) {
    const byExternalReference = await prisma.subscription.findUnique({
      where: { id: externalReference },
    });
    if (byExternalReference) return byExternalReference;
  }

  const metadataPreapproval =
    typeof payment.metadata?.preapproval_id === 'string' ? payment.metadata.preapproval_id : undefined;
  const preapprovalId = payment.preapproval_id || metadataPreapproval;
  if (preapprovalId) {
    return prisma.subscription.findUnique({ where: { mpPreapprovalId: preapprovalId } });
  }

  return null;
}

async function processPayment(resourceId: string) {
  const payment = (await getPaymentClient().get({ id: resourceId })) as RawPayment;
  if (!payment.id) return { processed: false, reason: 'payment_without_id' };

  const status = mapPaymentStatus(payment.status);
  const subscription = await findSubscriptionForPayment(payment);
  if (!subscription) return { processed: false, reason: 'subscription_not_found_for_payment' };

  const approvedAt = parseDate(payment.date_approved);
  const periodMonths = subscription.billingInterval === BillingInterval.annual ? 12 : 1;
  const currentPeriodEnd = approvedAt ? addMonths(approvedAt, periodMonths) : null;
  const amountArs = payment.transaction_amount ?? Number(subscription.amountArs);

  await prisma.payment.upsert({
    where: { mpPaymentId: String(payment.id) },
    create: {
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      status,
      amountUsd: subscription.amountUsd,
      amountArs,
      netReceivedAmountArs: payment.transaction_details?.net_received_amount,
      fxRate: subscription.fxRate,
      mpPaymentId: String(payment.id),
      mpPreapprovalId: subscription.mpPreapprovalId ?? payment.preapproval_id,
      mpMerchantOrderId: payment.merchant_order_id ? String(payment.merchant_order_id) : undefined,
      paymentMethodId: payment.payment_method_id,
      paymentTypeId: payment.payment_type_id,
      statusDetail: payment.status_detail,
      payerEmail: payment.payer?.email ?? subscription.payerEmail,
      paidAt: approvedAt,
      rawPayload: toJson(payment),
    },
    update: {
      subscriptionId: subscription.id,
      status,
      amountArs,
      netReceivedAmountArs: payment.transaction_details?.net_received_amount,
      mpPreapprovalId: subscription.mpPreapprovalId ?? payment.preapproval_id,
      mpMerchantOrderId: payment.merchant_order_id ? String(payment.merchant_order_id) : undefined,
      paymentMethodId: payment.payment_method_id,
      paymentTypeId: payment.payment_type_id,
      statusDetail: payment.status_detail,
      payerEmail: payment.payer?.email ?? subscription.payerEmail,
      paidAt: approvedAt,
      rawPayload: toJson(payment),
    },
  });

  if (status === PaymentStatus.approved) {
    await activateSubscription(subscription, currentPeriodEnd);
  }

  return { processed: true };
}

async function processEvent(body: MercadoPagoWebhookBody) {
  const type = eventTypeOf(body).toLowerCase();
  const action = (body.action || '').toLowerCase();
  const resourceId = resourceIdOf(body);
  if (resourceId == null || resourceId === '') return { processed: false, reason: 'missing_resource_id' };

  if (type.includes('preapproval') || action.includes('preapproval')) {
    return processPreApproval(String(resourceId));
  }

  if (type.includes('payment') || action.includes('payment')) {
    return processPayment(String(resourceId));
  }

  return { processed: false, reason: 'ignored_event_type' };
}

const webhooksMercadoPagoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/webhooks/mercadopago',
    {
      config: {
        rawBody: true,
      },
    },
    async (request: FastifyRequest<{ Body: MercadoPagoWebhookBody }>, reply) => {
      const body = request.body ?? {};
      const resourceId = resourceIdOf(body);

      let validSignature = false;
      try {
        validSignature = verifyMercadoPagoWebhookSignature(request, resourceId);
      } catch (error) {
        return reply.code(503).send({ error: error instanceof Error ? error.message : 'Webhook no configurado.' });
      }
      if (!validSignature) return reply.code(401).send({ error: 'Firma Mercado Pago inválida.' });

      const eventId = String(
        body.id ?? `${eventTypeOf(body)}:${body.action ?? 'unknown'}:${resourceId ?? 'unknown'}`
      );

      try {
        await prisma.webhookEvent.create({
          data: {
            provider: 'mercadopago',
            eventId,
            eventType: eventTypeOf(body),
            action: body.action,
            resourceId: resourceId == null ? null : String(resourceId),
            payload: toJson(body),
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') {
          return reply.code(200).send({ ok: true, duplicate: true });
        }
        throw error;
      }

      try {
        const result = await processEvent(body);
        await prisma.webhookEvent.update({
          where: { provider_eventId: { provider: 'mercadopago', eventId } },
          data: { processedAt: new Date() },
        });
        return reply.code(200).send({ ok: true, ...result });
      } catch (error) {
        fastify.log.error({ err: error, body }, 'Mercado Pago webhook processing failed');
        await prisma.webhookEvent.update({
          where: { provider_eventId: { provider: 'mercadopago', eventId } },
          data: {
            errorMessage: error instanceof Error ? error.message : 'Error desconocido',
          },
        });
        return reply.code(500).send({ error: 'No se pudo procesar el webhook.' });
      }
    }
  );
};

export default webhooksMercadoPagoRoutes;
