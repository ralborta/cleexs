import { prisma } from './prisma';
import { classifyEmailClickUrl, extractResendClickLink } from './email-link-attribution';

const TRACKED_EVENT_TYPES = [
  'email.sent',
  'email.delivered',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.complained',
  'email.failed',
  'email.delivery_delayed',
] as const;

export type SendLogForResendMatch = {
  id: string;
  externalId: string | null;
  recipientEmail: string;
  sentAt: Date;
};

export type AppliedResendFlags = {
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  clickedCampaign: boolean;
  clickedOther: boolean;
  bounced: boolean;
  complained: boolean;
  failed: boolean;
  deliveryDelayed: boolean;
  timeline: Array<{ eventType: string; occurredAt: string }>;
  matchedVia: 'email_id' | 'recipient_fallback' | null;
};

export function extractResendWebhookEmailId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: Record<string, unknown> }).data;
  if (!data || typeof data !== 'object') return null;
  for (const key of ['email_id', 'emailId', 'id']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function extractResendWebhookRecipients(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: { to?: unknown } }).data;
  const to = data?.to;
  if (!Array.isArray(to)) return [];
  return to
    .map((v) => {
      if (typeof v !== 'string') return null;
      const trimmed = v.trim();
      const angle = trimmed.match(/<([^>]+@[^>]+)>/);
      const email = (angle?.[1] ?? trimmed).trim().toLowerCase();
      return email.includes('@') ? email : null;
    })
    .filter((v): v is string => Boolean(v));
}

/** Enlaza externalId faltante cruzando eventos Resend por destinatario + ventana temporal. */
async function hydrateExternalIdsFromResendEvents(logs: SendLogForResendMatch[]): Promise<void> {
  const missing = logs.filter((l) => !l.externalId?.trim());
  if (missing.length === 0) return;

  const minSent = missing.reduce((min, l) => (l.sentAt < min ? l.sentAt : min), missing[0]!.sentAt);
  const since = new Date(minSent.getTime() - 2 * 60 * 60 * 1000);

  const events = await prisma.cleexsResendWebhookEvent.findMany({
    where: {
      eventType: { in: ['email.sent', 'email.delivered', 'email.opened'] },
      occurredAt: { gte: since },
      emailId: { not: null },
    },
    select: { emailId: true, recipientEmail: true, occurredAt: true, payload: true },
    orderBy: { occurredAt: 'asc' },
  });

  for (const log of missing) {
    const sentMs = log.sentAt.getTime();
    const windowEnd = sentMs + 48 * 60 * 60 * 1000;
    const email = log.recipientEmail.trim().toLowerCase();

    let best: { emailId: string; at: number } | null = null;
    for (const ev of events) {
      if (!ev.emailId) continue;
      const at = ev.occurredAt?.getTime() ?? 0;
      if (at < sentMs - 60 * 60 * 1000 || at > windowEnd) continue;
      const recipients = ev.recipientEmail
        ? [ev.recipientEmail.trim().toLowerCase()]
        : extractResendWebhookRecipients(ev.payload);
      if (!recipients.includes(email)) continue;
      if (!best || Math.abs(at - sentMs) < Math.abs(best.at - sentMs)) {
        best = { emailId: ev.emailId, at };
      }
    }

    if (!best) continue;

    const linked = await prisma.cleexsInternalEmailSendLog.findFirst({
      where: { externalId: best.emailId },
      select: { id: true },
    });
    if (linked && linked.id !== log.id) continue;

    await prisma.cleexsInternalEmailSendLog.update({
      where: { id: log.id },
      data: { externalId: best.emailId },
    });
    log.externalId = best.emailId;
  }
}

