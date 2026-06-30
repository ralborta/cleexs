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

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, '');
}

/** Resend ejecuta webhooks desde internet; no mostrar localhost como URL “oficial”. */
function looksLikeLoopbackBase(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `http://${s}`;
    const hostname = new URL(withProto).hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    return s.includes('localhost') || s.includes('127.0.0.1');
  }
}

function resolveWebhookIngestAbsolute(): string | null {
  const explicit = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
  const railwayDom = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const railwayStatic = process.env.RAILWAY_STATIC_URL?.trim(); // algunos proyectos exponen esta URL pública
  const apiUrl = process.env.API_URL?.trim();

  const candidates: string[] = [];
  if (explicit) candidates.push(explicit);
  if (railwayDom) candidates.push(stripTrailingSlash(`https://${railwayDom.replace(/^https?:\/\//, '')}`));
  if (railwayStatic) candidates.push(stripTrailingSlash(railwayStatic));
  if (apiUrl) candidates.push(stripTrailingSlash(apiUrl));

  for (const c of candidates) {
    const base = stripTrailingSlash(c);
    if (!base || looksLikeLoopbackBase(base)) continue;
    return `${base}/api/webhooks/resend`;
  }

  return null;
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
