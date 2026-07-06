import { CleexsEmailSendStatus } from '@prisma/client';
import { type DiagnosticAnalysisForEmail, isEmailDisabled, isOutboundEmailAvailable } from './email';
import {
  sendFreeOnboardingStep1ForCompletedDiagnostic,
  wasFreeOnboardingStepSent,
} from './free-email-sequence-sender';
import { prisma } from './prisma';

const WA_PLACEHOLDER_EMAIL_DOMAIN = '@whatsapp.cleexs.net';
const CAMPAIGN_PREFIX = 'free-diagnostic-followup';

export const FREE_DIAGNOSTIC_FOLLOWUP_CAMPAIGN_PREFIX = CAMPAIGN_PREFIX;

export function isFreeDiagnosticFollowupCampaignSlug(campaignSlug: string): boolean {
  return campaignSlug.trim().toLowerCase().startsWith(CAMPAIGN_PREFIX);
}

export type FreeDiagnosticFollowupCandidate = {
  diagnosticId: string;
  email: string;
  brandName: string;
  domain: string;
  createdAt: Date;
  analysis: DiagnosticAnalysisForEmail | null;
};

function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith(WA_PLACEHOLDER_EMAIL_DOMAIN));
}

function campaignSlugForDiagnostic(diagnosticId: string): string {
  return `${CAMPAIGN_PREFIX}-${diagnosticId}`;
}

function analysisForEmail(json: unknown): DiagnosticAnalysisForEmail | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as DiagnosticAnalysisForEmail;
}

/** Diagnósticos free completados con email, registrados dentro de la ventana indicada. */
export async function resolveFreeDiagnosticFollowupCandidates(input: {
  registeredWithinDays: number;
  minRegistrationAgeDays?: number;
  limit: number;
}): Promise<FreeDiagnosticFollowupCandidate[]> {
  const minAgeDays = input.minRegistrationAgeDays ?? 1;
  const since = new Date();
  since.setDate(since.getDate() - input.registeredWithinDays);
  since.setHours(0, 0, 0, 0);

  const until = new Date();
  until.setDate(until.getDate() - minAgeDays);
  until.setHours(23, 59, 59, 999);

  const rows = await prisma.publicDiagnostic.findMany({
    where: {
      status: 'completed',
      email: { not: null },
      NOT: { email: { endsWith: WA_PLACEHOLDER_EMAIL_DOMAIN } },
      createdAt: { gte: since, lte: until },
      OR: [{ tier: null }, { tier: 'freemium' }],
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max(input.limit * 3, input.limit),
    select: {
      id: true,
      email: true,
      brandName: true,
      domain: true,
      createdAt: true,
      analysisJson: true,
    },
  });

  const byEmail = new Map<string, FreeDiagnosticFollowupCandidate>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || isPlaceholderEmail(email)) continue;
    if (byEmail.has(email)) continue;
    byEmail.set(email, {
      diagnosticId: row.id,
      email,
      brandName: row.brandName,
      domain: row.domain,
      createdAt: row.createdAt,
      analysis: analysisForEmail(row.analysisJson),
    });
    if (byEmail.size >= input.limit) break;
  }

  return Array.from(byEmail.values());
}

export async function wasFreeDiagnosticFollowupSent(diagnosticId: string): Promise<boolean> {
  const existing = await prisma.cleexsInternalEmailSendLog.findFirst({
    where: {
      campaignSlug: campaignSlugForDiagnostic(diagnosticId),
      status: CleexsEmailSendStatus.sent,
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function sendFreeDiagnosticFollowup(
  candidate: FreeDiagnosticFollowupCandidate
): Promise<{ sent: boolean; reason?: string }> {
  if (isEmailDisabled()) {
    return { sent: false, reason: 'emails_disabled' };
  }
  if (!isOutboundEmailAvailable()) {
    return { sent: false, reason: 'email_not_configured' };
  }

  if (await wasFreeOnboardingStepSent(candidate.email, 1)) {
    return { sent: false, reason: 'onboarding_step1_already_sent' };
  }

  const campaignSlug = campaignSlugForDiagnostic(candidate.diagnosticId);

  try {
    const result = await sendFreeOnboardingStep1ForCompletedDiagnostic({
      diagnosticId: candidate.diagnosticId,
      email: candidate.email,
      brandName: candidate.brandName,
      domain: candidate.domain,
      analysisJson: candidate.analysis,
      anchoredAt: candidate.createdAt,
    });
    if (!result.sent) {
      return { sent: false, reason: result.reason ?? 'not_sent' };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await prisma.cleexsInternalEmailSendLog.create({
      data: {
        recipientEmail: candidate.email,
        campaignSlug,
        status: CleexsEmailSendStatus.failed,
        errorMessage: msg.slice(0, 8000),
        mergeSummary: {
          mode: 'free_diagnostic_followup',
          diagnosticId: candidate.diagnosticId,
          brandName: candidate.brandName,
          domain: candidate.domain,
        },
      },
    });
    throw error;
  }

  await prisma.cleexsInternalEmailSendLog.create({
    data: {
      recipientEmail: candidate.email,
      campaignSlug,
      status: CleexsEmailSendStatus.sent,
      mergeSummary: {
        mode: 'free_diagnostic_followup',
        diagnosticId: candidate.diagnosticId,
        brandName: candidate.brandName,
        domain: candidate.domain,
        registeredAt: candidate.createdAt.toISOString(),
        deliveredAs: 'free_onboarding_s1',
      },
    },
  });

  return { sent: true };
}
