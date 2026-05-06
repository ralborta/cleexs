import { prisma } from './prisma';

export type ResendWebhookStats =
  | {
      available: true;
      windowDays: number;
      secretConfigured: boolean;
      ingestUrl: string;
      eventsTotalLastWindow: number;
      eventsByTypeLastWindow: Record<string, number>;
      uniqueEmailsByStageLastWindow: {
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounced: number;
        failed: number;
      };
      note: string;
    }
  | {
      available: false;
      reason: string;
    };

export async function buildResendWebhookStats(windowDays: number): Promise<ResendWebhookStats> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  try {
    const [grouped, eventsTotal] = await Promise.all([
      prisma.cleexsResendWebhookEvent.groupBy({
        by: ['eventType'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.cleexsResendWebhookEvent.count({
        where: { createdAt: { gte: since } },
      }),
    ]);

    async function uniqueEmailCount(types: string[]): Promise<number> {
      const rows = await prisma.cleexsResendWebhookEvent.groupBy({
        by: ['emailId'],
        where: {
          createdAt: { gte: since },
          eventType: { in: types },
          emailId: { not: null },
        },
        _count: { _all: true },
      });
      return rows.length;
    }

    const [uniqueSent, uniqueDelivered, uniqueOpened, uniqueClicked, uniqueBounced, uniqueFailed] = await Promise.all([
      uniqueEmailCount(['email.sent']),
      uniqueEmailCount(['email.delivered']),
      uniqueEmailCount(['email.opened']),
      uniqueEmailCount(['email.clicked']),
      uniqueEmailCount(['email.bounced']),
      uniqueEmailCount(['email.failed']),
    ]);

    return {
      available: true,
      windowDays,
      secretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
      ingestUrl: '/api/webhooks/resend',
      eventsTotalLastWindow: eventsTotal,
      eventsByTypeLastWindow: Object.fromEntries(grouped.map((g) => [g.eventType, g._count._all])),
      uniqueEmailsByStageLastWindow: {
        sent: uniqueSent,
        delivered: uniqueDelivered,
        opened: uniqueOpened,
        clicked: uniqueClicked,
        bounced: uniqueBounced,
        failed: uniqueFailed,
      },
      note:
        'Ventana por recepción del webhook en Cleexs (created_at). En Resend: endpoint POST https://TU_API/api/webhooks/resend y variable RESEND_WEBHOOK_SECRET igual al signing secret. Activá tracking en el dominio para opens/clicks.',
    };
  } catch (e) {
    return {
      available: false,
      reason: e instanceof Error ? e.message : 'resend_webhook_stats_failed',
    };
  }
}
