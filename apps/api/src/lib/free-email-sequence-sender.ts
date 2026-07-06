import { CleexsEmailSendStatus, CleexsEmailTemplateVariant, type FreeEmailSequenceStep } from '@prisma/client';
import { Resend } from 'resend';
import { getAppBaseUrlForPublicLinks } from './app-public-url';
import { buildCleexsEmailFromEditableContent } from './email-templates/build-from-content';
import type { CleexsEmailCompetitor } from './email-templates/shared';
import { mergeCleexsText } from './email-templates/shared';
import { withEmailAttribution } from './email-link-attribution';
import {
  buildTransactionalFromAddress,
  isEmailConfigured,
  isEmailDisabled,
  isOutboundEmailAvailable,
  sendDiagnosticLink,
  sendSmtpMail,
  type DiagnosticAnalysisForEmail,
} from './email';
import {
  buildFreeSequencePreviewLinks,
  ensureFreeEmailSequence,
} from './free-email-sequence';
import { buildMonthlyScoreDiagnosticUrl, buildFreeOnboardingPlanConquistarUrl } from './email-templates/build-email';
import { prisma } from './prisma';
import { isEmailUnsubscribed } from './email-unsubscribe';

const WA_PLACEHOLDER_EMAIL_DOMAIN = '@whatsapp.cleexs.net';
export const FREE_ONBOARDING_CAMPAIGN_PREFIX = 'free-onboarding-s';

export type FreeOnboardingCandidate = {
  diagnosticId: string;
  email: string;
  brandName: string;
  domain: string;
  anchoredAt: Date;
  score: number | null;
  competitors: CleexsEmailCompetitor[];
  improvementTip: string | null;
  shareUrl?: string;
  userId?: string;
  tenantId?: string;
};

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

function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith(WA_PLACEHOLDER_EMAIL_DOMAIN));
}

function planIsPremium(planName?: string | null): boolean {
  const v = (planName || '').toLowerCase();
  return v.includes('premium') || v.includes('crecimiento') || v.includes('growth') || v.includes('pro');
}

export function freeOnboardingCampaignSlug(sortOrder: number): string {
  return `${FREE_ONBOARDING_CAMPAIGN_PREFIX}${sortOrder}`;
}

export function isFreeOnboardingCampaignSlug(campaignSlug: string): boolean {
  return campaignSlug.trim().toLowerCase().startsWith(FREE_ONBOARDING_CAMPAIGN_PREFIX);
}

function localDateTimeParts(
  date: Date,
  timezone: string
): { dateKey: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) || 0,
    minute: Number(get('minute')) || 0,
  };
}