function summarizeEvents(
  events: Array<{ eventType: string; occurredAt: Date | null; payload: unknown }>
): Omit<AppliedResendFlags, 'matchedVia'> {
  const sorted = [...events].sort((a, b) => {
    const ta = a.occurredAt?.getTime() ?? 0;
    const tb = b.occurredAt?.getTime() ?? 0;
    return ta - tb;
  });

  let delivered = false;
  let opened = false;
  let clicked = false;
  let clickedCampaign = false;
  let clickedOther = false;
  let bounced = false;
  let complained = false;
  let failed = false;
  let deliveryDelayed = false;

  for (const ev of sorted) {
    const type = ev.eventType.toLowerCase();
    if (type === 'email.delivered') delivered = true;
    if (type === 'email.opened') opened = true;
    if (type === 'email.sent') {
      /* algunos dominios no emiten delivered; sent confirma handoff a Resend */
    }
    if (type === 'email.clicked') {
      clicked = true;
      const link = extractResendClickLink(ev.payload);
      if (link && classifyEmailClickUrl(link) === 'campaign') clickedCampaign = true;
      else clickedOther = true;
    }
    if (type === 'email.bounced') bounced = true;
    if (type === 'email.complained') complained = true;
    if (type === 'email.failed') failed = true;
    if (type === 'email.delivery_delayed') deliveryDelayed = true;
  }

  // Si Resend no mandó delivered pero sí opened/clicked, inferir entrega.
  if (!delivered && (opened || clicked)) delivered = true;

  return {
    delivered,
    opened,
    clicked,
    clickedCampaign,
    clickedOther,
    bounced,
    complained,
    failed,
    deliveryDelayed,
    timeline: sorted.map((e) => ({
      eventType: e.eventType.replace(/^email\./, ''),
      occurredAt: e.occurredAt?.toISOString() ?? '',
    })),
  };
}

function emptyFlags(): AppliedResendFlags {
  return {
    delivered: false,
    opened: false,
    clicked: false,
    clickedCampaign: false,
    clickedOther: false,
    bounced: false,
    complained: false,
    failed: false,
    deliveryDelayed: false,
    timeline: [],
    matchedVia: null,
  };
}

/**
 * Cruza CleexsInternalEmailSendLog con CleexsResendWebhookEvent.
 * 1) Por externalId (= Resend email_id)
 * 2) Fallback: mismo destinatario y evento dentro de 30 días post-envío
 */
