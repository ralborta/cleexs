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
  /** Mini sección educativa antes de la firma (Click / Cleexs Score). */
  scoreTipsTitle: string;
  scoreTipsParagraphs: string[];
  scoreTipsReportCta: string;
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
  /** Bloque educativo personalizado antes de la firma. */
  showScoreTipsBlock?: boolean;
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
    scoreTipsTitle: 'Sacándole jugo a tu Cleexs Score',
    scoreTipsParagraphs: [
      'Tu score mide qué tan seguido {{brandName}} aparece cuando alguien le pide a ChatGPT, Claude, Gemini o Perplexity que recomienden opciones como la tuya. No es tráfico web: es visibilidad dentro de las respuestas.',
      'En tu reporte ves en qué consultas aparecés, quién ocupa tu lugar y qué señales podés reforzar en {{domain}} para subir ese número.',
    ],
    scoreTipsReportCta: 'Ver mi reporte completo',
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

function scoreTipsIllustrationHtml(ctx: CleexsEmailPersonalization): string {
  const brand = escapeHtml((ctx.brandName || ctx.domain || 'Tu marca').trim());
  const domain = escapeHtml((ctx.domain || 'tu-sitio.com').trim());
  const score = normalizedScore(ctx.score);
  const scoreLabel =
    score != null ? `Cleexs Score ${score}` : 'Cleexs Score pendiente';
  const accent = scoreAccent(ctx.score);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);border-radius:12px 12px 0 0;">
      <tr>
        <td style="padding:20px 16px 8px;font-family:Inter,Arial,sans-serif;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#93c5fd;">${domain}</p>
          <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;">${scoreLabel}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:8px 16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:320px;background:#ffffff;border-radius:12px;box-shadow:0 16px 32px rgba(0,0,0,.22);">
            <tr>
              <td style="padding:12px;font-family:Inter,Arial,sans-serif;">
                <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                  <td width="7" height="7" style="background:#cbd5e1;border-radius:50%;"></td>
                  <td width="5"></td>
                  <td width="7" height="7" style="background:#cbd5e1;border-radius:50%;"></td>
                  <td width="5"></td>
                  <td width="7" height="7" style="background:#cbd5e1;border-radius:50%;"></td>
                </tr></table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
                  <tr><td style="padding:10px;">
                    <strong style="display:block;color:#64748b;font-size:11px;margin-bottom:4px;">Respuesta de IA</strong>
                    <div style="height:6px;border-radius:999px;background:#e2e8f0;margin:5px 0;"></div>
                    <div style="height:6px;width:75%;border-radius:999px;background:#e2e8f0;margin:5px 0;"></div>
                  </td></tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;">
                  <tr><td style="padding:10px;">
                    <strong style="display:block;color:#1d4ed8;font-size:11px;margin-bottom:4px;">Proveedor recomendado</strong>
                    <p style="margin:0;font-size:13px;font-weight:700;color:${accent};">${brand}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#64748b;">${domain}</p>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function scoreTipsBlockHtml(
  input: CleexsLetterEmailInput,
  content: CleexsLetterContent,
  ctx: CleexsEmailPersonalization
): string {
  if (input.showScoreTipsBlock === false) return '';

  const title = mergeCleexsText(content.scoreTipsTitle, ctx);
  const paragraphs = content.scoreTipsParagraphs
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#475569;font-family:Inter,Arial,sans-serif;">${escapeHtml(mergeCleexsText(p, ctx))}</p>`
    )
    .join('\n');

  const reportCta =
    input.links.reportUrl && input.showReportLinks !== false
      ? `<p style="margin:14px 0 0;">
          <a href="${escapeHtml(input.links.reportUrl)}" style="font-size:14px;font-weight:700;color:#2563eb;text-decoration:underline;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.scoreTipsReportCta)} →</a>
        </p>`
      : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
      <tr><td style="padding:0;">${scoreTipsIllustrationHtml(ctx)}</td></tr>
      <tr>
        <td style="padding:20px 18px 18px;font-family:Georgia,'Times New Roman',Times,serif;">
          <h3 style="margin:0 0 12px;font-size:18px;line-height:1.35;color:#0f172a;font-weight:700;">${escapeHtml(title)}</h3>
          ${paragraphs}
          ${reportCta}
        </td>
      </tr>
    </table>`;
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
              ${scoreTipsBlockHtml(input, content, ctx)}
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
    mergeCleexsText(content.scoreTipsTitle, ctx),
    ...content.scoreTipsParagraphs.map((p) => mergeCleexsText(p, ctx)),
    input.links.reportUrl ? `${content.scoreTipsReportCta}: ${input.links.reportUrl}` : '',
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
