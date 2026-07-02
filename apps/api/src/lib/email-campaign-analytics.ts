import { CleexsEmailSendStatus } from '@prisma/client';
import {
  CONFIGURED_CAMPAIGN_SCOPE_NOTE,
  isAdHocEmailTestBatch,
  isEmailBatchAnalyticsSlug,
} from './email-configured-campaigns';
import {
  emptyEmailClickBreakdown,
  hasAnyEmailClick,
  inferVariantFromMergeSummary,
  isEmailUtmPurchase,
  type EmailClickBreakdown,
  type EmailClickRole,
} from './email-link-attribution';
import {
  countRecentResendWebhookEvents,
  loadAppliedResendFlagsForSendLogs,
} from './resend-internal-email-events';
import { prisma } from './prisma';

export type EmailAnalyticsFunnelStep = {
  count: number;
  pct: number | null;
  pctHint?: string;
};

export type EmailClickBreakdownCounts = Record<EmailClickRole, number>;

export type EmailCampaignAnalyticsRow = {
  campaignSlug: string;
  variant: string | null;
  label: string;
  kind: 'scheduled' | 'test';
  sent: number;
  opened: number;
  clicksTotal: number;
  clicksBreakdown: EmailClickBreakdownCounts;
  purchased: number;
  /** Solo referencia técnica; no es paso principal del embudo comercial. */
  delivered: number;
};

export type EmailAnalyticsRecipientRow = {
  id: string;
  recipientEmail: string;
  campaignSlug: string;
  variant: string | null;
  cleexsScore: number | null;
  sentAt: string;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  clicksBreakdown: EmailClickBreakdown;
  purchased: boolean;
  purchaseTemplate: string | null;
};

export type EmailCampaignAnalyticsReport = {
  ok: true;
  range: { from: string; to: string; timezone: string };
  funnel: {
    sent: EmailAnalyticsFunnelStep;
    opened: EmailAnalyticsFunnelStep;
    clicks: EmailAnalyticsFunnelStep & { breakdown: Record<EmailClickRole, EmailAnalyticsFunnelStep> };
    purchased: EmailAnalyticsFunnelStep;
    delivered: EmailAnalyticsFunnelStep;
  };
  byCampaign: EmailCampaignAnalyticsRow[];
  integrations: {
    resendWebhookSecretConfigured: boolean;
    note: string;
    scope: string;
    resendEventsLast7Days: Record<string, number>;
  };
};

type RecipientState = {
  id: string;
  recipientEmail: string;
  campaignSlug: string;
  variant: string | null;
  cleexsScore: number | null;
  sentAt: Date;
  externalId: string | null;
  status: CleexsEmailSendStatus;
  delivered: boolean;
  opened: boolean;
  clickBreakdown: EmailClickBreakdown;
  purchased: boolean;
  purchaseTemplate: string | null;
};

const CLICK_ROLES: EmailClickRole[] = ['plans', 'diagnostic', 'report', 'share', 'other'];

function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

function emptyClickCounts(): EmailClickBreakdownCounts {
  return { plans: 0, diagnostic: 0, report: 0, share: 0, other: 0 };
}

function funnelStep(count: number, den: number, pctHint: string): EmailAnalyticsFunnelStep {
  return { count, pct: pct(count, den), pctHint };
}

function campaignLabel(slug: string, variant: string | null): string {
  if (slug.startsWith('weekly-auto-w')) {
    const slot = slug.match(/weekly-auto-w(\d)/i)?.[1];
    return slot ? `Semanal · campaña ${slot}` : 'Semanal programada';
  }
  if (slug.startsWith('monthly-score')) return variant ? `Mensual · ${variant}` : 'Mensual score';
  if (slug.startsWith('broadcast-')) return 'Broadcast manual';
  if (isAdHocEmailTestBatch(slug)) return variant ? `Prueba · ${variant}` : `Prueba · ${slug}`;
  return variant ? `${slug} · ${variant}` : slug;
}

