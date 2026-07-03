import { CleexsEmailSendStatus, type Prisma } from '@prisma/client';
import { Resend } from 'resend';
import { buildTransactionalFromAddress, isEmailConfigured, isEmailDisabled, sendSmtpMail } from './email';
import { withEmailAttribution } from './email-link-attribution';
import { prisma } from './prisma';

export type EmailAudienceSegment = 'all' | 'free' | 'premium';

export type MarketingEmailRecipient = {
  email: string;
  userId?: string;
  tenantId?: string;
  planName?: string;
  brandName?: string;
  domain?: string;
  cleexsScore?: number;
  scoreBucket?: 'low' | 'mid' | 'high';
  shareUrl?: string;
  topCompetitor?: string;
  tips: string[];
};

export type MarketingEmailSendInput = {
  recipient: MarketingEmailRecipient;
  campaignSlug: string;
  subject: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  preheader?: string;
  mergeSummary?: Prisma.InputJsonValue;
};

type Provider = 'resend_inline' | 'smtp';

const DEFAULT_CTA_URL = 'https://app.cleexs.net/planes';
const DEFAULT_CTA_LABEL = 'Ver Premium';
const WA_PLACEHOLDER_EMAIL_DOMAIN = '@whatsapp.cleexs.net';

function isPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith(WA_PLACEHOLDER_EMAIL_DOMAIN));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function planIsPremium(planName?: string | null): boolean {
  const v = (planName || '').toLowerCase();
  return v.includes('premium') || v.includes('crecimiento') || v.includes('growth') || v.includes('pro');
}

function bucketForScore(score?: number): MarketingEmailRecipient['scoreBucket'] {
  if (score == null || !Number.isFinite(score)) return undefined;
  if (score < 40) return 'low';
  if (score < 70) return 'mid';
  return 'high';
}

function scoreFromAnalysisJson(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const root = value as {
    metrics?: { cleexsScore?: unknown };
    cleexsScore?: unknown;
    score?: unknown;
  };
  const raw = root.metrics?.cleexsScore ?? root.cleexsScore ?? root.score;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.round(Math.max(0, Math.min(100, n))) : undefined;
}

function mergeText(template: string, r: MarketingEmailRecipient): string {
  const values: Record<string, string> = {
    email: r.email,
    brandName: r.brandName || 'tu marca',
    domain: r.domain || 'tu sitio',
    score: r.cleexsScore != null ? String(r.cleexsScore) : 'sin score reciente',
    scoreBucket: r.scoreBucket || 'sin segmento',
    plan: r.planName || 'free',
    topCompetitor: r.topCompetitor || 'un competidor de tu categoría',
    tip1: r.tips[0] || 'Mejorá la claridad de tus páginas principales para que los motores de IA entiendan mejor qué hacés.',
    tip2: r.tips[1] || 'Agregá respuestas directas a preguntas frecuentes de tus clientes.',
    tip3: r.tips[2] || 'Mantené actualizado el contenido que describe tus productos, servicios y diferenciales.',
    shareUrl: r.shareUrl || '',
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
}

function paragraphsToHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.65;color:#334155;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function resolveTrackedUrls(input: MarketingEmailSendInput) {
  const r = input.recipient;
  const medium =
    typeof input.mergeSummary === 'object' &&
    input.mergeSummary &&
    !Array.isArray(input.mergeSummary) &&
    (input.mergeSummary as { mode?: string }).mode === 'broadcast'
      ? 'broadcast'
      : 'weekly_email';
  const ctaUrl = withEmailAttribution(input.ctaUrl || DEFAULT_CTA_URL, {
    campaignSlug: input.campaignSlug,
    linkRole: 'cta_plans',
    medium,
  });
  const trackedShareUrl = r.shareUrl
    ? withEmailAttribution(r.shareUrl, {
        campaignSlug: input.campaignSlug,
        linkRole: 'cta_share',
        medium,
      })
    : null;
  return { ctaUrl, trackedShareUrl, medium };
}