export async function loadAppliedResendFlagsForSendLogs(
  logs: SendLogForResendMatch[]
): Promise<Map<string, AppliedResendFlags>> {
  const result = new Map<string, AppliedResendFlags>();
  if (logs.length === 0) return result;

  const workingLogs = logs.map((l) => ({ ...l }));
  await hydrateExternalIdsFromResendEvents(workingLogs);

  for (const log of workingLogs) {
    result.set(log.id, emptyFlags());
  }

  const externalIds = [...new Set(workingLogs.map((l) => l.externalId).filter(Boolean) as string[])];
  const recipientEmails = [...new Set(workingLogs.map((l) => l.recipientEmail.trim().toLowerCase()).filter(Boolean))];
  const minSentAt = workingLogs.reduce((min, l) => (l.sentAt < min ? l.sentAt : min), workingLogs[0]!.sentAt);
  const since = new Date(minSentAt.getTime() - 24 * 60 * 60 * 1000);

  const orClauses: Array<Record<string, unknown>> = [];
  if (externalIds.length > 0) {
    orClauses.push({ emailId: { in: externalIds } });
  }
  if (recipientEmails.length > 0) {
    orClauses.push({
      recipientEmail: { in: recipientEmails, mode: 'insensitive' },
      eventType: { in: [...TRACKED_EVENT_TYPES] },
      occurredAt: { gte: since },
    });
  }

  if (orClauses.length === 0) return result;

  const eventRows = await prisma.cleexsResendWebhookEvent.findMany({
    where: { OR: orClauses },
    select: {
      emailId: true,
      recipientEmail: true,
      eventType: true,
      occurredAt: true,
      payload: true,
    },
    orderBy: { occurredAt: 'asc' },
  });

  const eventsByEmailId = new Map<string, typeof eventRows>();
  for (const row of eventRows) {
    if (!row.emailId) continue;
    const arr = eventsByEmailId.get(row.emailId) ?? [];
    arr.push(row);
    eventsByEmailId.set(row.emailId, arr);
  }

  const assignedEventKeys = new Set<string>();

  for (const log of workingLogs) {
    if (log.externalId && eventsByEmailId.has(log.externalId)) {
      const flags = summarizeEvents(eventsByEmailId.get(log.externalId)!);
      result.set(log.id, { ...flags, matchedVia: 'email_id' });
      for (const ev of eventsByEmailId.get(log.externalId)!) {
        assignedEventKeys.add(`${ev.eventType}:${ev.occurredAt?.toISOString()}:${ev.emailId}`);
      }
    }
  }

  const logsByRecipient = new Map<string, SendLogForResendMatch[]>();
  for (const log of workingLogs) {
    const email = log.recipientEmail.trim().toLowerCase();
    const arr = logsByRecipient.get(email) ?? [];
    arr.push(log);
    logsByRecipient.set(email, arr);
  }
  for (const arr of logsByRecipient.values()) {
    arr.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  }

  for (const row of eventRows) {
    const key = `${row.eventType}:${row.occurredAt?.toISOString()}:${row.emailId ?? row.recipientEmail}`;
    if (assignedEventKeys.has(key)) continue;

    const recipients = row.recipientEmail
      ? [row.recipientEmail.trim().toLowerCase()]
      : extractResendWebhookRecipients(row.payload);

    const occurredAt = row.occurredAt?.getTime() ?? 0;
    if (!occurredAt) continue;

    for (const recipient of recipients) {
      const candidates = logsByRecipient.get(recipient);
      if (!candidates?.length) continue;

      let best: SendLogForResendMatch | null = null;
      for (const log of candidates) {
        const sentMs = log.sentAt.getTime();
        const windowEnd = sentMs + 30 * 24 * 60 * 60 * 1000;
        if (occurredAt < sentMs - 60 * 60 * 1000 || occurredAt > windowEnd) continue;
        if (!best || log.sentAt > best.sentAt) best = log;
      }
      if (!best) continue;

      const current = result.get(best.id) ?? emptyFlags();
      const mergedEvents = [
        ...current.timeline.map((t) => ({
          eventType: t.eventType.startsWith('email.') ? t.eventType : `email.${t.eventType}`,
          occurredAt: t.occurredAt ? new Date(t.occurredAt) : null,
          payload: null as unknown,
        })),
        {
          eventType: row.eventType,
          occurredAt: row.occurredAt,
          payload: row.payload,
        },
      ];
      const flags = summarizeEvents(mergedEvents);
      result.set(best.id, {
        ...flags,
        matchedVia: current.matchedVia ?? 'recipient_fallback',
      });
      assignedEventKeys.add(key);
      break;
    }
  }

  return result;
}

/** Enlaza email_id de Resend al log interno más reciente sin externalId (mismo destinatario). */
export async function backfillInternalSendLogExternalId(input: {
  emailId: string;
  recipientEmails: string[];
  occurredAt?: Date;
}): Promise<number> {
  const emailId = input.emailId.trim();
  if (!emailId) return 0;

  const existing = await prisma.cleexsInternalEmailSendLog.findFirst({
    where: { externalId: emailId },
    select: { id: true },
  });
  if (existing) return 0;

  const since = new Date((input.occurredAt ?? new Date()).getTime() - 30 * 24 * 60 * 60 * 1000);
  const emails = input.recipientEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) return 0;

  const log = await prisma.cleexsInternalEmailSendLog.findFirst({
    where: {
      recipientEmail: { in: emails, mode: 'insensitive' },
      status: 'sent',
      OR: [{ externalId: null }, { externalId: '' }],
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!log) return 0;

  await prisma.cleexsInternalEmailSendLog.update({
    where: { id: log.id },
    data: { externalId: emailId },
  });
  return 1;
}

export async function countRecentResendWebhookEvents(days = 7): Promise<Record<string, number>> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const grouped = await prisma.cleexsResendWebhookEvent.groupBy({
    by: ['eventType'],
    where: { occurredAt: { gte: since } },
    _count: { _all: true },
  });
  return Object.fromEntries(grouped.map((g) => [g.eventType, g._count._all]));
}
