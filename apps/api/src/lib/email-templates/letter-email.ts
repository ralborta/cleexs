import {
  type CleexsEmailAssets,
  type CleexsEmailBuilt,
  type CleexsEmailLinks,
  type CleexsEmailPersonalization,
  escapeHtml,
  founderSignatureHtml,
  mergeCleexsText,
  normalizedScore,
  resolveCleexsEmailAssets,
  scoreAccent,
} from './shared';
import { getAppBaseUrlForPublicLinks } from '../app-public-url';

export type CleexsLetterContent = {
  subject: string;
  preheader: string;
  bodyParagraphs: string[];
  exclusiveLabel: string;
  scoreLine: string;
  scoreMissingLine: string;
  reportCtaLabel: string;
  shareCtaLabel: string;
  newDiagnosticCtaLabel: string;
  newDiagnosticHint: string;
  postscript: string;
  planTitle: string;
  planPitch: string;
  planCtaLabel: string;
  founderTitle: string;
  unsubscribeLabel: string;
};

export type CleexsLetterEmailInput = {
  personalization: CleexsEmailPersonalization;
  links: CleexsEmailLinks;
  assets?: Partial<CleexsEmailAssets>;
  content?: Partial<CleexsLetterContent>;
  showFounderSignature?: boolean;
  /** Muestra bloque de score + CTA nuevo diagnóstico (mail mensual). */
  showScoreBlock?: boolean;
  /** Muestra botones de reporte y compartir. */
  showReportLinks?: boolean;
};

export function defaultCleexsLetterContent(): CleexsLetterContent {
  return {
    subject: 'Tu Cleexs Score: {{score}}',
    preheader: 'Algo exclusivo para {{domain}} — tu reporte y tu score.',
    bodyParagraphs: [
      'Cada mes te escribo con un recordatorio simple: ChatGPT, Claude, Gemini y Perplexity ya influyen en cómo tus clientes eligen proveedores.',
      'Tu último Cleexs Score resume qué tan visible aparecés hoy. No regeneramos análisis para todos automáticamente: este número es el que ya tenés guardado.',
    ],
    exclusiveLabel: 'Exclusivo para {{domain}}',
    scoreLine: 'Tu Cleexs Score: {{score}}',
    scoreMissingLine: 'Todavía no tenemos un score guardado para vos.',
    reportCtaLabel: 'Ver mi reporte',
    shareCtaLabel: 'Compartir reporte',
    newDiagnosticCtaLabel: 'Generar nuevo diagnóstico',
    newDiagnosticHint: 'Gratis · unos minutos · solo si vos lo pedís',
    postscript:
      'PD: ¿Todavía pensás que aparecer bien en ChatGPT es moda pasajera? Los que miden hoy van armando ventaja antes de que el resto reaccione.',
    planTitle: 'Tu plan de ataque para dominar ChatGPT en 90 días',
    planPitch:
      'Con Plan Conquistar seguís tu score mes a mes, comparás con competidores y dejás de adivinar cómo te recomiendan.',
    planCtaLabel: 'Ver Plan Conquistar',
    founderTitle: 'Fundador',
    unsubscribeLabel: 'Dejar de recibir los emails de Cleexs',
  };
}

function mergeContent(overrides?: Partial<CleexsLetterContent>): CleexsLetterContent {
  return { ...defaultCleexsLetterContent(), ...overrides };
}

function bodyParagraphsHtml(paragraphs: string[], ctx: CleexsEmailPersonalization): string {
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#334155;font-family:Georgia,'Times New Roman',Times,serif;">${escapeHtml(mergeCleexsText(p, ctx))}</p>`
    )
    .join('\n');
}