async function loadRecipientStates(from: Date, to: Date): Promise<RecipientState[]> {
  const logs = await prisma.cleexsInternalEmailSendLog.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      NOT: { status: CleexsEmailSendStatus.skipped },
    },
    orderBy: { createdAt: 'desc' },
  });

  const marketingLogs = logs.filter((l) => isEmailBatchAnalyticsSlug(l.campaignSlug));
  const states: RecipientState[] = marketingLogs.map((log) => ({
    id: log.id,
    recipientEmail: log.recipientEmail.trim().toLowerCase(),
    campaignSlug: log.campaignSlug,
    variant: inferVariantFromMergeSummary(log.mergeSummary),
    cleexsScore: log.cleexsScore,
    sentAt: log.createdAt,
    externalId: log.externalId,
    status: log.status,
    delivered: false,
    opened: false,
    clickBreakdown: emptyEmailClickBreakdown(),
    purchased: false,
    purchaseTemplate: null,
  }));

  const byEmail = new Map<string, RecipientState[]>();
  for (const row of states) {
    const list = byEmail.get(row.recipientEmail) ?? [];
    list.push(row);
    byEmail.set(row.recipientEmail, list);
  }

  const resendFlags = await loadAppliedResendFlagsForSendLogs(
    states.map((row) => ({
      id: row.id,
      externalId: row.externalId,
      recipientEmail: row.recipientEmail,
      sentAt: row.sentAt,
    }))
  );

  for (const row of states) {
    const flags = resendFlags.get(row.id);
    if (!flags) continue;
    row.delivered = flags.delivered;
    row.opened = flags.opened;
    row.clickBreakdown = flags.clickBreakdown;
  }

  const recipientEmails = [...byEmail.keys()];
  if (recipientEmails.length > 0) {
    const purchases = await prisma.subscription.findMany({
      where: {
        status: 'authorized',
        createdAt: { gte: from, lte: to },
        OR: [
          { payerEmail: { in: recipientEmails, mode: 'insensitive' } },
          { utmSource: { equals: 'email', mode: 'insensitive' } },
          { utmMedium: { contains: 'email', mode: 'insensitive' } },
          { utmMedium: { contains: 'monthly_score', mode: 'insensitive' } },
          { utmMedium: { contains: 'weekly', mode: 'insensitive' } },
        ],
      },
      select: {
        payerEmail: true,
        utmCampaign: true,
        utmSource: true,
        utmMedium: true,
        refCode: true,
      },
    });

    for (const purchase of purchases) {
      const email = purchase.payerEmail?.trim().toLowerCase();
      if (!email) continue;
      const rows = byEmail.get(email);
      if (!rows?.length && !isEmailUtmPurchase(purchase)) continue;

      const utmCampaign = (purchase.utmCampaign || '').trim();
      let target =
        (utmCampaign && rows?.find((r) => r.campaignSlug === utmCampaign)) ??
        rows?.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];

      if (!target && isEmailUtmPurchase(purchase) && utmCampaign) {
        target = states.find((r) => r.campaignSlug === utmCampaign);
      }

      if (!target) continue;
      target.purchased = true;
      target.purchaseTemplate = target.variant || (purchase.utmCampaign || '').trim() || null;
    }
  }

  return states;
}

function countClickBreakdown(states: RecipientState[]): EmailClickBreakdownCounts {
  const counts = emptyClickCounts();
  for (const row of states) {
    for (const role of CLICK_ROLES) {
      if (row.clickBreakdown[role]) counts[role] += 1;
    }
  }
  return counts;
}

