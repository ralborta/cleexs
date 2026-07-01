import { CleexsEmailSendStatus } from '@prisma/client';
import { isFreeDiagnosticFollowupCampaignSlug, FREE_DIAGNOSTIC_FOLLOWUP_CAMPAIGN_PREFIX } from './free-diagnostic-followup';
import { loadAppliedResendFlagsForSendLogs } from './resend-internal-email-events';
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

async function resendEventsByEmailIds(
  logs: Array<{ id: string; externalId: string | null; recipientEmail: string; sentAt: Date | string }>
): Promise<Map<string, ResendEventSummary>> {
  const normalized = logs.map((l) => ({
    id: l.id,
    externalId: l.externalId,
    recipientEmail: l.recipientEmail,
    sentAt: l.sentAt instanceof Date ? l.sentAt : new Date(l.sentAt),
  }));
  const flagsMap = await loadAppliedResendFlagsForSendLogs(normalized);
  const out = new Map<string, ResendEventSummary>();
  for (const log of normalized) {
    const flags = flagsMap.get(log.id);
    if (!flags || flags.timeline.length === 0) continue;
    const last = flags.timeline[flags.timeline.length - 1];
    out.set(log.id, {
      lastEvent: last?.eventType ?? null,
      lastEventAt: last?.occurredAt ?? null,
      delivered: flags.delivered,
      opened: flags.opened,
      clicked: flags.clicked,
      bounced: flags.bounced,
      complained: flags.complained,
      failed: flags.failed,
      deliveryDelayed: flags.deliveryDelayed,
      timeline: flags.timeline,
    });
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
    if (row.externalId) withExternalId += 1;
    if (!row.resend) {
      if (row.externalId) noEventsYet += 1;
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

/** Envíos transaccionales (free score / link diagnóstico) no son campañas batch. */
export function isExcludedFromEmailBatchMonitor(campaignSlug: string): boolean {
  return isFreeDiagnosticFollowupCampaignSlug(campaignSlug);
}

function batchMonitorWhere() {
  return {
    NOT: { campaignSlug: { startsWith: FREE_DIAGNOSTIC_FOLLOWUP_CAMPAIGN_PREFIX } },
  };
}

export async function listEmailBatches(limit = 30): Promise<EmailBatchListItem[]> {
  const capped = Math.min(60, Math.max(5, limit));
  const grouped = await prisma.cleexsInternalEmailSendLog.groupBy({
    by: ['campaignSlug'],
    where: batchMonitorWhere(),
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

  const sendLogsForResend =
    slugs.length > 0
      ? await prisma.cleexsInternalEmailSendLog.findMany({
          where: { campaignSlug: { in: slugs }, status: CleexsEmailSendStatus.sent },
          select: {
            id: true,
            campaignSlug: true,
            externalId: true,
            recipientEmail: true,
            createdAt: true,
          },
        })
      : [];

  const resendMap = await resendEventsByEmailIds(
    sendLogsForResend.map((l) => ({
      id: l.id,
      externalId: l.externalId,
      recipientEmail: l.recipientEmail,
      sentAt: l.createdAt,
    }))
  );

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

    const slugLogs = sendLogsForResend.filter((l) => l.campaignSlug === slug);
    const recipientRows: EmailBatchRecipientRow[] = slugLogs.map((l) => ({
      id: l.id,
      recipientEmail: l.recipientEmail,
      cleexsStatus: CleexsEmailSendStatus.sent,
      cleexsScore: null,
      externalId: l.externalId,
      errorMessage: null,
      sentAt: l.createdAt.toISOString(),
      mergeSummary: null,
      resend: resendMap.get(l.id) ?? null,
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
  if (isExcludedFromEmailBatchMonitor(slug)) {
    return {
      batch: {
        campaignSlug: slug,
        firstSendAt: null,
        lastSendAt: null,
        totals: { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0 },
        resend: {
          withExternalId: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          complained: 0,
          failed: 0,
          noEventsYet: 0,
        },
        mode: 'free_diagnostic_followup',
        variant: null,
      },
      recipients: [],
    };
  }

  const logs = await prisma.cleexsInternalEmailSendLog.findMany({
    where: { campaignSlug: slug },
    orderBy: { createdAt: 'desc' },
  });

  const resendMap = await resendEventsByEmailIds(
    logs.map((log) => ({
      id: log.id,
      externalId: log.externalId,
      recipientEmail: log.recipientEmail,
      sentAt: log.createdAt,
    }))
  );

  const recipients: EmailBatchRecipientRow[] = logs.map((log) => ({
    id: log.id,
    recipientEmail: log.recipientEmail,
    cleexsStatus: log.status,
    cleexsScore: log.cleexsScore,
    externalId: log.externalId,
    errorMessage: log.errorMessage,
    sentAt: log.createdAt.toISOString(),
    mergeSummary: asRecord(log.mergeSummary),
    resend: resendMap.get(log.id) ?? null,
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