function personalizedBlockHtml(
  input: CleexsLetterEmailInput,
  content: CleexsLetterContent,
  ctx: CleexsEmailPersonalization
): string {
  const parts: string[] = [];
  const domainLabel = mergeCleexsText(content.exclusiveLabel, ctx);
  parts.push(
    `<p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;font-family:Inter,Arial,sans-serif;">${escapeHtml(domainLabel)}</p>`
  );

  if (input.showScoreBlock !== false) {
    const hasScore = normalizedScore(ctx.score) != null;
    const scoreText = hasScore
      ? mergeCleexsText(content.scoreLine, ctx)
      : content.scoreMissingLine;
    const accent = scoreAccent(ctx.score);
    parts.push(
      `<p style="margin:0;font-size:28px;line-height:1.2;font-weight:800;color:${accent};font-family:Inter,Arial,sans-serif;letter-spacing:-.5px;">${escapeHtml(scoreText)}</p>`
    );
  }

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
      <tr>
        <td style="padding:18px 20px;">${parts.join('\n')}</td>
      </tr>
    </table>`;
}

function actionLinksHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent): string {
  const rows: string[] = [];

  if (input.showReportLinks !== false && input.links.reportUrl) {
    rows.push(`
      <tr>
        <td style="padding-bottom:10px;">
          <a href="${escapeHtml(input.links.reportUrl)}" style="display:inline-block;font-size:15px;font-weight:600;color:#2563eb;text-decoration:underline;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.reportCtaLabel)}</a>
        </td>
      </tr>`);
  }

  if (input.showReportLinks !== false && input.links.shareUrl) {
    rows.push(`
      <tr>
        <td style="padding-bottom:10px;">
          <a href="${escapeHtml(input.links.shareUrl)}" style="display:inline-block;font-size:15px;font-weight:600;color:#2563eb;text-decoration:underline;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.shareCtaLabel)}</a>
        </td>
      </tr>`);
  }

  if (input.showScoreBlock !== false && input.links.newDiagnosticUrl) {
    rows.push(`
      <tr>
        <td style="padding-top:4px;">
          <a href="${escapeHtml(input.links.newDiagnosticUrl)}" style="display:inline-block;font-size:15px;font-weight:600;color:#475569;text-decoration:underline;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.newDiagnosticCtaLabel)}</a>
          <span style="display:block;margin-top:4px;font-size:12px;color:#94a3b8;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.newDiagnosticHint)}</span>
        </td>
      </tr>`);
  }

  if (!rows.length) return '';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:4px 0 8px;">${rows.join('')}</table>`;
}

export function buildLetterEmail(input: CleexsLetterEmailInput): CleexsEmailBuilt {
  const content = mergeContent(input.content);
  const ctx = input.personalization;
  const assets = resolveCleexsEmailAssets(getAppBaseUrlForPublicLinks(), input.assets);
  const subject = mergeCleexsText(content.subject, ctx);
  const preheader = mergeCleexsText(content.preheader, ctx);
  const postscript = mergeCleexsText(content.postscript, ctx);
  const showFounder = input.showFounderSignature !== false;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:28px 16px;background:#f8fafc;font-family:Georgia,'Times New Roman',Times,serif;color:#1e293b;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;">
          <tr>
            <td style="padding:0 0 20px;">
              <img src="${escapeHtml(assets.logoUrl)}" alt="Cleexs" width="120" style="display:block;width:120px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 24px;">
              ${bodyParagraphsHtml(content.bodyParagraphs, ctx)}
              ${personalizedBlockHtml(input, content, ctx)}
              ${actionLinksHtml(input, content)}
              ${showFounder ? founderSignatureHtml(assets, content.founderTitle) : ''}
              <p style="margin:24px 0 0;font-size:15px;line-height:1.65;color:#475569;font-style:italic;">${escapeHtml(postscript)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0 0;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#0f172a;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.planTitle)}</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#64748b;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.planPitch)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:10px;background:#2563eb;text-align:center;">
                    <a href="${escapeHtml(input.links.plansUrl)}" style="display:block;padding:14px 18px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.planCtaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8;font-family:Inter,Arial,sans-serif;">
              <a href="${escapeHtml(input.links.unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline;">${escapeHtml(content.unsubscribeLabel)}</a><br/>
              Cleexs · visibilidad en IA
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const scoreLine = normalizedScore(ctx.score) != null ? mergeCleexsText(content.scoreLine, ctx) : content.scoreMissingLine;

  const text = [
    subject,
    '',
    ...content.bodyParagraphs.map((p) => mergeCleexsText(p, ctx)),
    '',
    mergeCleexsText(content.exclusiveLabel, ctx),
    scoreLine,
    '',
    input.links.reportUrl ? `${content.reportCtaLabel}: ${input.links.reportUrl}` : '',
    input.links.shareUrl ? `${content.shareCtaLabel}: ${input.links.shareUrl}` : '',
    `${content.newDiagnosticCtaLabel}: ${input.links.newDiagnosticUrl}`,
    '',
    postscript,
    '',
    content.planTitle,
    content.planPitch,
    `${content.planCtaLabel}: ${input.links.plansUrl}`,
    '',
    content.unsubscribeLabel,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text, assets, variant: 'letter' };
}
