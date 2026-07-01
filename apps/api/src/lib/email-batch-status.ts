import { CleexsEmailSendStatus } from '@prisma/client';
import { prisma } from './prisma';

const RESEND_EVENT_ORDER = [
  'email.sent',
  'email.scheduled',
  'email.delivery_delayed',
  'email.delivered',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.complained',
  'email.failed',
  'email.suppressed',
] as const;

export type ResendEventSummary = {
  lastEvent: string | null;
  lastEventAt: string | null;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  complained: boolean;
  failed: boolean;
  deliveryDelayed: boolean;
  timeline: Array<{ eventType: string; occurredAt: string }>;
};

export type EmailBatchRecipientRow = {
  id: string;
  recipientEmail: string;
  cleexsStatus: CleexsEmailSendStatus;
  cleexsScore: number | null;
  externalId: string | null;
  errorMessage: string | null;
  sentAt: string;
  mergeSummary: Record<string, unknown> | null;
  resend: ResendEventSummary | null;
};

export type EmailBatchSummary = {
  campaignSlug: string;
  firstSendAt: string | null;
  lastSendAt: string | null;
  totals: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
  };
  resend: {
    withExternalId: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    failed: number;
    noEventsYet: number;
  };
};

export type EmailBatchListItem = EmailBatchSummary & {
  mode: string | null;
  variant: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function summarizeResendEvents(
  events: Array<{ eventType: string; occurredAt: Date | null }>
): ResendEventSummary | null {
  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => {
    const ta = a.occurredAt?.getTime() ?? 0;
    const tb = b.occurredAt?.getTime() ?? 0;
    if (ta !== tb) return ta - tb;
    const ia = RESEND_EVENT_ORDER.indexOf(a.eventType as (typeof RESEND_EVENT_ORDER)[number]);
    const ib = RESEND_EVENT_ORDER.indexOf(b.eventType as (typeof RESEND_EVENT_ORDER)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const types = new Set(sorted.map((e) => e.eventType));
  const last = sorted[sorted.length - 1];

  return {
    lastEvent: last.eventType.replace(/^email\./, ''),
    lastEventAt: last.occurredAt?.toISOString() ?? null,
    delivered: types.has('email.delivered'),
    opened: types.has('email.opened'),
    clicked: types.has('email.clicked'),
    bounced: types.has('email.bounced'),
    complained: types.has('email.complained'),
    failed: types.has('email.failed'),
    deliveryDelayed: types.has('email.delivery_delayed'),
    timeline: sorted.map((e) => ({
      eventType: e.eventType.replace(/^email\./, ''),
      occurredAt: e.occurredAt?.toISOString() ?? '',
    })),
  };
}

async function resendEventsByEmailIds(emailIds: string[]) {
  const unique = [...new Set(emailIds.filter(Boolean))];
  if (unique.length === 0) return new Map<string, ResendEventSummary>();

  const rows = await prisma.cleexsResendWebhookEvent.findMany({
    where: { emailId: { in: unique } },
    select: { emailId: true, eventType: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
  });

  const grouped = new Map<string, Array<{ eventType: string; occurredAt: Date | null }>>();
  for (const row of rows) {
    if (!row.emailId) continue;
    const arr = grouped.get(row.emailId) ?? [];
    arr.push({ eventType: row.eventType, occurredAt: row.occurredAt });
    grouped.set(row.emailId, arr);
  }

  const out = new Map<string, ResendEventSummary>();
  for (const id of unique) {
    const summary = summarizeResendEvents(grouped.get(id) ?? []);
    if (summary) out.set(id, summary);
  }
  return out;
}

function aggregateResendCounts(
  rows: EmailBatchRecipientRow[]
): EmailBatchSummary['resend'] {
  let withExternalId = 0;
  let delivered = 0;
  let opened = 0;
  let clicked = 0;
  let bounced = 0;
  let complained = 0;
  let failed = 0;
  let noEventsYet = 0;

  for (const row of rows) {
    if (!row.externalId) continue;
    withExternalId += 1;
    if (!row.resend) {
      noEventsYet += 1;
      continue;
    }
    if (row.resend.delivered) delivered += 1;
    if (row.resend.opened) opened += 1;
    if (row.resend.clicked) clicked += 1;
    if (row.resend.bounced) bounced += 1;
    if (row.resend.complained) complained += 1;
    if (row.resend.failed) failed += 1;
  }

  return {
    withExternalId,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    failed,
    noEventsYet,
  };
}

function totalsFromStatuses(statuses: CleexsEmailSendStatus[]) {
  const totals = { total: statuses.length, sent: 0, failed: 0, skipped: 0, pending: 0 };
  for (const s of statuses) {
    if (s === CleexsEmailSendStatus.sent) totals.sent += 1;
    else if (s === CleexsEmailSendStatus.failed) totals.failed += 1;
    else if (s === CleexsEmailSendStatus.skipped) totals.skipped += 1;
    else if (s === CleexsEmailSendStatus.pending) totals.pending += 1;
  }
  return totals;
}

function inferBatchMeta(logs: Array<{ mergeSummary: unknown }>): { mode: string | null; variant: string | null } {
  for (const log of logs) {
    const meta = asRecord(log.mergeSummary);
    if (!meta) continue;
    const mode = typeof meta.mode === 'string' ? meta.mode : null;
    const variant = typeof meta.variant === 'string' ? meta.variant : null;
    if (mode || variant) return { mode, variant };
  }
  return { mode: null, variant: null };
}

export async function listEmailBatches(limit = 30): Promise<EmailBatchListItem[]> {
  const capped = Math.min(60, Math.max(5, limit));
  const grouped = await prisma.cleexsInternalEmailSendLog.groupBy({
    by: ['campaignSlug'],
    _count: { _all: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: capped,
  });

  const slugs = grouped.map((g) => g.campaignSlug);
  const statusRows =
    slugs.length > 0
      ? await prisma.cleexsInternalEmailSendLog.groupBy({
          by: ['campaignSlug', 'status'],
          where: { campaignSlug: { in: slugs } },
          _count: { _all: true },
        })
      : [];

  const metaLogs =
    slugs.length > 0
      ? await prisma.cleexsInternalEmailSendLog.findMany({
          where: { campaignSlug: { in: slugs } },
          select: { campaignSlug: true, mergeSummary: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

  const metaBySlug = new Map<string, { campaignSlug: string; mergeSummary: unknown }>();
  for (const row of metaLogs) {
    if (!metaBySlug.has(row.campaignSlug)) metaBySlug.set(row.campaignSlug, row);
  }

  const externalIdLogs =
    slugs.length > 0
      ? await prisma.cleexsInternalEmailSendLog.findMany({
          where: { campaignSlug: { in: slugs }, externalId: { not: null } },
          select: { campaignSlug: true, externalId: true },
        })
      : [];

  const externalIds = externalIdLogs
    .map((l) => l.externalId)
    .filter((id): id is string => Boolean(id));
  const resendMap = await resendEventsByEmailIds(externalIds);

  return grouped.map((g) => {
    const slug = g.campaignSlug;
    const statuses = statusRows.filter((r) => r.campaignSlug === slug);
    const totals = { total: g._count._all, sent: 0, failed: 0, skipped: 0, pending: 0 };
    for (const row of statuses) {
      const n = row._count._all;
      if (row.status === CleexsEmailSendStatus.sent) totals.sent = n;
      else if (row.status === CleexsEmailSendStatus.failed) totals.failed = n;
      else if (row.status === CleexsEmailSendStatus.skipped) totals.skipped = n;
      else if (row.status === CleexsEmailSendStatus.pending) totals.pending = n;
    }

    const metaLog = metaBySlug.get(slug);
    const { mode, variant } = inferBatchMeta(metaLog ? [metaLog] : []);

    const recipientRows: EmailBatchRecipientRow[] = externalIdLogs
      .filter((l) => l.campaignSlug === slug)
      .map((l, idx) => ({
        id: `summary-${slug}-${idx}`,
        recipientEmail: '',
        cleexsStatus: CleexsEmailSendStatus.sent,
        cleexsScore: null,
        externalId: l.externalId,
        errorMessage: null,
        sentAt: '',
        mergeSummary: null,
        resend: l.externalId ? resendMap.get(l.externalId) ?? null : null,
      }));

    return {
      campaignSlug: slug,
      firstSendAt: g._min.createdAt?.toISOString() ?? null,
      lastSendAt: g._max.createdAt?.toISOString() ?? null,
      totals,
      resend: aggregateResendCounts(recipientRows),
      mode,
      variant,
    };
  });
}

export async function getEmailBatchDetail(campaignSlug: string): Promise<{
  batch: EmailBatchSummary & { mode: string | null; variant: string | null };
  recipients: EmailBatchRecipientRow[];
}> {
  const slug = campaignSlug.trim();
  const logs = await prisma.cleexsInternalEmailSendLog.findMany({
    where: { campaignSlug: slug },
    orderBy: { createdAt: 'desc' },
  });

  const externalIds = logs.map((l) => l.externalId).filter((id): id is string => Boolean(id));
  const resendMap = await resendEventsByEmailIds(externalIds);

  const recipients: EmailBatchRecipientRow[] = logs.map((log) => ({
    id: log.id,
    recipientEmail: log.recipientEmail,
    cleexsStatus: log.status,
    cleexsScore: log.cleexsScore,
    externalId: log.externalId,
    errorMessage: log.errorMessage,
    sentAt: log.createdAt.toISOString(),
    mergeSummary: asRecord(log.mergeSummary),
    resend: log.externalId ? resendMap.get(log.externalId) ?? null : null,
  }));

  const statuses = logs.map((l) => l.status);
  const { mode, variant } = inferBatchMeta(logs);

  const batch: EmailBatchSummary & { mode: string | null; variant: string | null } = {
    campaignSlug: slug,
    firstSendAt: logs.length ? logs[logs.length - 1]!.createdAt.toISOString() : null,
    lastSendAt: logs.length ? logs[0]!.createdAt.toISOString() : null,
    totals: totalsFromStatuses(statuses),
    resend: aggregateResendCounts(recipients),
    mode,
    variant,
  };

  return { batch, recipients };
}
