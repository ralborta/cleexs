import { getAppBaseUrlForPublicLinks } from './app-public-url';

export type MonthlyScoreEmailAssets = {
  /** Logo horizontal sobre fondo claro (~400×80). */
  logoUrl: string;
  /** Hero editorial 600×280 (opcional; si falta, se usa bloque CSS). */
  heroImageUrl?: string | null;
  /** Firma circular ~80px (opcional). */
  founderPhotoUrl?: string | null;
};

export type MonthlyScoreEmailContent = {
  subject: string;
  preheader: string;
  headline: string;
  introParagraphs: string[];
  scoreLabel: string;
  scoreMissingText: string;
  ctaLabel: string;
  ctaHint: string;
  postscript: string;
  planPitch: string;
  planCtaLabel: string;
  unsubscribeLabel: string;
};

export type MonthlyScoreEmailInput = {
  /** Único dato personalizado del mail. */
  score: number | null;
  newDiagnosticUrl: string;
  plansUrl: string;
  unsubscribeUrl: string;
  assets?: Partial<MonthlyScoreEmailAssets>;
  content?: Partial<MonthlyScoreEmailContent>;
  showFounderSignature?: boolean;
};

export type MonthlyScoreEmailBuilt = {
  subject: string;
  html: string;
  text: string;
  assets: MonthlyScoreEmailAssets;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function buildMonthlyScoreDiagnosticUrl(baseUrl = getAppBaseUrlForPublicLinks()): string {
  const base = trimBase(baseUrl);
  const params = new URLSearchParams({
    utm_source: 'email',
    utm_medium: 'monthly_score',
    utm_campaign: 'cleexs_score_monthly',
  });
  return `${base}/diagnostico/crear?${params.toString()}`;
}

export function buildMonthlyScorePlansUrl(baseUrl = getAppBaseUrlForPublicLinks()): string {
  return `${trimBase(baseUrl)}/planes?utm_source=email&utm_medium=monthly_score&utm_campaign=plan_conquistar`;
}

export function resolveMonthlyScoreEmailAssets(
  baseUrl = getAppBaseUrlForPublicLinks(),
  overrides?: Partial<MonthlyScoreEmailAssets>
): MonthlyScoreEmailAssets {
  const base = trimBase(baseUrl);
  const heroFromEnv = process.env.MONTHLY_SCORE_EMAIL_HERO_URL?.trim() || null;
  const founderFromEnv = process.env.MONTHLY_SCORE_EMAIL_FOUNDER_PHOTO_URL?.trim() || null;

  return {
    logoUrl: overrides?.logoUrl || `${base}/CleexsLogo.png`,
    heroImageUrl: overrides?.heroImageUrl ?? heroFromEnv,
    founderPhotoUrl: overrides?.founderPhotoUrl ?? founderFromEnv ?? `${base}/gonzalo-founder.png`,
  };
}

/** Copy base alineado a la fila “score mensual” del Excel de Gonzalo (sin prometer recálculo automático). */
export function defaultMonthlyScoreEmailContent(): MonthlyScoreEmailContent {
  return {
    subject: 'Tu Cleexs Score del mes: {{score}}',
    preheader: 'Tu último score guardado y un link para generar un diagnóstico nuevo cuando quieras.',
    headline: 'Tu visibilidad en motores de IA',
    introParagraphs: [
      'Cada mes te escribimos con un recordatorio simple: los motores de IA (ChatGPT, Claude, Gemini y Perplexity) cada vez influyen más en cómo tus clientes eligen proveedores.',
      'Tu último Cleexs Score registrado resume qué tan visible y confiable aparecés en esas respuestas. No regeneramos análisis para todos automáticamente: este número es el que ya tenés guardado.',
      'Si querés un score actualizado, generá un nuevo diagnóstico con el botón de abajo (podés hacerlo cuando te sirva, por ejemplo una vez al mes).',
    ],
    scoreLabel: 'Tu último Cleexs Score',
    scoreMissingText: 'Sin score reciente',
    ctaLabel: 'Generar nuevo diagnóstico',
    ctaHint: 'Gratis · tarda unos minutos · solo si vos lo pedís',
    postscript:
      'PD: ¿Todavía pensás que aparecer bien en ChatGPT es moda pasajera? Los que miden hoy van armando ventaja antes de que el resto reaccione.',
    planPitch:
      'Con Plan Conquistar seguís tu score mes a mes, comparás con competidores y ves más motores de IA — sin adivinar.',
    planCtaLabel: 'Ver Plan Conquistar',
    unsubscribeLabel: 'Dejar de recibir los emails de Cleexs',
  };
}

function mergeContent(overrides?: Partial<MonthlyScoreEmailContent>): MonthlyScoreEmailContent {
  return { ...defaultMonthlyScoreEmailContent(), ...overrides };
}

function mergeScoreInText(template: string, score: number | null): string {
  const scoreText = score != null && Number.isFinite(score) ? String(Math.round(score)) : '—';
  return template.replace(/\{\{\s*score\s*\}\}/g, scoreText);
}

function paragraphsToHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#334155;">${escapeHtml(p)}</p>`)
    .join('\n');
}

function scoreDisplay(score: number | null, content: MonthlyScoreEmailContent): { value: string; sub: string } {
  if (score == null || !Number.isFinite(score)) {
    return { value: '—', sub: content.scoreMissingText };
  }
  return {
    value: String(Math.round(Math.max(0, Math.min(100, score)))),
    sub: 'de 100 · último registro en Cleexs',
  };
}

