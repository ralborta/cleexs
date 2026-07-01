import { CleexsEmailSendStatus, type CleexsEmailTemplateVariant } from '@prisma/client';
import { Resend } from 'resend';
import { getAppBaseUrlForPublicLinks } from './app-public-url';
import { withEmailAttribution } from './email-link-attribution';
import {
  buildCleexsEmail,
  buildMonthlyScoreDiagnosticUrl,
  buildMonthlyScorePlansUrl,
} from './monthly-score-email';
import type { CleexsEmailCompetitor } from './email-templates/shared';
import {
  buildTransactionalFromAddress,
  isEmailConfigured,
  isEmailDisabled,
  isOutboundEmailAvailable,
  sendSmtpMail,
} from './email';
import {
  resolveMarketingRecipients,
  type EmailAudienceSegment,
  type MarketingEmailRecipient,
} from './marketing-email';
import { prisma } from './prisma';

const WA_PLACEHOLDER_EMAIL_DOMAIN = '@whatsapp.cleexs.net';

function formatResendError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function monthlyScoreCampaignSlug(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `monthly-score-${y}-${m}`;
}

function monthlySendDayUtc(): number {
  const parsed = Number(process.env.MONTHLY_SCORE_EMAIL_DAY_UTC ?? 1);
  return Number.isFinite(parsed) ? Math.min(28, Math.max(1, Math.floor(parsed))) : 1;
}

function monthlySendHourUtc(): number {
  const parsed = Number(process.env.MONTHLY_SCORE_EMAIL_HOUR_UTC ?? 14);
  return Number.isFinite(parsed) ? Math.min(23, Math.max(0, Math.floor(parsed))) : 14;
}

export function defaultMonthlyScoreVariant(): CleexsEmailTemplateVariant {
  const raw = (process.env.MONTHLY_SCORE_EMAIL_VARIANT || 'letter').trim().toLowerCase();
  return raw === 'editorial' ? 'editorial' : 'letter';
}

export function evaluateMonthlyScoreSend(options: { force?: boolean; now?: Date }): {
  due: boolean;
  reason?: string;
  campaignSlug?: string;
} {
  const now = options.now ?? new Date();
  const campaignSlug = monthlyScoreCampaignSlug(now);
  if (options.force) return { due: true, campaignSlug };

  const sendDay = monthlySendDayUtc();
  const sendHour = monthlySendHourUtc();
  const day = now.getUTCDate();
  const hour = now.getUTCHours();

  if (day < sendDay) return { due: false, reason: 'before_send_day', campaignSlug };
  if (day === sendDay && hour < sendHour) return { due: false, reason: 'before_send_hour', campaignSlug };

  return { due: true, campaignSlug };
}

function scoreFromAnalysisJson(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const root = value as {
    metrics?: { cleexsScore?: unknown };
    cleexsScore?: unknown;
    score?: unknown;
  };
  const raw = root.metrics?.cleexsScore ?? root.cleexsScore ?? root.score;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.round(Math.max(0, Math.min(100, n))) : null;
}

function competitorsFromAnalysis(value: unknown): CleexsEmailCompetitor[] {
  if (!value || typeof value !== 'object') return [];
  const analysis = value as {
    metrics?: {
      comparisonSummary?: Array<{ name?: string; type?: string; share?: number }>;
    };
  };
  const rows = analysis.metrics?.comparisonSummary;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r === 'object' && r.type !== 'brand' && typeof r.name === 'string')
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
    .slice(0, 5)
    .map((r) => ({ name: r.name!.trim(), score: null }));
}

async function diagnosticContextForEmail(email: string): Promise<{
  diagnosticId?: string;
  score?: number | null;
  competitors?: CleexsEmailCompetitor[];
  shareUrl?: string;
  improvementTip?: string | null;
}> {
  const row = await prisma.publicDiagnostic.findFirst({
    where: {
      email: email.toLowerCase(),
      status: 'completed',
      NOT: { email: { endsWith: WA_PLACEHOLDER_EMAIL_DOMAIN } },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      analysisJson: true,
      shareSlug: true,
    },
  });
  if (!row) return {};

  const base = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const analysis = row.analysisJson;
  const score = scoreFromAnalysisJson(analysis);
  let improvementTip: string | null = null;
  if (analysis && typeof analysis === 'object' && !Array.isArray(analysis)) {
    const sugerencias = (analysis as { sugerencias?: unknown }).sugerencias;
    if (Array.isArray(sugerencias) && typeof sugerencias[0] === 'string') {
      improvementTip = sugerencias[0];
    }
  }

  return {
    diagnosticId: row.id,
    score,
    competitors: competitorsFromAnalysis(analysis),
    shareUrl: row.shareSlug ? `${base}/score/${row.shareSlug}` : undefined,
    improvementTip,
  };
}

