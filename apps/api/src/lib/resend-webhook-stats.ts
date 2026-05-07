import { prisma } from './prisma';

export type ResendWebhookStats =
  | {
      available: true;
      windowDays: number;
      secretConfigured: boolean;
      /** Path relativo */
      ingestUrl: string;
      /** URL completa para pegar en Resend (si la API pudo deducir el dominio público) */
      ingestAbsoluteUrl: string | null;
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

function resolveWebhookIngestAbsolute(): string | null {
  const explicit = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
  const api = process.env.API_URL?.trim();
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const base = explicit || api || (railway ? `https://${railway.replace(/^https?:\/\//, '')}` : '');
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/api/webhooks/resend`;
}

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
      ingestAbsoluteUrl: resolveWebhookIngestAbsolute(),
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
        'Solo cuenta eventos que lleguen por POST verificado (Svix). Sin RESEND_WEBHOOK_SECRET en Railway la API no guarda eventos: métricas quedan en 0. En Resend · Webhooks: misma URL que ingestAbsoluteUrl y el signing secret como variable.',
    };
  } catch (e) {
    return {
      available: false,
      reason: e instanceof Error ? e.message : 'resend_webhook_stats_failed',
    };
  }
}
