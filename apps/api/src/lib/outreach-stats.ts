import { prisma } from './prisma';

type ResendStageCounts = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
};

export type OutreachStats = {
  windowDays: number;
  asOf: string;
  totals: {
    contacts: number;
    drafts: number;
    queued: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    failed: number;
    deliveryDelayed: number;
  };
  byMode: { shadow: number; real: number; unknown: number };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  todayRealSent: number;
  dailyLimit: number;
  domainVerified: boolean;
  resendWebhook: {
    secretConfigured: boolean;
    eventsTotalLastWindow: number;
    eventsByTypeLastWindow: Record<string, number>;
    uniqueEmailsByStageLastWindow: ResendStageCounts;
    matchedToOutreach: number;
  };
};

function safeMeta(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
}

export async function buildOutreachStats(windowDays: number): Promise<OutreachStats> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [grouped, contactsCount, todayRealSent, recentEmails] = await Promise.all([
    prisma.leadEmail.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.leadContact.count(),
    prisma.leadEmail.count({
      where: { status: { in: ['sent', 'delivered'] }, sentAt: { gte: startOfDay } },
    }),
    prisma.leadEmail.findMany({
      where: { provider: 'resend', createdAt: { gte: since } },
      select: { metaJson: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of grouped) byStatus[row.status] = row._count._all;

  const drafts = byStatus.draft || 0;
  const queued = byStatus.queued || 0;
  const sent = byStatus.sent || 0;
  const delivered = byStatus.delivered || 0;
  const opened = byStatus.opened || 0;
  const clicked = byStatus.clicked || 0;
  const bounced = byStatus.bounced || 0;
  const complained = byStatus.complained || 0;
  const failed = byStatus.failed || 0;
  const deliveryDelayed = byStatus.delivery_delayed || 0;

  const byMode = { shadow: 0, real: 0, unknown: 0 };
  const outreachExternalIds = new Set<string>();
  for (const row of recentEmails) {
    const meta = safeMeta(row.metaJson);
    const mode = typeof meta.mode === 'string' ? meta.mode : undefined;
    if (mode === 'shadow') byMode.shadow += 1;
    else if (mode === 'real') byMode.real += 1;
    else byMode.unknown += 1;
    const ext = meta.externalId;
    if (typeof ext === 'string' && ext.length > 0) outreachExternalIds.add(ext);
  }

  const totalRealOrShadow = sent + delivered + opened + clicked + bounced + complained + failed;
  const sentLike = sent + delivered + opened + clicked;
  const safe = (numerator: number, denominator: number): number =>
    denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

  const rates = {
    deliveryRate: safe(delivered + opened + clicked, sentLike + bounced + failed),
    openRate: safe(opened + clicked, delivered + opened + clicked),
    clickRate: safe(clicked, delivered + opened + clicked),
    bounceRate: safe(bounced, totalRealOrShadow),
  };

  let eventsTotalLastWindow = 0;
  const eventsByTypeLastWindow: Record<string, number> = {};
  const uniqueEmailsByStageLastWindow: ResendStageCounts = {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
  };
  let matchedToOutreach = 0;

  if (outreachExternalIds.size > 0) {
    try {
      const ids = Array.from(outreachExternalIds);
      const events = await prisma.cleexsResendWebhookEvent.findMany({
        where: { createdAt: { gte: since }, emailId: { in: ids } },
        select: { eventType: true, emailId: true },
      });
      matchedToOutreach = events.length;
      const uniques: Record<keyof ResendStageCounts, Set<string>> = {
        sent: new Set(),
        delivered: new Set(),
        opened: new Set(),
        clicked: new Set(),
        bounced: new Set(),
        complained: new Set(),
        failed: new Set(),
      };
      for (const event of events) {
        eventsTotalLastWindow += 1;
        eventsByTypeLastWindow[event.eventType] = (eventsByTypeLastWindow[event.eventType] || 0) + 1;
        const id = event.emailId || '';
        if (!id) continue;
        const stage = mapEventTypeToStage(event.eventType);
        if (stage) uniques[stage].add(id);
      }
      for (const key of Object.keys(uniques) as Array<keyof ResendStageCounts>) {
        uniqueEmailsByStageLastWindow[key] = uniques[key].size;
      }
    } catch {
      // tabla puede no existir todavía si la migración no corrió
    }
  }

  return {
    windowDays,
    asOf: new Date().toISOString(),
    totals: {
      contacts: contactsCount,
      drafts,
      queued,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      failed,
      deliveryDelayed,
    },
    byMode,
    rates,
    todayRealSent,
    dailyLimit: Number(process.env.OUTREACH_DAILY_LIMIT || 20),
    domainVerified: process.env.OUTREACH_DOMAIN_VERIFIED === 'true',
    resendWebhook: {
      secretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
      eventsTotalLastWindow,
      eventsByTypeLastWindow,
      uniqueEmailsByStageLastWindow,
      matchedToOutreach,
    },
  };
}

function mapEventTypeToStage(eventType: string): keyof ResendStageCounts | null {
  switch (eventType) {
    case 'email.sent':
      return 'sent';
    case 'email.delivered':
      return 'delivered';
    case 'email.opened':
      return 'opened';
    case 'email.clicked':
      return 'clicked';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    case 'email.failed':
    case 'email.delivery_delayed':
      return 'failed';
    default:
      return null;
  }
}

export type OutreachEmailRow = {
  id: string;
  createdAt: string;
  sentAt: string | null;
  updatedAt: string;
  status: string;
  provider: string | null;
  subject: string;
  mode: 'shadow' | 'real' | null;
  effectiveTo: string | null;
  originalTo: string | null;
  externalId: string | null;
  lastResendEvent: string | null;
  competitor: string;
  competitorDomain: string | null;
  contactEmail: string;
};

export async function listOutreachEmails(args: {
  limit: number;
  windowDays: number;
  status?: string | null;
  mode?: 'shadow' | 'real' | null;
}): Promise<OutreachEmailRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - args.windowDays);

  const rows = await prisma.leadEmail.findMany({
    where: {
      createdAt: { gte: since },
      ...(args.status ? { status: args.status } : {}),
    },
    include: {
      leadContact: { select: { email: true } },
      leadSource: { select: { competitorName: true, competitorDomain: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: Math.min(Math.max(args.limit, 1), 500),
  });

  const mapped: OutreachEmailRow[] = rows.map((row) => {
    const meta = safeMeta(row.metaJson);
    const mode = typeof meta.mode === 'string' && (meta.mode === 'shadow' || meta.mode === 'real') ? meta.mode : null;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      sentAt: row.sentAt ? row.sentAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
      status: row.status,
      provider: row.provider,
      subject: row.subject,
      mode,
      effectiveTo: typeof meta.effectiveTo === 'string' ? meta.effectiveTo : null,
      originalTo: typeof meta.originalTo === 'string' ? meta.originalTo : null,
      externalId: typeof meta.externalId === 'string' ? meta.externalId : null,
      lastResendEvent: typeof meta.lastResendEvent === 'string' ? meta.lastResendEvent : null,
      competitor: row.leadSource.competitorName,
      competitorDomain: row.leadSource.competitorDomain,
      contactEmail: row.leadContact.email,
    };
  });

  if (args.mode) return mapped.filter((row) => row.mode === args.mode);
  return mapped;
}