export async function buildEmailCampaignAnalytics(input: {
  from: Date;
  to: Date;
  fromDay: string;
  toDay: string;
}): Promise<EmailCampaignAnalyticsReport> {
  const states = await loadRecipientStates(input.from, input.to);
  const sentCount = states.filter((r) => r.status === CleexsEmailSendStatus.sent).length;
  const deliveredCount = states.filter((r) => r.delivered).length;
  const openedCount = states.filter((r) => r.opened).length;
  const clicksTotal = states.filter((r) => hasAnyEmailClick(r.clickBreakdown)).length;
  const clickCounts = countClickBreakdown(states);
  const purchasedCount = states.filter((r) => r.purchased).length;

  const campaignMap = new Map<string, EmailCampaignAnalyticsRow>();
  for (const row of states) {
    const key = `${row.campaignSlug}::${row.variant || ''}`;
    const current =
      campaignMap.get(key) ??
      ({
        campaignSlug: row.campaignSlug,
        variant: row.variant,
        label: campaignLabel(row.campaignSlug, row.variant),
        kind: isAdHocEmailTestBatch(row.campaignSlug) ? 'test' : 'scheduled',
        sent: 0,
        delivered: 0,
        opened: 0,
        clicksTotal: 0,
        clicksBreakdown: emptyClickCounts(),
        purchased: 0,
      } satisfies EmailCampaignAnalyticsRow);
    if (row.status === CleexsEmailSendStatus.sent) current.sent += 1;
    if (row.delivered) current.delivered += 1;
    if (row.opened) current.opened += 1;
    if (hasAnyEmailClick(row.clickBreakdown)) current.clicksTotal += 1;
    for (const role of CLICK_ROLES) {
      if (row.clickBreakdown[role]) current.clicksBreakdown[role] += 1;
    }
    if (row.purchased) current.purchased += 1;
    campaignMap.set(key, current);
  }

  const byCampaign = Array.from(campaignMap.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'test' ? -1 : 1;
    return b.sent - a.sent;
  });
  const resendEventsLast7Days = await countRecentResendWebhookEvents(7);

  const clickBreakdownFunnel = CLICK_ROLES.reduce(
    (acc, role) => {
      acc[role] = funnelStep(clickCounts[role], openedCount || sentCount, 'de abiertos');
      return acc;
    },
    {} as Record<EmailClickRole, EmailAnalyticsFunnelStep>
  );

  return {
    ok: true,
    range: { from: input.fromDay, to: input.toDay, timezone: 'America/Argentina/Buenos_Aires' },
    funnel: {
      sent: { count: sentCount, pct: null },
      opened: funnelStep(openedCount, sentCount, 'de enviados'),
      clicks: {
        count: clicksTotal,
        pct: pct(clicksTotal, openedCount || sentCount),
        pctHint: 'de abiertos',
        breakdown: clickBreakdownFunnel,
      },
      purchased: funnelStep(purchasedCount, clicksTotal || openedCount || sentCount, 'de clics'),
      delivered: funnelStep(deliveredCount, sentCount, 'de enviados'),
    },
    byCampaign,
    integrations: {
      resendWebhookSecretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
      note:
        'Los links llevan utm_content (planes, diagnóstico, reporte, compartir). Sin webhook Resend los clics y aperturas quedan en 0.',
      scope: CONFIGURED_CAMPAIGN_SCOPE_NOTE,
      resendEventsLast7Days,
    },
  };
}

export type EmailAnalyticsDetailFilter =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'clicked_plans'
  | 'clicked_diagnostic'
  | 'clicked_report'
  | 'clicked_share'
  | 'clicked_other'
  | 'purchased';

function recipientMatchesClickFilter(row: RecipientState, filter: EmailAnalyticsDetailFilter): boolean {
  if (filter === 'clicked') return hasAnyEmailClick(row.clickBreakdown);
  if (filter === 'clicked_plans') return row.clickBreakdown.plans;
  if (filter === 'clicked_diagnostic') return row.clickBreakdown.diagnostic;
  if (filter === 'clicked_report') return row.clickBreakdown.report;
  if (filter === 'clicked_share') return row.clickBreakdown.share;
  if (filter === 'clicked_other') return row.clickBreakdown.other;
  return false;
}

export async function listEmailCampaignAnalyticsRecipients(input: {
  from: Date;
  to: Date;
  filter: EmailAnalyticsDetailFilter;
}): Promise<EmailAnalyticsRecipientRow[]> {
  const states = await loadRecipientStates(input.from, input.to);

  const filtered = states.filter((row) => {
    if (input.filter === 'sent') return row.status === CleexsEmailSendStatus.sent;
    if (input.filter === 'delivered') return row.delivered;
    if (input.filter === 'opened') return row.opened;
    if (input.filter === 'purchased') return row.purchased;
    if (input.filter.startsWith('clicked')) return recipientMatchesClickFilter(row, input.filter);
    return true;
  });

  return filtered.map((row) => ({
    id: row.id,
    recipientEmail: row.recipientEmail,
    campaignSlug: row.campaignSlug,
    variant: row.variant,
    cleexsScore: row.cleexsScore,
    sentAt: row.sentAt.toISOString(),
    delivered: row.delivered,
    opened: row.opened,
    clicked: hasAnyEmailClick(row.clickBreakdown),
    clicksBreakdown: row.clickBreakdown,
    purchased: row.purchased,
    purchaseTemplate: row.purchaseTemplate,
  }));
}