function buildLinksForRecipient(
  base: string,
  input: {
    campaignSlug: string;
    variant?: CleexsEmailTemplateVariant;
    diagnosticId?: string;
    shareUrl?: string;
  }
): {
  newDiagnosticUrl: string;
  reportUrl?: string;
  shareUrl?: string;
  plansUrl: string;
  unsubscribeUrl: string;
} {
  const origin = base.replace(/\/+$/, '');
  const medium = 'monthly_score';
  const variant = input.variant ?? null;
  return {
    newDiagnosticUrl: withEmailAttribution(buildMonthlyScoreDiagnosticUrl(origin), {
      campaignSlug: input.campaignSlug,
      variant,
      linkRole: 'cta_diagnostic',
      medium,
    }),
    reportUrl: input.diagnosticId
      ? withEmailAttribution(`${origin}/ver-resultado?diagnosticId=${input.diagnosticId}`, {
          campaignSlug: input.campaignSlug,
          variant,
          linkRole: 'cta_report',
          medium,
        })
      : undefined,
    shareUrl: input.shareUrl
      ? withEmailAttribution(input.shareUrl, {
          campaignSlug: input.campaignSlug,
          variant,
          linkRole: 'cta_share',
          medium,
        })
      : undefined,
    plansUrl: withEmailAttribution(buildMonthlyScorePlansUrl(origin), {
      campaignSlug: input.campaignSlug,
      variant,
      linkRole: 'cta_plans',
      medium,
    }),
    unsubscribeUrl: `${origin}/email/unsubscribe?example=1`,
  };
}

