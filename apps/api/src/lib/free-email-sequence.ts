import {
  CleexsEmailSendStatus,
  CleexsEmailTemplateVariant,
  type FreeEmailSequence,
  type FreeEmailSequenceStep,
} from '@prisma/client';
import { Resend } from 'resend';
import { getAppBaseUrlForPublicLinks } from './app-public-url';
import {
  buildCleexsEmailFromEditableContent,
  type EditableEmailStepContent,
} from './email-templates/build-from-content';
import {
  buildFreeOnboardingPlanConquistarUrl,
  buildMonthlyScoreDiagnosticUrl,
} from './email-templates/build-email';
import {
  sampleCleexsEmailLinks,
  sampleCleexsPersonalization,
  type CleexsEmailLinks,
} from './email-templates/shared';
import { withEmailAttribution } from './email-link-attribution';
import { buildTransactionalFromAddress, buildTransactionalReplyTo, isEmailConfigured, isEmailDisabled, sendSmtpMail } from './email';
import { isEmailUnsubscribedFromCategory } from './email-unsubscribe';
import {
  FREE_EMAIL_INSIGHT_CATALOG,
  getInsightMeta,
  isFreeEmailInsightKey,
} from './free-email-insights';
import { prisma } from './prisma';

export const FREE_SEQUENCE_KEY = 'free_onboarding';

export type FreeSequenceStepDto = {
  id: string;
  sortOrder: number;
  delayDaysAfterPrevious: number;
  title: string;
  subject: string | null;
  preheader: string | null;
  body: string | null;
  insightKey: string | null;
  insightText: string | null;
  postscript: string | null;
  templateVariant: CleexsEmailTemplateVariant;
  active: boolean;
  cumulativeDaysLabel: string;
};

export type FreeSequenceConfigDto = {
  id: string;
  key: string;
  enabled: boolean;
  sendHourLocal: number;
  sendMinuteLocal: number;
  timezone: string;
  notes: string | null;
  updatedAt: string;
};

export type FreeSequenceBundleDto = {
  ok: true;
  preview: true;
  config: FreeSequenceConfigDto;
  steps: FreeSequenceStepDto[];
  suggestedDefaults: FreeSequenceSuggestedDefault[];
  suggestedBySortOrder: Record<string, FreeSequenceSuggestedDefault>;
  insightCatalog: Array<{
    key: string;
    sortOrder: number;
    title: string;
    description: string;
    sampleLine: string;
  }>;
};

export type FreeSequenceSuggestedDefault = {
  sortOrder: number;
  delayDaysAfterPrevious: number;
  title: string;
  subject: string;
  preheader: string;
  body: string;
  templateVariant: CleexsEmailTemplateVariant;
};

const DEFAULT_STEPS: Array<Omit<EditableEmailStepContent, 'variant'> & {
  sortOrder: number;
  delayDaysAfterPrevious: number;
  title: string;
  templateVariant: CleexsEmailTemplateVariant;
}> = [
  {
    sortOrder: 1,
    delayDaysAfterPrevious: 0,
    title: 'Onboarding · diagnóstico free',
    templateVariant: 'letter',
    subject: 'Tu diagnóstico Cleexs para {{brandName}}',
    preheader: 'Gracias por registrarte — acá va tu primer resumen.',
    body:
      'Hola,\n\nGracias por completar tu diagnóstico free en Cleexs.\n\nEn {{domain}} vimos señales concretas sobre cómo te encuentran hoy los motores de IA. Tu Cleexs Score es {{score}}.\n\nEn los próximos días te vamos a mandar tips cortos para mejorar esa visibilidad.',
  },
  {
    sortOrder: 2,
    delayDaysAfterPrevious: 3,
    title: 'Tip · 3 días después',
    templateVariant: 'letter',
    subject: 'Un tip rápido para {{domain}}',
    preheader: 'Algo concreto que podés mejorar esta semana.',
    body:
      'Pasaron unos días desde tu diagnóstico.\n\nPara {{brandName}}, una mejora simple es reforzar en tu home por qué te eligen frente a {{topCompetitor}}.\n\nTip: {{tip1}}',
  },
  {
    sortOrder: 3,
    delayDaysAfterPrevious: 5,
    title: 'Seguimiento · 5 días después',
    templateVariant: 'letter',
    subject: '¿Querés subir tu score en {{domain}}?',
    preheader: 'Medí de nuevo o pasá a un plan con seguimiento.',
    body:
      'Seguimos acompañando tu evolución.\n\nSi querés ver cómo cambió tu visibilidad en IA, podés generar un nuevo diagnóstico gratis.\n\nY si preferís seguimiento mensual automático, el Plan Conquistar te lo deja resuelto.',
  },
];

