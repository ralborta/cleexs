import { CleexsEmailSendStatus, CleexsEmailTemplateVariant, type FreeEmailSequenceStep } from '@prisma/client';
import { Resend } from 'resend';
import { getAppBaseUrlForPublicLinks } from './app-public-url';
import { buildCleexsEmailFromEditableContent } from './email-templates/build-from-content';
import type { CleexsEmailCompetitor } from './email-templates/shared';
import { mergeCleexsText } from './email-templates/shared';
import { withEmailAttribution } from './email-link-attribution';
import {
  buildTransactionalFromAddress,
  buildTransactionalReplyTo,
  isEmailConfigured,
  isEmailDisabled,
  isOutboundEmailAvailable,
  sendCleexsOpsEmail,
  sendDiagnosticLink,
  sendSmtpMail,
  type DiagnosticAnalysisForEmail,
} from './email';
import {
  buildFreeSequencePreviewLinks,
  ensureFreeEmailSequence,
  FREE_SEQUENCE_KEY,
} from './free-email-sequence';
import { buildMonthlyScoreDiagnosticUrl, buildFreeOnboardingPlanConquistarUrl } from './email-templates/build-email';
import { getInsightMeta, isFreeEmailInsightKey, resolveFreeEmailInsightLine } from './free-email-insights';
import { prisma } from './prisma';
import { isEmailUnsubscribedFromCategory } from './email-unsubscribe';

const WA_PLACEHOLDER_EMAIL_DOMAIN = '@whatsapp.cleexs.net';
export const FREE_ONBOARDING_CAMPAIGN_PREFIX = 'free-onboarding-s';

/** Aviso de corrida de secuencia free (inicio/fin).
 * Desactivado por defecto (Gonzalo no quiere el spam de ops).
 * Para reactivar: FREE_ONBOARDING_OPS_TO=email@dominio.com
 */
export function freeOnboardingOpsNotifyTo(): string {
  const raw = (process.env.FREE_ONBOARDING_OPS_TO || '').trim().toLowerCase();
  if (!raw || raw === 'off' || raw === 'false' || raw === '0' || raw === 'disabled') return '';
  return raw;
}

export type FreeOnboardingCandidate = {
  diagnosticId: string;
  email: string;
  brandName: string;
  domain: string;
  anchoredAt: Date;
  score: number | null;
  competitors: CleexsEmailCompetitor[];
  improvementTip: string | null;
  /** Oportunidades/acciones del Plan (= promptResults del run). */
  actionsCount: number | null;
  analysisJson?: unknown;
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

function clampScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}

/** Score desde analysisJson: gold metrics, cleexsScore free, o promedio de intenciones. */
function scoreFromAnalysisJson(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const root = value as {
    metrics?: { cleexsScore?: unknown };
    cleexsScore?: unknown;
    score?: unknown;
    comentariosPorIntencion?: Array<{ score?: unknown }>;
  };
  const raw = root.metrics?.cleexsScore ?? root.cleexsScore ?? root.score;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (Number.isFinite(n)) return clampScore(n);

  const byIntention = (root.comentariosPorIntencion || [])
    .map((i) => i.score)
    .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
  if (!byIntention.length) return null;
  return clampScore(byIntention.reduce((a, b) => a + b, 0) / byIntention.length);
}