function scoreBandColor(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return '#6366f1';
  if (score >= 70) return '#059669';
  if (score >= 40) return '#2563eb';
  return '#d97706';
}

function buildHeroBlock(assets: MonthlyScoreEmailAssets, headline: string): string {
  const safeHeadline = escapeHtml(headline);
  if (assets.heroImageUrl) {
    return `
      <tr>
        <td style="padding:0 0 20px;">
          <img src="${escapeHtml(assets.heroImageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:12px;" />
        </td>
      </tr>`;
  }

  return `
      <tr>
        <td style="padding:0 0 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;border:3px solid #c4b5fd;overflow:hidden;background:#ffffff;">
            <tr>
              <td style="padding:28px 24px;background:linear-gradient(135deg,#4f46e5 0%,#6366f1 55%,#818cf8 100%);color:#ffffff;">
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.9;font-weight:700;">Cleexs Score mensual</p>
                <p style="margin:0;font-size:26px;line-height:1.2;font-weight:800;">${safeHeadline}</p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.5;opacity:.92;">ChatGPT · Claude · Gemini · Perplexity</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

export function buildMonthlyScoreEmail(input: MonthlyScoreEmailInput): MonthlyScoreEmailBuilt {
  const content = mergeContent(input.content);
  const assets = resolveMonthlyScoreEmailAssets(getAppBaseUrlForPublicLinks(), input.assets);
  const subject = mergeScoreInText(content.subject, input.score);
  const { value: scoreValue, sub: scoreSub } = scoreDisplay(input.score, content);
  const accent = scoreBandColor(input.score);
  const showFounder = input.showFounderSignature !== false && Boolean(assets.founderPhotoUrl);

  const preheader = mergeScoreInText(content.preheader, input.score);
  const introHtml = paragraphsToHtml(content.introParagraphs.map((p) => mergeScoreInText(p, input.score)));
  const postscript = mergeScoreInText(content.postscript, input.score);

  const founderBlock = showFounder
    ? `
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 0;">
            <tr>
              <td style="padding-right:12px;vertical-align:middle;">
                <img src="${escapeHtml(assets.founderPhotoUrl!)}" alt="Gonzalo" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:999px;border:2px solid #e2e8f0;" />
              </td>
              <td style="vertical-align:middle;font-size:14px;line-height:1.45;color:#475569;">
                <strong style="color:#0f172a;">Gonzalo</strong><br/>Cleexs
              </td>
            </tr>
          </table>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Georgia,'Times New Roman',Times,serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;">
          <tr>
            <td style="padding:0 0 16px;text-align:left;">
              <img src="${escapeHtml(assets.logoUrl)}" alt="Cleexs" width="140" style="display:block;width:140px;height:auto;border:0;" />
            </td>
          </tr>
          ${buildHeroBlock(assets, content.headline)}
          <tr>
            <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:28px 26px;">
              ${introHtml}

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 22px;border-radius:16px;border:1px solid #e0e7ff;background:linear-gradient(180deg,#f8faff 0%,#eef2ff 100%);">
                <tr>
                  <td style="padding:22px 20px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#4f46e5;font-weight:700;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">${escapeHtml(content.scoreLabel)}</p>
                    <p style="margin:0;font-size:64px;line-height:1;font-weight:800;color:${accent};font-family:system-ui,-apple-system,Segoe UI,sans-serif;">${escapeHtml(scoreValue)}</p>
                    <p style="margin:8px 0 0;font-size:13px;color:#64748b;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">${escapeHtml(scoreSub)}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
                <tr>
                  <td style="border-radius:10px;background:#4f46e5;">
                    <a href="${escapeHtml(input.newDiagnosticUrl)}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">${escapeHtml(content.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-size:12px;color:#94a3b8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">${escapeHtml(content.ctaHint)}</p>

              <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;font-style:italic;">${escapeHtml(postscript)}</p>
              ${founderBlock}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 4px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;border-radius:12px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#cbd5e1;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">${escapeHtml(content.planPitch)}</p>
                    <a href="${escapeHtml(input.plansUrl)}" style="font-size:14px;font-weight:700;color:#a5b4fc;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">${escapeHtml(content.planCtaLabel)} →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 6px 8px;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
              <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(content.unsubscribeLabel)}</a>
              <br/>
              Cleexs · visibilidad en IA
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    subject,
    '',
    ...content.introParagraphs.map((p) => mergeScoreInText(p, input.score)),
    '',
    `${content.scoreLabel}: ${scoreValue}`,
    '',
    `${content.ctaLabel}: ${input.newDiagnosticUrl}`,
    '',
    postscript,
    '',
    content.planPitch,
    `${content.planCtaLabel}: ${input.plansUrl}`,
    '',
    content.unsubscribeLabel,
  ].join('\n');

  return { subject, html, text, assets };
}

/** Ejemplo fijo para preview en admin (score de muestra). */
export function buildMonthlyScoreEmailPreviewExample(overrides?: {
  score?: number;
  assets?: Partial<MonthlyScoreEmailAssets>;
}): MonthlyScoreEmailBuilt {
  const base = getAppBaseUrlForPublicLinks();
  return buildMonthlyScoreEmail({
    score: overrides?.score ?? 62,
    newDiagnosticUrl: buildMonthlyScoreDiagnosticUrl(base),
    plansUrl: buildMonthlyScorePlansUrl(base),
    unsubscribeUrl: `${trimBase(base)}/email/unsubscribe?example=1`,
    assets: overrides?.assets,
    showFounderSignature: true,
  });
}