const GENERIC_STEP_DEFAULT: Omit<FreeSequenceSuggestedDefault, 'sortOrder' | 'delayDaysAfterPrevious' | 'title'> = {
  subject: 'Novedades de Cleexs para {{brandName}}',
  preheader: 'Un mensaje para tu cuenta free.',
  body:
    'Hola,\n\nTe escribimos con novedades sobre {{domain}}.\n\nTu Cleexs Score sigue siendo {{score}}. Tip: {{tip1}}',
  templateVariant: CleexsEmailTemplateVariant.letter,
};

export function getSuggestedDefaultForSortOrder(sortOrder: number): FreeSequenceSuggestedDefault {
  const match = DEFAULT_STEPS.find((s) => s.sortOrder === sortOrder);
  if (match) {
    return {
      sortOrder: match.sortOrder,
      delayDaysAfterPrevious: match.delayDaysAfterPrevious,
      title: match.title,
      subject: match.subject ?? '',
      preheader: match.preheader ?? '',
      body: match.body ?? '',
      templateVariant: match.templateVariant,
    };
  }
  return {
    sortOrder,
    delayDaysAfterPrevious: 7,
    title: `Paso ${sortOrder}`,
    ...GENERIC_STEP_DEFAULT,
  };
}

export function listFreeSequenceSuggestedDefaults(): FreeSequenceSuggestedDefault[] {
  return DEFAULT_STEPS.map((s) => getSuggestedDefaultForSortOrder(s.sortOrder));
}

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

function cumulativeDaysLabel(steps: Array<{ sortOrder: number; delayDaysAfterPrevious: number }>, index: number): string {
  if (index === 0) return 'Al registrarse (día 0)';
  let total = 0;
  for (let i = 1; i <= index; i += 1) {
    total += steps[i]?.delayDaysAfterPrevious ?? 0;
  }
  return `+${steps[index]?.delayDaysAfterPrevious ?? 0} días · ~día ${total} total`;
}

function toStepDto(step: FreeEmailSequenceStep, allSteps: FreeEmailSequenceStep[]): FreeSequenceStepDto {
  const sorted = [...allSteps].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = sorted.findIndex((s) => s.id === step.id);
  return {
    id: step.id,
    sortOrder: step.sortOrder,
    delayDaysAfterPrevious: step.delayDaysAfterPrevious,
    title: step.title,
    subject: step.subject,
    preheader: step.preheader,
    body: step.body,
    insightKey: step.insightKey,
    insightText: step.insightText,
    postscript: step.postscript,
    templateVariant: step.templateVariant,
    active: step.active,
    cumulativeDaysLabel: cumulativeDaysLabel(sorted, index),
  };
}