export async function sendMonthlyScoreEmailToRecipient(input: {
  recipient: MarketingEmailRecipient;
  campaignSlug: string;
  variant?: CleexsEmailTemplateVariant;
  subjectOverride?: string;
  batchLabel?: string;
}): Promise<{ provider: 'resend' | 'smtp'; logId: string; externalId?: string | null }> {
  if (isEmailDisabled()) {
    throw Object.assign(new Error('Envíos deshabilitados (DISABLE_EMAILS).'), { statusCode: 400 });
  }
  if (!isOutboundEmailAvailable()) {
    throw Object.assign(new Error('Sin canal de envío: configurá RESEND_API_KEY o SMTP completo.'), { statusCode: 503 });
  }

  const to = input.recipient.email.trim().toLowerCase();
  const variant = input.variant ?? defaultMonthlyScoreVariant();
  const base = getAppBaseUrlForPublicLinks();
  const ctx = await diagnosticContextForRecipient(input.recipient, to);
  const built = buildCleexsEmail({
    variant,
    personalization: {
      score: ctx.score ?? input.recipient.cleexsScore ?? null,
      brandName: input.recipient.brandName ?? 'tu marca',
      domain: input.recipient.domain ?? 'tu sitio',
      competitors: ctx.competitors?.length ? ctx.competitors : input.recipient.topCompetitor ? [{ name: input.recipient.topCompetitor }] : [],
      improvementTip: ctx.improvementTip ?? input.recipient.tips[0] ?? null,
    },
    links: buildLinksForRecipient(base, {
      campaignSlug: input.campaignSlug,
      variant,
      diagnosticId: ctx.diagnosticId,
      shareUrl: ctx.shareUrl ?? input.recipient.shareUrl,
    }),
    showFounderSignature: true,
    showScoreBlock: true,
    showReportLinks: variant === 'letter',
  });
  const subject = input.subjectOverride?.trim() || built.subject;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  let provider: 'resend' | 'smtp';
  let externalId: string | null = null;

  try {
    if (apiKey) {
      provider = 'resend';
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: buildTransactionalFromAddress(),
        to: [to],
        subject,
        html: built.html,
        text: built.text,
        headers: { 'X-Cleexs-Campaign': input.campaignSlug },
      });
      if (error) throw new Error(formatResendError(error));
      externalId = data?.id ?? null;
    } else if (isEmailConfigured()) {
      provider = 'smtp';
      const info = await sendSmtpMail({ to, subject, html: built.html, text: built.text });
      externalId = info.messageId ?? null;
    } else {
      throw Object.assign(new Error('Sin canal de envío.'), { statusCode: 503 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const row = await prisma.cleexsInternalEmailSendLog.create({
      data: {
        recipientEmail: to,
        campaignSlug: input.campaignSlug,
        status: CleexsEmailSendStatus.failed,
        errorMessage: msg.slice(0, 8000),
        tenantId: input.recipient.tenantId,
        cleexsScore: ctx.score ?? input.recipient.cleexsScore,
        scoreBucket: input.recipient.scoreBucket,
        mergeSummary: { mode: 'monthly_score', variant, batchLabel: input.batchLabel ?? null },
      },
    });
    throw Object.assign(new Error(msg), { statusCode: 502, logId: row.id });
  }

  const row = await prisma.cleexsInternalEmailSendLog.create({
    data: {
      recipientEmail: to,
      campaignSlug: input.campaignSlug,
      status: CleexsEmailSendStatus.sent,
      externalId,
      tenantId: input.recipient.tenantId,
      cleexsScore: ctx.score ?? input.recipient.cleexsScore,
      scoreBucket: input.recipient.scoreBucket,
      mergeSummary: {
        mode: 'custom_template_batch',
        variant,
        provider,
        batchLabel: input.batchLabel ?? null,
        subject,
      },
    },
  });

  return { provider, logId: row.id, externalId };
}

async function diagnosticContextForRecipient(
  recipient: MarketingEmailRecipient,
  email: string
): Promise<Awaited<ReturnType<typeof diagnosticContextForEmail>>> {
  const fromDiagnostic = await diagnosticContextForEmail(email);
  if (fromDiagnostic.diagnosticId || fromDiagnostic.score != null) return fromDiagnostic;
  return {
    score: recipient.cleexsScore ?? null,
    competitors: recipient.topCompetitor ? [{ name: recipient.topCompetitor }] : [],
    improvementTip: recipient.tips[0] ?? null,
    shareUrl: recipient.shareUrl,
  };
}

export async function runMonthlyScoreEmailBatch(input: {
  segment?: EmailAudienceSegment;
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
  variant?: CleexsEmailTemplateVariant;
}): Promise<Record<string, unknown>> {
  const evaluation = evaluateMonthlyScoreSend({ force: input.force });
  if (!evaluation.due) {
    return {
      ok: true,
      skipped: true,
      reason: evaluation.reason,
      campaignSlug: evaluation.campaignSlug,
    };
  }

  const campaignSlug = evaluation.campaignSlug!;
  const segment = input.segment ?? 'all';
  const limit = input.limit ?? 250;
  const variant = input.variant ?? defaultMonthlyScoreVariant();

  const batchStarted = await prisma.cleexsInternalEmailSendLog.findFirst({
    where: { campaignSlug, status: CleexsEmailSendStatus.sent },
    select: { id: true },
  });
  if (batchStarted && !input.force) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_sent_this_month',
      campaignSlug,
    };
  }

  const recipients = await resolveMarketingRecipients({ segment, limit });

  if (input.dryRun) {
    const sample = await Promise.all(
      recipients.slice(0, 10).map(async (r) => {
        const ctx = await diagnosticContextForEmail(r.email);
        return {
          email: r.email,
          brandName: r.brandName,
          domain: r.domain,
          score: ctx.score ?? r.cleexsScore ?? null,
          variant,
        };
      })
    );
    return {
      ok: true,
      dryRun: true,
      campaignSlug,
      segment,
      variant,
      totalRecipients: recipients.length,
      sample,
    };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const recipient of recipients) {
    const alreadySent = await prisma.cleexsInternalEmailSendLog.findFirst({
      where: { recipientEmail: recipient.email, campaignSlug, status: CleexsEmailSendStatus.sent },
      select: { id: true },
    });
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    try {
      await sendMonthlyScoreEmailToRecipient({ recipient, campaignSlug, variant });
      sent += 1;
    } catch (e) {
      failed += 1;
      if (errors.length < 20) {
        errors.push({ email: recipient.email, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return {
    ok: failed === 0,
    dryRun: false,
    campaignSlug,
    segment,
    variant,
    totalRecipients: recipients.length,
    sent,
    skipped,
    failed,
    errors,
  };
}

async function resolveMarketingRecipientForEmail(emailRaw: string): Promise<MarketingEmailRecipient> {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      tenantId: true,
      tenant: {
        select: {
          plan: { select: { name: true } },
          brands: { orderBy: { createdAt: 'asc' }, take: 1, select: { id: true, name: true, domain: true } },
        },
      },
    },
  });

  const brand = user?.tenant?.brands[0];
  let cleexsScore: number | undefined;
  let topCompetitor: string | undefined;
  const tips: string[] = [];

  if (brand?.id) {
    const report = await prisma.pRIAReport.findFirst({
      where: { brandId: brand.id },
      orderBy: { createdAt: 'desc' },
      select: { priaTotal: true },
    });
    if (report) cleexsScore = Math.round(report.priaTotal);
  }

  const ctx = await diagnosticContextForEmail(email);
  if (ctx.score != null) cleexsScore = ctx.score ?? cleexsScore;
  if (ctx.competitors?.[0]?.name) topCompetitor = ctx.competitors[0].name;
  if (ctx.improvementTip) tips.push(ctx.improvementTip);

  return {
    email,
    userId: user?.id,
    tenantId: user?.tenantId ?? undefined,
    planName: user?.tenant?.plan?.name,
    brandName: brand?.name ?? undefined,
    domain: brand?.domain ?? undefined,
    cleexsScore,
    scoreBucket:
      cleexsScore == null ? undefined : cleexsScore < 40 ? 'low' : cleexsScore < 70 ? 'mid' : 'high',
    shareUrl: ctx.shareUrl,
    topCompetitor,
    tips,
  };
}

export async function runCustomTemplateBatch(input: {
  campaignSlug: string;
  batchLabel?: string;
  emails: string[];
  variant?: CleexsEmailTemplateVariant;
  subject?: string;
  dryRun?: boolean;
}): Promise<Record<string, unknown>> {
  const campaignSlug = input.campaignSlug.trim();
  const batchLabel = input.batchLabel?.trim() || campaignSlug;
  const variant = input.variant ?? 'editorial';
  const subject = input.subject?.trim();
  const uniqueEmails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];

  if (uniqueEmails.length === 0) {
    return { ok: false, error: 'Sin destinatarios' };
  }

  if (input.dryRun) {
    const sample = await Promise.all(
      uniqueEmails.slice(0, 15).map(async (email) => {
        const recipient = await resolveMarketingRecipientForEmail(email);
        const ctx = await diagnosticContextForEmail(email);
        return {
          email,
          brandName: recipient.brandName ?? null,
          domain: recipient.domain ?? null,
          score: ctx.score ?? recipient.cleexsScore ?? null,
          variant,
          subject: subject ?? null,
        };
      })
    );
    return {
      ok: true,
      dryRun: true,
      campaignSlug,
      batchLabel,
      variant,
      subject: subject ?? null,
      totalRecipients: uniqueEmails.length,
      sample,
    };
  }

  let sent = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const email of uniqueEmails) {
    try {
      const recipient = await resolveMarketingRecipientForEmail(email);
      await sendMonthlyScoreEmailToRecipient({
        recipient,
        campaignSlug,
        variant,
        subjectOverride: subject,
        batchLabel,
      });
      sent += 1;
    } catch (e) {
      failed += 1;
      if (errors.length < 20) {
        errors.push({ email, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return {
    ok: failed === 0,
    dryRun: false,
    campaignSlug,
    batchLabel,
    variant,
    subject: subject ?? null,
    totalRecipients: uniqueEmails.length,
    sent,
    failed,
    errors,
  };
}