function buildMarketingHtml(input: MarketingEmailSendInput): string {
  const r = input.recipient;
  const { ctaUrl, trackedShareUrl } = resolveTrackedUrls(input);
  const ctaLabel = input.ctaLabel || DEFAULT_CTA_LABEL;
  const scoreBlock =
    r.cleexsScore != null
      ? `<div style="margin:18px 0;padding:14px 16px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;">
          <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#4f46e5;font-weight:700;">Cleexs Score</p>
          <p style="margin:4px 0 0;font-size:28px;line-height:1;font-weight:800;color:#0f172a;">${r.cleexsScore}</p>
        </div>`
      : '';

  const footer = trackedShareUrl
    ? `<p style="margin:14px 0 0;font-size:12px;color:#64748b;">Tu reporte público: <a href="${escapeHtml(trackedShareUrl)}" style="color:#4f46e5;">${escapeHtml(trackedShareUrl)}</a></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="padding:22px 26px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;">
          <p style="margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.9;">Cleexs</p>
          <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;">${escapeHtml(mergeText(input.subject, r))}</h1>
          ${input.preheader ? `<p style="margin:8px 0 0;font-size:13px;opacity:.88;">${escapeHtml(mergeText(input.preheader, r))}</p>` : ''}
        </td></tr>
        <tr><td style="padding:26px;">
          ${scoreBlock}
          ${paragraphsToHtml(mergeText(input.body, r))}
          <div style="margin:24px 0 8px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;font-weight:700;font-size:14px;">${escapeHtml(ctaLabel)}</a>
          </div>
          <p style="margin:10px 0 0;font-size:12px;color:#64748b;">Premium desbloquea seguimiento semanal, más motores de IA y recomendaciones accionables.</p>
          ${footer}
        </td></tr>
        <tr><td style="padding:16px 26px;border-top:1px solid #f1f5f9;font-size:11px;line-height:1.5;color:#94a3b8;">
          Recibís este email porque dejaste tus datos en Cleexs. Si querés pausar estos mensajes, respondé este correo con “baja”.
          <br/>Ref: ${escapeHtml(input.campaignSlug)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildMarketingText(input: MarketingEmailSendInput): string {
  const r = input.recipient;
  const { ctaUrl, trackedShareUrl } = resolveTrackedUrls(input);
  return [
    mergeText(input.subject, r),
    '',
    mergeText(input.body, r),
    '',
    `Premium: ${ctaUrl}`,
    trackedShareUrl ? `Reporte: ${trackedShareUrl}` : '',
    '',
    '— Cleexs',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sendMarketingEmail(input: MarketingEmailSendInput): Promise<{ provider: Provider; logId: string; externalId?: string | null }> {
  const to = input.recipient.email.trim().toLowerCase();
  if (isEmailDisabled()) {
    throw Object.assign(new Error('Envíos deshabilitados (DISABLE_EMAILS).'), { statusCode: 400 });
  }

  const subject = mergeText(input.subject, input.recipient).slice(0, 180);
  const html = buildMarketingHtml(input);
  const text = buildMarketingText(input);
  const from = buildTransactionalFromAddress();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  let provider: Provider;
  let externalId: string | null = null;

  try {
    if (apiKey) {
      provider = 'resend_inline';
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
        text,
        headers: {
          'X-Cleexs-Campaign': input.campaignSlug,
        },
      });
      if (error) throw new Error(formatResendError(error));
      externalId = data?.id ?? null;
    } else if (isEmailConfigured()) {
      provider = 'smtp';
      const info = await sendSmtpMail({ to, subject, html, text });
      externalId = info.messageId ?? null;
    } else {
      throw Object.assign(new Error('Sin canal de envío: configurá RESEND_API_KEY o SMTP completo.'), { statusCode: 503 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await prisma.cleexsInternalEmailSendLog.create({
      data: {
        recipientEmail: to,
        userId: input.recipient.userId,
        tenantId: input.recipient.tenantId,
        campaignSlug: input.campaignSlug,
        scoreBucket: input.recipient.scoreBucket,
        cleexsScore: input.recipient.cleexsScore,
        status: CleexsEmailSendStatus.failed,
        errorMessage: msg.slice(0, 8000),
        mergeSummary: input.mergeSummary ?? {},
      },
    });
    throw error;
  }

  const log = await prisma.cleexsInternalEmailSendLog.create({
    data: {
      recipientEmail: to,
      userId: input.recipient.userId,
      tenantId: input.recipient.tenantId,
      campaignSlug: input.campaignSlug,
      scoreBucket: input.recipient.scoreBucket,
      cleexsScore: input.recipient.cleexsScore,
      status: CleexsEmailSendStatus.sent,
      externalId,
      mergeSummary: {
        provider,
        ...(typeof input.mergeSummary === 'object' && input.mergeSummary ? input.mergeSummary : {}),
      },
    },
  });

  return { provider, logId: log.id, externalId };
}

async function latestBrandContext(brandId: string): Promise<Pick<MarketingEmailRecipient, 'cleexsScore' | 'scoreBucket' | 'topCompetitor' | 'tips'>> {
  const report = await prisma.pRIAReport.findFirst({
    where: { brandId },
    orderBy: { createdAt: 'desc' },
    select: { priaTotal: true, runId: true },
  });
  const score = report ? Math.round(report.priaTotal) : undefined;

  let topCompetitor: string | undefined;
  if (report?.runId) {
    const promptResult = await prisma.promptResult.findFirst({
      where: { runId: report.runId },
      orderBy: { score: 'asc' },
      select: { top3Json: true },
    });
    const top3 = Array.isArray(promptResult?.top3Json) ? promptResult.top3Json : [];
    const competitor = top3.find((item) => item && typeof item === 'object' && (item as { type?: unknown }).type === 'competitor');
    const name = competitor && typeof (competitor as { name?: unknown }).name === 'string' ? (competitor as { name: string }).name.trim() : '';
    topCompetitor = name || undefined;
  }

  return {
    cleexsScore: score,
    scoreBucket: bucketForScore(score),
    topCompetitor,
    tips: tipsForScore(score),
  };
}

function tipsForScore(score?: number): string[] {
  if (score == null) {
    return [
      'Completá o actualizá tu diagnóstico para tener un Cleexs Score de referencia.',
      'Agregá preguntas frecuentes claras en tu web para responder mejor a búsquedas conversacionales.',
      'Mostrá casos, clientes o resultados concretos para que la IA tenga señales confiables.',
    ];
  }
  if (score < 40) {
    return [
      'Explicá en la home qué hacés, para quién y en qué país o mercado operás.',
      'Sumá una página de preguntas frecuentes con respuestas directas y específicas.',
      'Nombrá tus principales servicios con el lenguaje que usan tus clientes, no solo con slogans.',
    ];
  }
  if (score < 70) {
    return [
      'Reforzá páginas comparativas y casos de uso para aparecer en consultas de recomendación.',
      'Actualizá contenido clave con datos recientes, ejemplos y beneficios concretos.',
      'Conectá tus diferenciales con preguntas reales que tus clientes harían en ChatGPT.',
    ];
  }
  return [
    'Protegé tu ventaja manteniendo contenido actualizado y específico por categoría.',
    'Profundizá en casos de uso donde tus competidores también aparecen mencionados.',
    'Medí semanalmente cambios en motores de IA para detectar caídas antes de que impacten.',
  ];
}

export async function resolveMarketingRecipients(input: {
  segment: EmailAudienceSegment;
  limit: number;
}): Promise<MarketingEmailRecipient[]> {
  const byEmail = new Map<string, MarketingEmailRecipient>();

  const users = await prisma.user.findMany({
    where: {
      email: { contains: '@' },
      NOT: { email: { endsWith: WA_PLACEHOLDER_EMAIL_DOMAIN } },
      role: 'owner',
      tenant: { status: 'active' },
    },
    include: {
      tenant: {
        include: {
          plan: { select: { name: true } },
          brands: { orderBy: { createdAt: 'asc' }, take: 1, select: { id: true, name: true, domain: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: Math.max(input.limit * 2, input.limit),
  });

  for (const user of users) {
    if (isPlaceholderEmail(user.email)) continue;
    const planName = user.tenant.plan.name;
    const premium = planIsPremium(planName);
    if (input.segment === 'free' && premium) continue;
    if (input.segment === 'premium' && !premium) continue;

    const brand = user.tenant.brands[0];
    const ctx = brand ? await latestBrandContext(brand.id) : { tips: tipsForScore() };
    byEmail.set(user.email.toLowerCase(), {
      email: user.email.toLowerCase(),
      userId: user.id,
      tenantId: user.tenantId,
      planName,
      brandName: brand?.name,
      domain: brand?.domain ?? undefined,
      ...ctx,
    });
    if (byEmail.size >= input.limit) return Array.from(byEmail.values());
  }

  if (input.segment !== 'premium' && byEmail.size < input.limit) {
    const diagnostics = await prisma.publicDiagnostic.findMany({
      where: {
        email: { not: null },
        NOT: { email: { endsWith: WA_PLACEHOLDER_EMAIL_DOMAIN } },
        status: 'completed',
      },
      orderBy: { updatedAt: 'desc' },
      select: { email: true, brandName: true, domain: true, analysisJson: true, shareSlug: true },
      take: input.limit * 3,
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL?.split(',')[0] || 'https://app.cleexs.net').replace(/\/+$/, '');
    for (const diagnostic of diagnostics) {
      const email = diagnostic.email?.trim().toLowerCase();
      if (!email || byEmail.has(email)) continue;
      if (isPlaceholderEmail(email)) continue;
      const score = scoreFromAnalysisJson(diagnostic.analysisJson);
      byEmail.set(email, {
        email,
        planName: 'free',
        brandName: diagnostic.brandName,
        domain: diagnostic.domain,
        cleexsScore: score,
        scoreBucket: bucketForScore(score),
        shareUrl: diagnostic.shareSlug ? `${appUrl}/score/${diagnostic.shareSlug}` : undefined,
        tips: tipsForScore(score),
      });
      if (byEmail.size >= input.limit) break;
    }
  }

  return Array.from(byEmail.values()).slice(0, input.limit);
}

type WeeklyContent = { subject: string; body: string; preheader: string };

const WEEKLY_DEFAULTS: Record<1 | 2 | 3 | 4, WeeklyContent> = {
  1: {
    subject: '{{brandName}}: tu Cleexs Score es {{score}}',
    preheader: 'Resumen mensual de visibilidad en IA.',
    body:
      'Hola, esta semana miramos el estado general de {{brandName}}.\n\nTu Cleexs Score actual es {{score}}. Este número resume qué tan visible y confiable aparecés frente a motores de IA y buscadores conversacionales.\n\nTip rápido: {{tip1}}',
  },
  2: {
    subject: 'Un competidor que deberías mirar: {{topCompetitor}}',
    preheader: 'Una señal competitiva simple para mantenerte atento.',
    body:
      'En las consultas de IA, la pelea no es solo por tráfico: también es por ser mencionado como opción.\n\nEsta semana te sugerimos mirar a {{topCompetitor}} y revisar si tu sitio explica con la misma claridad por qué elegir {{brandName}}.\n\nTip rápido: {{tip2}}',
  },
  3: {
    subject: '3 ajustes para mejorar {{domain}}',
    preheader: 'Acciones simples para que la IA entienda mejor tu negocio.',
    body:
      'Para {{domain}}, estas son tres mejoras de bajo esfuerzo que suelen ayudar a subir presencia en motores de IA:\n\n1. {{tip1}}\n2. {{tip2}}\n3. {{tip3}}\n\nNo hace falta rehacer todo: conviene empezar por la home, servicios y preguntas frecuentes.',
  },
  4: {
    subject: 'Cómo aparecer mejor en ChatGPT y otros motores',
    preheader: 'Una recomendación semanal para sostener presencia de marca.',
    body:
      'Cada vez más personas descubren proveedores preguntándole a ChatGPT, Gemini o Perplexity. Para aparecer mejor, la IA necesita señales claras: qué hacés, para quién, dónde operás y por qué sos confiable.\n\nPara {{brandName}}, el mejor próximo paso es: {{tip1}}\n\nSi querés medirlo todas las semanas y ver motores extra, Premium lo deja automatizado.',
  },
};

/**
 * Lee la campania configurada para `weekIndex` y `bucket = 'all'`. Si existe
 * y tiene subject/body/preheader cargados, los usa. Si no, cae al texto por
 * defecto del slot. Esto permite editar el contenido desde /admin/email sin
 * tocar codigo.
 */
async function loadWeeklyContentFromCampaign(weekSlot: 1 | 2 | 3 | 4): Promise<WeeklyContent | null> {
  try {
    const campaign = await prisma.cleexsInternalEmailCampaign.findFirst({
      where: { weekIndex: weekSlot, active: true, scoreBucket: 'all' as never },
      orderBy: { priority: 'desc' },
    });
    if (!campaign) return null;
    const subject = (campaign.subject || '').trim();
    const body = (campaign.body || '').trim();
    const preheader = (campaign.preheader || campaign.description || '').trim();
    if (!subject && !body) return null;
    return {
      subject: subject || WEEKLY_DEFAULTS[weekSlot].subject,
      body: body || WEEKLY_DEFAULTS[weekSlot].body,
      preheader: preheader || WEEKLY_DEFAULTS[weekSlot].preheader,
    };
  } catch {
    return null;
  }
}

export async function weeklyEmailForRecipient(
  recipient: MarketingEmailRecipient,
  weekSlot: 1 | 2 | 3 | 4
): Promise<WeeklyContent> {
  // recipient no se usa por ahora aca; el merge de variables lo hace
  // sendMarketingEmail despues con mergeText().
  void recipient;
  const fromDb = await loadWeeklyContentFromCampaign(weekSlot);
  return fromDb ?? WEEKLY_DEFAULTS[weekSlot];
}