/** Fuente de verdad del Cleexs Score: PRIA del run; fallback al analysisJson. */
async function resolveCleexsScoreForDiagnostic(input: {
  diagnosticId: string;
  analysisJson: unknown;
  runId?: string | null;
}): Promise<number | null> {
  let runId = input.runId ?? null;
  if (!runId) {
    const diag = await prisma.publicDiagnostic.findUnique({
      where: { id: input.diagnosticId },
      select: { runId: true },
    });
    runId = diag?.runId ?? null;
  }
  if (runId) {
    const report = await prisma.pRIAReport.findFirst({
      where: { runId },
      orderBy: { createdAt: 'desc' },
      select: { priaTotal: true },
    });
    if (report?.priaTotal != null && Number.isFinite(report.priaTotal)) {
      return clampScore(report.priaTotal);
    }
  }
  return scoreFromAnalysisJson(input.analysisJson);
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

/** Misma fuente que el Plan de Ataque web: cantidad de promptResults del run. */
async function actionsCountFromRunId(runId: string | null | undefined): Promise<number | null> {
  if (!runId) return null;
  const n = await prisma.promptResult.count({ where: { runId } });
  return n > 0 ? n : null;
}

async function resolveActionsCountForDiagnostic(input: {
  diagnosticId: string;
  runId?: string | null;
  analysisJson?: unknown;
}): Promise<number | null> {
  const fromRun = await actionsCountFromRunId(input.runId);
  if (fromRun != null) return fromRun;

  const row = await prisma.publicDiagnostic.findUnique({
    where: { id: input.diagnosticId },
    select: { runId: true },
  });
  const fromLookup = await actionsCountFromRunId(row?.runId);
  if (fromLookup != null) return fromLookup;

  // Fallback raro: arrays en analysisJson
  const a = input.analysisJson;
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const opps = (a as { oportunidades?: unknown }).oportunidades;
    if (Array.isArray(opps) && opps.length > 0) return opps.length;
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
  /**
   * Ventana inclusiva [cumulativeDays, untilDaysExclusive).
   * Evita perder el paso si el cron no corrió el día exacto (pausa/outage).
   * Por defecto: solo el día exacto.
   */
  untilDaysExclusive?: number;
  timezone: string;
  enrolledWithinDays: number;
  limit: number;
  now?: Date;
}): Promise<FreeOnboardingCandidate[]> {
  const now = input.now ?? new Date();
  const untilDaysExclusive = Math.max(
    input.untilDaysExclusive ?? input.cumulativeDays + 1,
    input.cumulativeDays + 1
  );
  const lookbackDays = input.enrolledWithinDays + untilDaysExclusive + 3;
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
    // Traer el universo del lookback; el `limit` se aplica después de filtrar ya-enviados.
    take: Math.max(input.limit * 20, 8000),
    select: {
      id: true,
      email: true,
      brandName: true,
      domain: true,
      updatedAt: true,
      analysisJson: true,
      shareSlug: true,
      runId: true,
    },
  });

  const base = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const results: FreeOnboardingCandidate[] = [];
  const seenEmails = new Set<string>();

  const runIds = [...new Set(rows.map((r) => r.runId).filter((id): id is string => Boolean(id)))];
  const actionsByRunId = new Map<string, number>();
  if (runIds.length) {
    const grouped = await prisma.promptResult.groupBy({
      by: ['runId'],
      where: { runId: { in: runIds } },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (g._count._all > 0) actionsByRunId.set(g.runId, g._count._all);
    }
  }

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || isPlaceholderEmail(email) || seenEmails.has(email)) continue;
    const daysAgo = daysBetweenLocalDates(row.updatedAt, now, input.timezone);
    if (daysAgo < input.cumulativeDays || daysAgo >= untilDaysExclusive) continue;

    if (await isPremiumEmail(email)) continue;
    // No llenar el cupo con gente que ya recibió este paso.
    if (await wasFreeOnboardingStepSent(email, input.sortOrder)) continue;

    seenEmails.add(email);
    const actionsCount =
      (row.runId ? actionsByRunId.get(row.runId) ?? null : null) ??
      (await resolveActionsCountForDiagnostic({
        diagnosticId: row.id,
        runId: row.runId,
        analysisJson: row.analysisJson,
      }));
    results.push({
      diagnosticId: row.id,
      email,
      brandName: row.brandName,
      domain: row.domain,
      anchoredAt: row.updatedAt,
      score: await resolveCleexsScoreForDiagnostic({
        diagnosticId: row.id,
        analysisJson: row.analysisJson,
        runId: row.runId,
      }),
      competitors: competitorsFromAnalysis(row.analysisJson),
      improvementTip: improvementTipFromAnalysis(row.analysisJson),
      actionsCount,
      analysisJson: row.analysisJson,
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
    reportUrl: withEmailAttribution(`${origin}/ver-resultado/v2?diagnosticId=${input.candidate.diagnosticId}`, {
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
    unsubscribeUrl: `${origin}/email/unsubscribe?email=${encodeURIComponent(input.candidate.email)}&from=free_sequence`,
  };
}

export async function sendFreeOnboardingStep(input: {
  candidate: FreeOnboardingCandidate;
  step: Pick<
    FreeEmailSequenceStep,
    'sortOrder' | 'subject' | 'preheader' | 'body' | 'postscript' | 'templateVariant' | 'insightKey' | 'insightText'
  >;
}): Promise<{ sent: boolean; reason?: string; logId?: string; subject?: string }> {
  if (isEmailDisabled()) return { sent: false, reason: 'emails_disabled' };
  if (!isOutboundEmailAvailable()) return { sent: false, reason: 'email_not_configured' };

  const to = input.candidate.email;
  if (await isEmailUnsubscribedFromCategory(to, 'content')) return { sent: false, reason: 'unsubscribed' };

  const campaignSlug = freeOnboardingCampaignSlug(input.step.sortOrder);
  const insightKey = isFreeEmailInsightKey(input.step.insightKey) ? input.step.insightKey : null;
  const variant = insightKey ? CleexsEmailTemplateVariant.letter : input.step.templateVariant;
  const commentText = (input.step.insightText || '').trim();
  // Envío: insightText en la tarjeta; body es el cuerpo del mail.
  const insightLine = insightKey
    ? commentText ||
      resolveFreeEmailInsightLine(insightKey, input.candidate.analysisJson, {
        brandName: input.candidate.brandName,
        domain: input.candidate.domain,
        score: input.candidate.score,
        topCompetitor: input.candidate.competitors[0]?.name ?? null,
      })
    : null;
  const featuredInsight =
    insightKey && insightLine
      ? { label: getInsightMeta(insightKey).title, text: insightLine }
      : null;
  const content = {
    variant,
    subject: input.step.subject,
    preheader: input.step.preheader,
    body: input.step.body,
    postscript: input.step.postscript,
  };

  const personalization = {
    score: input.candidate.score,
    brandName: input.candidate.brandName,
    domain: input.candidate.domain,
    competitors: input.candidate.competitors,
    improvementTip: input.candidate.improvementTip,
    actionsCount: input.candidate.actionsCount,
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
    featuredInsight,
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
        replyTo: buildTransactionalReplyTo(),
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

export async function buildFreeOnboardingCandidateFromDiagnostic(input: {
  diagnosticId: string;
  email: string;
  brandName: string;
  domain: string;
  analysisJson: unknown;
  shareSlug?: string | null;
  anchoredAt?: Date;
  runId?: string | null;
}): Promise<FreeOnboardingCandidate> {
  const email = input.email.trim().toLowerCase();
  const base = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const slug = input.shareSlug?.trim();
  return {
    diagnosticId: input.diagnosticId,
    email,
    brandName: input.brandName,
    domain: input.domain,
    anchoredAt: input.anchoredAt ?? new Date(),
    score: await resolveCleexsScoreForDiagnostic({
      diagnosticId: input.diagnosticId,
      analysisJson: input.analysisJson,
      runId: input.runId,
    }),
    competitors: competitorsFromAnalysis(input.analysisJson),
    improvementTip: improvementTipFromAnalysis(input.analysisJson),
    actionsCount: await resolveActionsCountForDiagnostic({
      diagnosticId: input.diagnosticId,
      runId: input.runId,
      analysisJson: input.analysisJson,
    }),
    analysisJson: input.analysisJson,
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

  await ensureFreeEmailSequence();
  // Siempre lee el paso 1 desde BD (contenido editado en admin UI).
  const step1 = await prisma.freeEmailSequenceStep.findFirst({
    where: { sequence: { key: FREE_SEQUENCE_KEY }, sortOrder: 1 },
  });
  if (!step1) return { sent: false, reason: 'step_not_configured' };

  const candidate = await buildFreeOnboardingCandidateFromDiagnostic(input);
  return sendFreeOnboardingStep({ candidate, step: step1 });
}

export type PostDiagnosticCompletionEmailKind = 'free_onboarding_s1' | 'diagnostic_link' | 'none';

/**
 * Correo post-diagnóstico free: solo secuencia paso 1 (carta + score).
 * El mail legacy `sendDiagnosticLink` queda solo para usuarios premium.
 */
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

  // Solo premium recibe el mail viejo de link; free nunca cae a ese template.
  if (step1.reason === 'premium_user') {
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

  // Paso 1 solo al completar diagnóstico; el cron nunca debe reenviarlo.
  const activeSteps = sequence.steps
    .filter((s) => s.active && s.sortOrder > 1)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const stepSummaries: Array<Record<string, unknown>> = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ email: string; sortOrder: number; error: string }> = [];

  type PlannedSend = {
    step: (typeof activeSteps)[number];
    cumulativeDays: number;
    untilDaysExclusive: number;
    candidate: FreeOnboardingCandidate;
  };
  const planned: PlannedSend[] = [];

  for (let i = 0; i < activeSteps.length; i++) {
    const step = activeSteps[i]!;
    const cumulativeDays = cumulativeDaysForStep(sequence.steps, step.sortOrder);
    // Paso 2 catch-up: todos los free con diagnóstico (día 0+). Pasos 3+: día del paso + ventana.
    const windowStart = step.sortOrder === 2 ? 0 : cumulativeDays;
    const untilDaysExclusive = windowStart + Math.max(enrolledWithinDays, 90);
    const candidates = await resolveFreeOnboardingCandidates({
      sortOrder: step.sortOrder,
      cumulativeDays: windowStart,
      untilDaysExclusive,
      timezone: sequence.timezone,
      enrolledWithinDays: Math.max(enrolledWithinDays, 90),
      limit,
      now,
    });

    const pending: FreeOnboardingCandidate[] = [];
    for (const candidate of candidates) {
      if (!force && (await wasFreeOnboardingStepSent(candidate.email, step.sortOrder))) {
        skipped += 1;
        continue;
      }
      // Paso 2: no exige s1 (arranque masivo). Pasos 3+: exige cadena completa.
      if (!force && step.sortOrder > 2) {
        let missingPrevious = false;
        for (let prev = 1; prev < step.sortOrder; prev += 1) {
          if (!(await wasFreeOnboardingStepSent(candidate.email, prev))) {
            missingPrevious = true;
            break;
          }
        }
        if (missingPrevious) {
          skipped += 1;
          continue;
        }
      }
      pending.push(candidate);
      planned.push({ step, cumulativeDays: windowStart, untilDaysExclusive, candidate });
    }

    if (dryRun) {
      stepSummaries.push({
        sortOrder: step.sortOrder,
        cumulativeDays: windowStart,
        untilDaysExclusive,
        requirePreviousStepsThrough: step.sortOrder > 2 ? step.sortOrder - 1 : null,
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
    } else {
      stepSummaries.push({
        sortOrder: step.sortOrder,
        cumulativeDays: windowStart,
        untilDaysExclusive,
        requirePreviousStepsThrough: step.sortOrder > 2 ? step.sortOrder - 1 : null,
        candidates: candidates.length,
        planned: pending.length,
        sent: 0,
      });
    }
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      due: true,
      enabled: sequence.enabled,
      timezone: sequence.timezone,
      sendHourLocal: sequence.sendHourLocal,
      sendMinuteLocal: sequence.sendMinuteLocal,
      enrolledWithinDays,
      sent: 0,
      skipped,
      failed: 0,
      steps: stepSummaries,
      errors: [],
    };
  }

  const opsTo = freeOnboardingOpsNotifyTo();

  if (planned.length > 0 && opsTo) {
    const lines = planned.map(
      (p) =>
        `· Paso ${p.step.sortOrder} → ${p.candidate.email} (${p.candidate.domain || p.candidate.brandName}) score=${p.candidate.score ?? '—'}`
    );
    const text = [
      'Inicio de secuencia free onboarding',
      '',
      `Fecha: ${now.toISOString()}`,
      `Hora local config: ${sequence.sendHourLocal}:${String(sequence.sendMinuteLocal).padStart(2, '0')} ${sequence.timezone}`,
      `Correos a enviar: ${planned.length}`,
      '',
      ...lines,
      '',
      'Cleexs · aviso automático',
    ].join('\n');
    try {
      await sendCleexsOpsEmail({
        to: opsTo,
        subject: `[Cleexs] Inicio de secuencia · ${planned.length} correo${planned.length === 1 ? '' : 's'}`,
        text,
      });
    } catch (e) {
      console.error('[free-onboarding] ops start notify failed', e);
    }
  }

  const sentByStep = new Map<number, number>();
  for (const item of planned) {
    try {
      const result = await sendFreeOnboardingStep({ candidate: item.candidate, step: item.step });
      if (result.sent) {
        sent += 1;
        sentByStep.set(item.step.sortOrder, (sentByStep.get(item.step.sortOrder) ?? 0) + 1);
      } else {
        skipped += 1;
      }
    } catch (e) {
      failed += 1;
      if (errors.length < 20) {
        errors.push({
          email: item.candidate.email,
          sortOrder: item.step.sortOrder,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    // Resend free/pro: ~10 req/s. Throttle para no perder el lote.
    await new Promise((r) => setTimeout(r, 120));
  }

  for (const summary of stepSummaries) {
    const so = summary.sortOrder as number;
    summary.sent = sentByStep.get(so) ?? 0;
  }

  if (planned.length > 0 && opsTo) {
    const stepLines = [...sentByStep.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([so, n]) => `· Paso ${so}: ${n} enviado${n === 1 ? '' : 's'}`);
    const text = [
      'Finalizado · secuencia free onboarding',
      '',
      `Se enviaron ${sent} correo${sent === 1 ? '' : 's'}.`,
      `Planificados: ${planned.length} · omitidos: ${skipped} · fallidos: ${failed}`,
      '',
      ...(stepLines.length ? stepLines : ['· (sin envíos)']),
      '',
      errors.length
        ? `Errores (máx 20):\n${errors.map((e) => `· p${e.sortOrder} ${e.email}: ${e.error}`).join('\n')}`
        : 'Sin errores.',
      '',
      'Cleexs · aviso automático',
    ].join('\n');
    try {
      await sendCleexsOpsEmail({
        to: opsTo,
        subject: `[Cleexs] Finalizado secuencia · se enviaron ${sent} correo${sent === 1 ? '' : 's'}`,
        text,
      });
    } catch (e) {
      console.error('[free-onboarding] ops end notify failed', e);
    }
  }

  return {
    ok: failed === 0,
    dryRun: false,
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
    opsNotifyTo: opsTo || null,
  };
}