function daysBetweenLocalDates(from: Date, to: Date, timezone: string): number {
  const fromKey = localDateTimeParts(from, timezone).dateKey;
  const toKey = localDateTimeParts(to, timezone).dateKey;
  const fromMs = Date.parse(`${fromKey}T12:00:00Z`);
  const toMs = Date.parse(`${toKey}T12:00:00Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}

export function cumulativeDaysForStep(steps: Array<Pick<FreeEmailSequenceStep, 'sortOrder' | 'delayDaysAfterPrevious'>>, targetSortOrder: number): number {
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
  let total = 0;
  for (const step of sorted) {
    if (step.sortOrder === 1) {
      if (targetSortOrder === 1) return 0;
      continue;
    }
    total += step.delayDaysAfterPrevious;
    if (step.sortOrder === targetSortOrder) return total;
  }
  return total;
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

function improvementTipFromAnalysis(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const sugerencias = (value as { sugerencias?: unknown }).sugerencias;
  if (Array.isArray(sugerencias) && typeof sugerencias[0] === 'string') {
    return sugerencias[0];
  }
  return null;
}

export function evaluateFreeOnboardingSend(input: {
  enabled: boolean;
  sendHourLocal: number;
  sendMinuteLocal: number;
  timezone: string;
  force?: boolean;
  now?: Date;
}): { due: boolean; reason?: string } {
  const now = input.now ?? new Date();
  if (input.force) return { due: true };
  if (!input.enabled) return { due: false, reason: 'sequence_disabled' };

  const local = localDateTimeParts(now, input.timezone);
  const nowMinutes = local.hour * 60 + local.minute;
  const targetMinutes = input.sendHourLocal * 60 + input.sendMinuteLocal;
  if (nowMinutes < targetMinutes) {
    return { due: false, reason: 'before_send_time' };
  }
  return { due: true };
}

async function isPremiumEmail(email: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      role: 'owner',
      tenant: { status: 'active' },
    },
    include: { tenant: { include: { plan: { select: { name: true } } } } },
  });
  if (!user) return false;
  return planIsPremium(user.tenant.plan.name);
}

export async function wasFreeOnboardingStepSent(email: string, sortOrder: number): Promise<boolean> {
  const existing = await prisma.cleexsInternalEmailSendLog.findFirst({
    where: {
      recipientEmail: email.toLowerCase(),
      campaignSlug: freeOnboardingCampaignSlug(sortOrder),
      status: CleexsEmailSendStatus.sent,
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function resolveFreeOnboardingCandidates(input: {
  sortOrder: number;
  cumulativeDays: number;
  timezone: string;
  enrolledWithinDays: number;
  limit: number;
  now?: Date;
}): Promise<FreeOnboardingCandidate[]> {
  const now = input.now ?? new Date();
  const lookbackDays = input.enrolledWithinDays + input.cumulativeDays + 3;
  const since = new Date(now);
  since.setDate(since.getDate() - lookbackDays);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.publicDiagnostic.findMany({
    where: {
      status: 'completed',
      email: { not: null },
      NOT: { email: { endsWith: WA_PLACEHOLDER_EMAIL_DOMAIN } },
      updatedAt: { gte: since },
      OR: [{ tier: null }, { tier: 'freemium' }],
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.max(input.limit * 4, input.limit),
    select: {
      id: true,
      email: true,
      brandName: true,
      domain: true,
      updatedAt: true,
      analysisJson: true,
      shareSlug: true,
    },
  });

  const base = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const results: FreeOnboardingCandidate[] = [];
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || isPlaceholderEmail(email) || seenEmails.has(email)) continue;
    if (daysBetweenLocalDates(row.updatedAt, now, input.timezone) !== input.cumulativeDays) continue;

    if (await isPremiumEmail(email)) continue;

    seenEmails.add(email);
    results.push({
      diagnosticId: row.id,
      email,
      brandName: row.brandName,
      domain: row.domain,
      anchoredAt: row.updatedAt,
      score: scoreFromAnalysisJson(row.analysisJson),
      competitors: competitorsFromAnalysis(row.analysisJson),
      improvementTip: improvementTipFromAnalysis(row.analysisJson),
      shareUrl: row.shareSlug ? `${base}/score/${row.shareSlug}` : undefined,
    });

    if (results.length >= input.limit) break;
  }

  return results;
}

function buildLinksForCandidate(input: {
  candidate: FreeOnboardingCandidate;
  sortOrder: number;
  variant: CleexsEmailTemplateVariant;
}) {
  const origin = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const campaignSlug = freeOnboardingCampaignSlug(input.sortOrder);
  const baseLinks = buildFreeSequencePreviewLinks(campaignSlug, input.variant);
  const medium = 'free_onboarding';

  return {
    ...baseLinks,
    reportUrl: withEmailAttribution(`${origin}/ver-resultado?diagnosticId=${input.candidate.diagnosticId}`, {
      campaignSlug,
      variant: input.variant,
      linkRole: 'cta_report',
      medium,
    }),
    shareUrl: input.candidate.shareUrl
      ? withEmailAttribution(input.candidate.shareUrl, {
          campaignSlug,
          variant: input.variant,
          linkRole: 'cta_share',
          medium,
        })
      : baseLinks.shareUrl,
    newDiagnosticUrl: withEmailAttribution(buildMonthlyScoreDiagnosticUrl(origin), {
      campaignSlug,
      variant: input.variant,
      linkRole: 'cta_diagnostic',
      medium,
    }),
    plansUrl: withEmailAttribution(buildFreeOnboardingPlanConquistarUrl(origin), {
      campaignSlug,
      variant: input.variant,
      linkRole: 'cta_plans',
      medium,
    }),
    unsubscribeUrl: `${origin}/email/unsubscribe?email=${encodeURIComponent(input.candidate.email)}`,
  };
}

export async function sendFreeOnboardingStep(input: {
  candidate: FreeOnboardingCandidate;
  step: Pick<
    FreeEmailSequenceStep,
    'sortOrder' | 'subject' | 'preheader' | 'body' | 'templateVariant'
  >;
}): Promise<{ sent: boolean; reason?: string; logId?: string; subject?: string }> {
  if (isEmailDisabled()) return { sent: false, reason: 'emails_disabled' };
  if (!isOutboundEmailAvailable()) return { sent: false, reason: 'email_not_configured' };

  const to = input.candidate.email;
  if (await isEmailUnsubscribed(to)) return { sent: false, reason: 'unsubscribed' };

  const campaignSlug = freeOnboardingCampaignSlug(input.step.sortOrder);
  const variant = input.step.templateVariant;
  const content = {
    variant,
    subject: input.step.subject,
    preheader: input.step.preheader,
    body: input.step.body,
  };

  const personalization = {
    score: input.candidate.score,
    brandName: input.candidate.brandName,
    domain: input.candidate.domain,
    competitors: input.candidate.competitors,
    improvementTip: input.candidate.improvementTip,
  };

  const links = buildLinksForCandidate({
    candidate: input.candidate,
    sortOrder: input.step.sortOrder,
    variant,
  });

  const built = buildCleexsEmailFromEditableContent({
    content,
    personalization,
    links,
    showFounderSignature: true,
    showScoreBlock: variant === 'letter',
    showReportLinks: variant === 'letter',
  });

  const subject =
    input.step.subject?.trim()
      ? mergeCleexsText(input.step.subject.trim(), personalization)
      : built.subject;

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
        headers: { 'X-Cleexs-Campaign': campaignSlug },
      });
      if (error) throw new Error(formatResendError(error));
      externalId = data?.id ?? null;
    } else if (isEmailConfigured()) {
      provider = 'smtp';
      const info = await sendSmtpMail({ to, subject, html: built.html, text: built.text });
      externalId = info.messageId ?? null;
    } else {
      return { sent: false, reason: 'email_not_configured' };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await prisma.cleexsInternalEmailSendLog.create({
      data: {
        recipientEmail: to,
        campaignSlug,
        status: CleexsEmailSendStatus.failed,
        errorMessage: msg.slice(0, 8000),
        cleexsScore: input.candidate.score,
        mergeSummary: {
          mode: 'free_onboarding',
          sortOrder: input.step.sortOrder,
          diagnosticId: input.candidate.diagnosticId,
          variant,
        },
      },
    });
    throw error;
  }

  const log = await prisma.cleexsInternalEmailSendLog.create({
    data: {
      recipientEmail: to,
      userId: input.candidate.userId,
      tenantId: input.candidate.tenantId,
      campaignSlug,
      status: CleexsEmailSendStatus.sent,
      externalId,
      cleexsScore: input.candidate.score,
      mergeSummary: {
        mode: 'free_onboarding',
        provider,
        sortOrder: input.step.sortOrder,
        diagnosticId: input.candidate.diagnosticId,
        brandName: input.candidate.brandName,
        domain: input.candidate.domain,
        anchoredAt: input.candidate.anchoredAt.toISOString(),
        variant,
      },
    },
  });

  return { sent: true, logId: log.id, subject };
}

export function buildFreeOnboardingCandidateFromDiagnostic(input: {
  diagnosticId: string;
  email: string;
  brandName: string;
  domain: string;
  analysisJson: unknown;
  shareSlug?: string | null;
  anchoredAt?: Date;
}): FreeOnboardingCandidate {
  const email = input.email.trim().toLowerCase();
  const base = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const slug = input.shareSlug?.trim();
  return {
    diagnosticId: input.diagnosticId,
    email,
    brandName: input.brandName,
    domain: input.domain,
    anchoredAt: input.anchoredAt ?? new Date(),
    score: scoreFromAnalysisJson(input.analysisJson),
    competitors: competitorsFromAnalysis(input.analysisJson),
    improvementTip: improvementTipFromAnalysis(input.analysisJson),
    shareUrl: slug ? `${base}/score/${slug}` : undefined,
  };
}

/** Paso 1 de la secuencia free, disparado al completar un diagnóstico público. */
export async function sendFreeOnboardingStep1ForCompletedDiagnostic(input: {
  diagnosticId: string;
  email: string;
  brandName: string;
  domain: string;
  analysisJson: unknown;
  shareSlug?: string | null;
  anchoredAt?: Date;
}): Promise<{ sent: boolean; reason?: string; logId?: string; subject?: string }> {
  if (isEmailDisabled()) return { sent: false, reason: 'emails_disabled' };
  if (!isOutboundEmailAvailable()) return { sent: false, reason: 'email_not_configured' };
  if (isPlaceholderEmail(input.email)) return { sent: false, reason: 'placeholder_email' };

  const email = input.email.trim().toLowerCase();
  if (await isPremiumEmail(email)) return { sent: false, reason: 'premium_user' };
  if (await wasFreeOnboardingStepSent(email, 1)) return { sent: false, reason: 'already_sent' };

  const sequence = await ensureFreeEmailSequence();
  const step1 = sequence.steps.find((s) => s.sortOrder === 1 && s.active);
  if (!step1) return { sent: false, reason: 'step_not_configured' };

  const candidate = buildFreeOnboardingCandidateFromDiagnostic(input);
  return sendFreeOnboardingStep({ candidate, step: step1 });
}

export type PostDiagnosticCompletionEmailKind = 'free_onboarding_s1' | 'diagnostic_link' | 'none';

/** Correo post-diagnóstico: secuencia free paso 1 (default) o link legacy para premium / fallback. */
export async function sendPostDiagnosticCompletionEmail(input: {
  diagnosticId: string;
  email: string;
  brandName: string;
  domain: string;
  analysisJson: unknown;
  shareSlug?: string | null;
  anchoredAt?: Date;
  legacyAnalysis?: DiagnosticAnalysisForEmail | null;
}): Promise<{ sent: boolean; kind: PostDiagnosticCompletionEmailKind; reason?: string }> {
  const step1 = await sendFreeOnboardingStep1ForCompletedDiagnostic(input);
  if (step1.sent) return { sent: true, kind: 'free_onboarding_s1' };
  if (step1.reason === 'already_sent') return { sent: false, kind: 'none', reason: 'already_sent' };

  if (step1.reason === 'premium_user' || step1.reason === 'step_not_configured') {
    const baseUrl = getAppBaseUrlForPublicLinks();
    await sendDiagnosticLink(input.email, input.diagnosticId, baseUrl, input.legacyAnalysis);
    return { sent: true, kind: 'diagnostic_link' };
  }

  return { sent: false, kind: 'none', reason: step1.reason };
}

export async function runFreeOnboardingEmailBatch(input: {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  enrolledWithinDays?: number;
  now?: Date;
}) {
  const dryRun = input.dryRun ?? false;
  const force = input.force ?? false;
  const limit = input.limit ?? 100;
  const enrolledWithinDays = input.enrolledWithinDays ?? 60;
  const now = input.now ?? new Date();

  const sequence = await ensureFreeEmailSequence();
  const gate = evaluateFreeOnboardingSend({
    enabled: sequence.enabled,
    sendHourLocal: sequence.sendHourLocal,
    sendMinuteLocal: sequence.sendMinuteLocal,
    timezone: sequence.timezone,
    force,
    now,
  });

  if (!gate.due) {
    return {
      ok: true,
      dryRun,
      due: false,
      reason: gate.reason,
      enabled: sequence.enabled,
      sent: 0,
      skipped: 0,
      failed: 0,
      steps: [] as Array<Record<string, unknown>>,
    };
  }

  const activeSteps = sequence.steps.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const stepSummaries: Array<Record<string, unknown>> = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ email: string; sortOrder: number; error: string }> = [];

  for (const step of activeSteps) {
    const cumulativeDays = cumulativeDaysForStep(sequence.steps, step.sortOrder);
    const candidates = await resolveFreeOnboardingCandidates({
      sortOrder: step.sortOrder,
      cumulativeDays,
      timezone: sequence.timezone,
      enrolledWithinDays,
      limit,
      now,
    });

    const pending: FreeOnboardingCandidate[] = [];
    for (const candidate of candidates) {
      if (!force && (await wasFreeOnboardingStepSent(candidate.email, step.sortOrder))) {
        skipped += 1;
        continue;
      }
      pending.push(candidate);
    }

    if (dryRun) {
      stepSummaries.push({
        sortOrder: step.sortOrder,
        cumulativeDays,
        candidates: candidates.length,
        wouldSend: pending.length,
        sample: pending.slice(0, 10).map((c) => ({
          email: c.email,
          brandName: c.brandName,
          domain: c.domain,
          diagnosticId: c.diagnosticId,
          anchoredAt: c.anchoredAt.toISOString(),
          score: c.score,
        })),
      });
      continue;
    }

    let stepSent = 0;
    for (const candidate of pending) {
      try {
        const result = await sendFreeOnboardingStep({ candidate, step });
        if (result.sent) {
          sent += 1;
          stepSent += 1;
        } else {
          skipped += 1;
        }
      } catch (e) {
        failed += 1;
        if (errors.length < 20) {
          errors.push({
            email: candidate.email,
            sortOrder: step.sortOrder,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    stepSummaries.push({
      sortOrder: step.sortOrder,
      cumulativeDays,
      candidates: candidates.length,
      sent: stepSent,
    });
  }

  return {
    ok: failed === 0,
    dryRun,
    due: true,
    enabled: sequence.enabled,
    timezone: sequence.timezone,
    sendHourLocal: sequence.sendHourLocal,
    sendMinuteLocal: sequence.sendMinuteLocal,
    enrolledWithinDays,
    sent,
    skipped,
    failed,
    steps: stepSummaries,
    errors,
  };
}