function toConfigDto(config: FreeEmailSequence): FreeSequenceConfigDto {
  return {
    id: config.id,
    key: config.key,
    enabled: config.enabled,
    sendHourLocal: config.sendHourLocal,
    sendMinuteLocal: config.sendMinuteLocal,
    timezone: config.timezone,
    notes: config.notes,
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function ensureFreeEmailSequence(): Promise<FreeEmailSequence & { steps: FreeEmailSequenceStep[] }> {
  let sequence = await prisma.freeEmailSequence.findUnique({
    where: { key: FREE_SEQUENCE_KEY },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!sequence) {
    sequence = await prisma.freeEmailSequence.create({
      data: {
        key: FREE_SEQUENCE_KEY,
        enabled: false,
        steps: {
          create: DEFAULT_STEPS.map((s) => ({
            sortOrder: s.sortOrder,
            delayDaysAfterPrevious: s.delayDaysAfterPrevious,
            title: s.title,
            subject: s.subject,
            preheader: s.preheader,
            body: s.body,
            templateVariant: s.templateVariant,
            active: s.sortOrder === 1,
          })),
        },
      },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
  } else if (sequence.steps.length === 0) {
    await prisma.freeEmailSequenceStep.createMany({
      data: DEFAULT_STEPS.map((s) => ({
        sequenceId: sequence!.id,
        sortOrder: s.sortOrder,
        delayDaysAfterPrevious: s.delayDaysAfterPrevious,
        title: s.title,
        subject: s.subject,
        preheader: s.preheader,
        body: s.body,
        templateVariant: s.templateVariant,
        active: s.sortOrder === 1,
      })),
    });
    sequence = await prisma.freeEmailSequence.findUniqueOrThrow({
      where: { key: FREE_SEQUENCE_KEY },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  return sequence;
}

export async function getFreeEmailSequenceBundle(): Promise<FreeSequenceBundleDto> {
  const sequence = await ensureFreeEmailSequence();
  const sortOrders = new Set(sequence.steps.map((s) => s.sortOrder));
  const maxOrder = sequence.steps.reduce((m, s) => Math.max(m, s.sortOrder), 0);
  sortOrders.add(maxOrder + 1);
  const suggestedBySortOrder = Object.fromEntries(
    [...sortOrders].map((order) => [String(order), getSuggestedDefaultForSortOrder(order)])
  );
  return {
    ok: true,
    preview: true,
    config: toConfigDto(sequence),
    steps: sequence.steps.map((s) => toStepDto(s, sequence.steps)),
    suggestedDefaults: listFreeSequenceSuggestedDefaults(),
    suggestedBySortOrder,
    insightCatalog: FREE_EMAIL_INSIGHT_CATALOG,
  };
}

export function buildFreeSequencePreviewLinks(campaignSlug: string, variant: CleexsEmailTemplateVariant): CleexsEmailLinks {
  const origin = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const medium = 'free_onboarding';
  return {
    newDiagnosticUrl: withEmailAttribution(buildMonthlyScoreDiagnosticUrl(origin), {
      campaignSlug,
      variant,
      linkRole: 'cta_diagnostic',
      medium,
    }),
    plansUrl: withEmailAttribution(buildFreeOnboardingPlanConquistarUrl(origin), {
      campaignSlug,
      variant,
      linkRole: 'cta_plans',
      medium,
    }),
    unsubscribeUrl: `${origin}/email/unsubscribe?preview=1`,
  };
}

const WA_PLACEHOLDER_EMAIL_DOMAIN = '@whatsapp.cleexs.net';

/** Links reales para un destinatario (último diagnóstico completado con ese email). */
export async function resolveFreeSequenceLinksForEmail(input: {
  email: string;
  campaignSlug: string;
  variant: CleexsEmailTemplateVariant;
}): Promise<CleexsEmailLinks> {
  const origin = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const medium = 'free_onboarding';
  const base = buildFreeSequencePreviewLinks(input.campaignSlug, input.variant);
  const normalizedEmail = input.email.trim().toLowerCase();

  const row = await prisma.publicDiagnostic.findFirst({
    where: {
      email: normalizedEmail,
      status: 'completed',
      NOT: { email: { endsWith: WA_PLACEHOLDER_EMAIL_DOMAIN } },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, shareSlug: true },
  });

  const unsubscribeUrl = `${origin}/email/unsubscribe?email=${encodeURIComponent(normalizedEmail)}&from=free_sequence`;

  if (!row) {
    return { ...base, unsubscribeUrl };
  }

  return {
    newDiagnosticUrl: base.newDiagnosticUrl,
    plansUrl: base.plansUrl,
    unsubscribeUrl,
    reportUrl: withEmailAttribution(`${origin}/ver-resultado/v2?diagnosticId=${row.id}`, {
      campaignSlug: input.campaignSlug,
      variant: input.variant,
      linkRole: 'cta_report',
      medium,
    }),
    shareUrl: row.shareSlug?.trim()
      ? withEmailAttribution(`${origin}/score/${row.shareSlug.trim()}`, {
          campaignSlug: input.campaignSlug,
          variant: input.variant,
          linkRole: 'cta_share',
          medium,
        })
      : undefined,
  };
}

export async function buildFreeSequencePreview(input: {
  content: EditableEmailStepContent;
  score?: number;
  domain?: string;
  brandName?: string;
  sortOrder?: number;
  recipientEmail?: string;
  insightKey?: string | null;
  insightText?: string | null;
}) {
  const personalization = sampleCleexsPersonalization({
    score: input.score,
    domain: input.domain,
    brandName: input.brandName,
  });
  const campaignSlug = `free-onboarding-s${input.sortOrder ?? 1}`;
  const links = input.recipientEmail
    ? await resolveFreeSequenceLinksForEmail({
        email: input.recipientEmail,
        campaignSlug,
        variant: input.content.variant,
      })
    : {
        ...sampleCleexsEmailLinks(),
        ...buildFreeSequencePreviewLinks(campaignSlug, input.content.variant),
      };

  const insightKey = isFreeEmailInsightKey(input.insightKey) ? input.insightKey : null;
  const commentText = (input.insightText || '').trim();
  // Texto de tarjeta: insightText editable. Fallback al sample del catálogo.
  const insightLine =
    insightKey && commentText
      ? commentText
      : insightKey
        ? getInsightMeta(insightKey).sampleLine
        : null;
  const featuredInsight =
    insightKey && insightLine
      ? { label: getInsightMeta(insightKey).title, text: insightLine }
      : null;

  // Cuerpo del mail e insight de tarjeta son independientes.
  const built = buildCleexsEmailFromEditableContent({
    content: {
      ...input.content,
      variant: insightKey ? CleexsEmailTemplateVariant.letter : input.content.variant,
      body: input.content.body,
    },
    personalization,
    links,
    featuredInsight,
    showFounderSignature: true,
    showScoreBlock: (insightKey ? 'letter' : input.content.variant) === 'letter',
    showReportLinks: (insightKey ? 'letter' : input.content.variant) === 'letter',
  });
  return {
    ok: true as const,
    variant: built.variant,
    subject: built.subject,
    html: built.html,
    text: built.text,
    assets: built.assets,
    sampleScore: personalization.score ?? 62,
    sampleDomain: personalization.domain ?? 'empliados.net',
    sampleBrandName: personalization.brandName ?? 'Empliados',
    campaignSlug,
    insightKey,
    insightPreviewLine: insightLine,
  };
}

export async function updateFreeEmailSequenceConfig(input: {
  enabled?: boolean;
  sendHourLocal?: number;
  sendMinuteLocal?: number;
  notes?: string | null;
  updatedBy?: string | null;
}) {
  const sequence = await ensureFreeEmailSequence();
  const updated = await prisma.freeEmailSequence.update({
    where: { id: sequence.id },
    data: {
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.sendHourLocal !== undefined ? { sendHourLocal: input.sendHourLocal } : {}),
      ...(input.sendMinuteLocal !== undefined ? { sendMinuteLocal: input.sendMinuteLocal } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.updatedBy !== undefined ? { updatedBy: input.updatedBy } : {}),
    },
  });
  return toConfigDto(updated);
}

export async function updateFreeEmailSequenceStep(
  stepId: string,
  input: Partial<{
    sortOrder: number;
    delayDaysAfterPrevious: number;
    title: string;
    subject: string | null;
    preheader: string | null;
    body: string | null;
    insightKey: string | null;
    insightText: string | null;
    postscript: string | null;
    templateVariant: CleexsEmailTemplateVariant;
    active: boolean;
  }>
) {
  const sequence = await ensureFreeEmailSequence();
  const existing = sequence.steps.find((s) => s.id === stepId);
  if (!existing) throw Object.assign(new Error('Paso no encontrado'), { statusCode: 404 });

  let insightKey: string | null | undefined = input.insightKey;
  if (insightKey !== undefined && insightKey !== null && !isFreeEmailInsightKey(insightKey)) {
    throw Object.assign(new Error('insightKey inválido'), { statusCode: 400 });
  }

  const updated = await prisma.freeEmailSequenceStep.update({
    where: { id: stepId },
    data: {
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.delayDaysAfterPrevious !== undefined ? { delayDaysAfterPrevious: input.delayDaysAfterPrevious } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.preheader !== undefined ? { preheader: input.preheader } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(insightKey !== undefined ? { insightKey } : {}),
      ...(input.insightText !== undefined ? { insightText: input.insightText } : {}),
      ...(input.postscript !== undefined ? { postscript: input.postscript } : {}),
      ...(input.templateVariant !== undefined
        ? { templateVariant: insightKey ? CleexsEmailTemplateVariant.letter : input.templateVariant }
        : insightKey
          ? { templateVariant: CleexsEmailTemplateVariant.letter }
          : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });

  const refreshed = await ensureFreeEmailSequence();
  return toStepDto(updated, refreshed.steps);
}

export async function createFreeEmailSequenceStep(input: {
  title?: string;
  delayDaysAfterPrevious?: number;
  templateVariant?: CleexsEmailTemplateVariant;
  useSuggestedContent?: boolean;
}) {
  const sequence = await ensureFreeEmailSequence();
  const maxOrder = sequence.steps.reduce((m, s) => Math.max(m, s.sortOrder), 0);
  const nextOrder = maxOrder + 1;
  const suggested = getSuggestedDefaultForSortOrder(nextOrder);
  const useSuggested = input.useSuggestedContent !== false;
  const created = await prisma.freeEmailSequenceStep.create({
    data: {
      sequenceId: sequence.id,
      sortOrder: nextOrder,
      delayDaysAfterPrevious: input.delayDaysAfterPrevious ?? suggested.delayDaysAfterPrevious,
      title: (input.title ?? suggested.title).trim(),
      templateVariant: input.templateVariant ?? suggested.templateVariant,
      subject: useSuggested ? suggested.subject : '',
      preheader: useSuggested ? suggested.preheader : '',
      body: useSuggested ? suggested.body : '',
      active: false,
    },
  });
  const refreshed = await ensureFreeEmailSequence();
  return toStepDto(created, refreshed.steps);
}

export async function deleteFreeEmailSequenceStep(stepId: string) {
  const sequence = await ensureFreeEmailSequence();
  const existing = sequence.steps.find((s) => s.id === stepId);
  if (!existing) throw Object.assign(new Error('Paso no encontrado'), { statusCode: 404 });
  if (sequence.steps.length <= 1) {
    throw Object.assign(new Error('La secuencia debe tener al menos un paso'), { statusCode: 400 });
  }
  await prisma.freeEmailSequenceStep.delete({ where: { id: stepId } });
  const remaining = sequence.steps.filter((s) => s.id !== stepId).sort((a, b) => a.sortOrder - b.sortOrder);
  for (let i = 0; i < remaining.length; i += 1) {
    await prisma.freeEmailSequenceStep.update({
      where: { id: remaining[i]!.id },
      data: { sortOrder: i + 1 },
    });
  }
  return { ok: true as const };
}

export async function reorderFreeEmailSequenceSteps(stepIdsInOrder: string[]) {
  const sequence = await ensureFreeEmailSequence();
  const ids = new Set(sequence.steps.map((s) => s.id));
  if (stepIdsInOrder.length !== sequence.steps.length || stepIdsInOrder.some((id) => !ids.has(id))) {
    throw Object.assign(new Error('Orden inválido'), { statusCode: 400 });
  }
  for (let i = 0; i < stepIdsInOrder.length; i += 1) {
    await prisma.freeEmailSequenceStep.update({
      where: { id: stepIdsInOrder[i]! },
      data: { sortOrder: i + 1 },
    });
  }
  const refreshed = await ensureFreeEmailSequence();
  return refreshed.steps.map((s) => toStepDto(s, refreshed.steps));
}

export async function sendFreeEmailSequenceStepTest(input: {
  to: string;
  content: EditableEmailStepContent;
  sortOrder?: number;
  score?: number;
  domain?: string;
  brandName?: string;
  insightKey?: string | null;
  insightText?: string | null;
}) {
  if (isEmailDisabled()) {
    throw Object.assign(new Error('Envíos deshabilitados (DISABLE_EMAILS).'), { statusCode: 400 });
  }

  const to = input.to.trim().toLowerCase();
  if (await isEmailUnsubscribedFromCategory(to, 'content')) {
    throw Object.assign(new Error('El destinatario está dado de baja de emails de Cleexs.'), { statusCode: 400 });
  }

  const built = await buildFreeSequencePreview({
    content: input.content,
    score: input.score,
    domain: input.domain,
    brandName: input.brandName,
    sortOrder: input.sortOrder,
    recipientEmail: to,
    insightKey: input.insightKey,
    insightText: input.insightText,
  });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const campaignSlug = built.campaignSlug;
  let provider: 'resend' | 'smtp';
  let externalId: string | null = null;

  if (apiKey) {
    provider = 'resend';
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: buildTransactionalFromAddress(),
      to: [to],
      subject: built.subject,
      html: built.html,
      text: built.text,
      replyTo: buildTransactionalReplyTo(),
      headers: { 'X-Cleexs-Campaign': campaignSlug },
    });
    if (error) throw new Error(formatResendError(error));
    externalId = data?.id ?? null;
  } else if (isEmailConfigured()) {
    provider = 'smtp';
    const info = await sendSmtpMail({ to, subject: built.subject, html: built.html, text: built.text });
    externalId = info.messageId ?? null;
  } else {
    throw Object.assign(new Error('Sin canal de envío: configurá RESEND_API_KEY o SMTP.'), { statusCode: 503 });
  }

  const log = await prisma.cleexsInternalEmailSendLog.create({
    data: {
      recipientEmail: to,
      campaignSlug,
      status: CleexsEmailSendStatus.sent,
      externalId,
      mergeSummary: {
        mode: 'free_sequence_preview',
        provider,
        variant: input.content.variant,
        sortOrder: input.sortOrder ?? null,
      },
    },
  });

  return { ok: true as const, provider, logId: log.id, externalId, subject: built.subject, variant: input.content.variant };
}
