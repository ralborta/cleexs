import {
  type CleexsEmailAssets,
  type CleexsEmailBuilt,
  type CleexsEmailLinks,
  type CleexsEmailPersonalization,
  escapeHtml,
  founderSignatureHtml,
  mergeCleexsText,
  normalizeEmailCompetitors,
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
  competitorsSectionLabel: string;
  improvementTipTemplate: string;
  reportCtaLabel: string;
  shareCtaLabel: string;
  newDiagnosticCtaLabel: string;
  newDiagnosticHint: string;
  postscript: string;
  planTitle: string;
  planPriceIntro: string;
  planPriceStrikethrough: string;
  planPriceCurrent: string;
  planBullets: string[];
  planClosingLine: string;
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
  /** Bloque insight (score + competidores + sugerencia). */
  showScoreBlock?: boolean;
  showReportLinks?: boolean;
};

export function defaultCleexsLetterContent(): CleexsLetterContent {
  return {
    subject: 'Le preguntamos 100 veces a ChatGPT',
    preheader: 'Los mismos nombres aparecían una y otra vez.',
    bodyParagraphs: [
      'Esta semana repetimos la misma pregunta decenas de veces. Esperaba respuestas muy distintas. Pero los mismos nombres aparecían una y otra vez.',
      'Parece haber una especie de grupo favorito. Todavía estamos investigando por qué. Pero si esto es así, entrar en ese grupo puede ser extremadamente valioso.',
    ],
    exclusiveLabel: 'Exclusivo para {{domain}}',
    scoreLine: 'Cleexs Score {{score}}',
    scoreMissingLine: 'Score pendiente',
    competitorsSectionLabel: 'Quién compite con vos en las IA',
    improvementTipTemplate:
      'Hoy {{topCompetitor}} aparece más que {{brandName}} en consultas de tu rubro. En tu reporte ves qué señales reforzar en {{domain}} para subir en las recomendaciones.',
    reportCtaLabel: 'Ver mi reporte',
    shareCtaLabel: 'Compartir reporte',
    newDiagnosticCtaLabel: 'Generar nuevo diagnóstico',
    newDiagnosticHint: 'Gratis · unos minutos · solo si vos lo pedís',
    postscript: 'PD: ¿Alguna vez le preguntaste a ChatGPT por empresas de tu industria?',
    planTitle: 'Tu Plan de Ataque para Dominar ChatGPT en 90 días',
    planPriceIntro: 'está listo. Por sólo un único pago de',
    planPriceStrikethrough: '$199',
    planPriceCurrent: '$99 dólares',
    planBullets: [
      'Las 20 acciones con mayor impacto para tu empresa.',
      'Priorizadas por facilidad e impacto.',
      'En el orden exacto en que deberías implementarlas.',
      'Adaptadas a tu industria y a tus competidores.',
      'Con una hoja de ruta semana por semana.',
    ],
    planClosingLine:
      'Plan de acción concreto, para empezar a ejecutar mañana mismo, con el equipo que tenés.',
    planCtaLabel: 'Empezar YA a dominar ChatGPT',
    founderTitle: 'Fundador',
    unsubscribeLabel: 'Dejar de recibir los emails de Cleexs',
  };
}

function mergeContent(overrides?: Partial<CleexsLetterContent>): CleexsLetterContent {
  return { ...defaultCleexsLetterContent(), ...overrides };
}

const letterFont = "Georgia,'Times New Roman',Times,serif";

function bodyParagraphsHtml(paragraphs: string[], ctx: CleexsEmailPersonalization): string {
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#334155;font-family:${letterFont};">${escapeHtml(mergeCleexsText(p, ctx))}</p>`
    )
    .join('\n');
}

function resolveImprovementTip(content: CleexsLetterContent, ctx: CleexsEmailPersonalization): string {
  const custom = (ctx.improvementTip || '').trim();
  if (custom) return mergeCleexsText(custom, ctx);
  return mergeCleexsText(content.improvementTipTemplate, ctx);
}

/** Recuadro útil: score chico + competidores + sugerencia (sin bloque azul pesado). */
function reportInsightBoxHtml(
  input: CleexsLetterEmailInput,
  content: CleexsLetterContent,
  ctx: CleexsEmailPersonalization
): string {
  if (input.showScoreBlock === false) return '';

  const domainLabel = mergeCleexsText(content.exclusiveLabel, ctx);
  const hasScore = normalizedScore(ctx.score) != null;
  const scoreText = hasScore
    ? mergeCleexsText(content.scoreLine, ctx)
    : content.scoreMissingLine;
  const accent = scoreAccent(ctx.score);
  const competitors = normalizeEmailCompetitors(ctx.competitors);
  const tip = resolveImprovementTip(content, ctx);

  const competitorRows =
    competitors.length > 0
      ? competitors
          .map((c) => {
            const scoreSuffix =
              c.score != null && Number.isFinite(c.score)
                ? ` <span style="color:#94a3b8;font-weight:400;">(${Math.round(c.score)})</span>`
                : '';
            return `<li style="margin:0 0 6px;font-size:14px;line-height:1.45;color:#475569;">${escapeHtml(c.name)}${scoreSuffix}</li>`;
          })
          .join('')
      : `<li style="margin:0;font-size:14px;line-height:1.45;color:#94a3b8;font-style:italic;">Ver competidores en tu reporte</li>`;

  const reportLink =
    input.links.reportUrl && input.showReportLinks !== false
      ? `<p style="margin:14px 0 0;">
          <a href="${escapeHtml(input.links.reportUrl)}" style="font-size:14px;font-weight:600;color:#2563eb;text-decoration:underline;font-family:${letterFont};">${escapeHtml(content.reportCtaLabel)} →</a>
        </p>`
      : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 0;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;box-shadow:0 1px 3px rgba(15,23,42,.04);">
      <tr>
        <td style="padding:16px 18px;font-family:${letterFont};">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(domainLabel)}</p>
          <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:${hasScore ? accent : '#64748b'};">${escapeHtml(scoreText)}</p>
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#64748b;">${escapeHtml(content.competitorsSectionLabel)}</p>
          <ul style="margin:0 0 14px;padding:0 0 0 18px;list-style:disc;">${competitorRows}</ul>
          <p style="margin:0;padding:12px 14px;border-radius:8px;background:#f8fafc;border-left:3px solid #cbd5e1;font-size:13px;line-height:1.6;color:#475569;">
            <span style="font-weight:600;color:#334155;">Sugerencia.</span> ${escapeHtml(tip)}
          </p>
          ${reportLink}
        </td>
      </tr>
    </table>`;
}

function secondaryLinksHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent): string {
  if (input.showReportLinks === false) return '';

  const links: string[] = [];
  if (input.links.shareUrl) {
    links.push(
      `<a href="${escapeHtml(input.links.shareUrl)}" style="color:#94a3b8;text-decoration:underline;">${escapeHtml(content.shareCtaLabel)}</a>`
    );
  }
  if (input.showScoreBlock !== false && input.links.newDiagnosticUrl) {
    links.push(
      `<a href="${escapeHtml(input.links.newDiagnosticUrl)}" style="color:#94a3b8;text-decoration:underline;">${escapeHtml(content.newDiagnosticCtaLabel)}</a>`
    );
  }

  if (!links.length) return '';
  const hint =
    input.showScoreBlock !== false && input.links.newDiagnosticUrl
      ? `<span style="display:block;margin-top:6px;font-size:11px;color:#cbd5e1;font-family:${letterFont};">${escapeHtml(content.newDiagnosticHint)}</span>`
      : '';

  return `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;font-family:${letterFont};">${links.join(' · ')}${hint}</p>`;
}

function planSalesBlockHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent): string {
  const bullets = content.planBullets
    .map(
      (b) =>
        `<tr>
          <td style="padding:0 0 8px;vertical-align:top;width:22px;font-size:14px;line-height:1.5;color:#059669;">✓</td>
          <td style="padding:0 0 8px;font-size:14px;line-height:1.55;color:#475569;font-family:${letterFont};">${escapeHtml(b)}</td>
        </tr>`
    )
    .join('');

  return `
    <tr>
      <td style="padding:28px 0 0;border-top:1px solid #e2e8f0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dbeafe;border-radius:12px;background:linear-gradient(180deg,#f8fafc 0%,#ffffff 100%);">
          <tr>
            <td style="padding:20px 18px;font-family:${letterFont};">
              <p style="margin:0 0 10px;font-size:17px;font-weight:700;line-height:1.35;color:#0f172a;text-decoration:underline;text-underline-offset:3px;">${escapeHtml(content.planTitle)}</p>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#64748b;">
                ${escapeHtml(content.planPriceIntro)}
                <span style="text-decoration:line-through;color:#94a3b8;">${escapeHtml(content.planPriceStrikethrough)}</span>
                <strong style="color:#0f172a;"> ${escapeHtml(content.planPriceCurrent)}</strong> accedés a:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 14px;width:100%;">${bullets}</table>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#64748b;font-style:italic;">${escapeHtml(content.planClosingLine)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:10px;background:#2563eb;text-align:center;">
                    <a href="${escapeHtml(input.links.plansUrl)}" style="display:block;padding:13px 16px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.planCtaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function buildLetterEmail(input: CleexsLetterEmailInput): CleexsEmailBuilt {
  const content = mergeContent(input.content);
  const ctx = input.personalization;
  const assets = resolveCleexsEmailAssets(getAppBaseUrlForPublicLinks(), input.assets);
  const subject = mergeCleexsText(content.subject, ctx);
  const preheader = mergeCleexsText(content.preheader, ctx);
  const postscript = mergeCleexsText(content.postscript, ctx);
  const showFounder = input.showFounderSignature !== false;
  const competitors = normalizeEmailCompetitors(ctx.competitors);
  const tip = resolveImprovementTip(content, ctx);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:28px 16px;background:#f8fafc;font-family:${letterFont};color:#1e293b;">
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
              ${showFounder ? founderSignatureHtml(assets, content.founderTitle) : ''}
              ${reportInsightBoxHtml(input, content, ctx)}
              ${secondaryLinksHtml(input, content)}
              <p style="margin:24px 0 0;font-size:15px;line-height:1.65;color:#475569;font-style:italic;font-family:${letterFont};">${escapeHtml(postscript)}</p>
            </td>
          </tr>
          ${planSalesBlockHtml(input, content)}
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
    content.competitorsSectionLabel,
    ...competitors.map((c) => `- ${c.name}${c.score != null ? ` (${Math.round(c.score)})` : ''}`),
    `Sugerencia: ${tip}`,
    input.links.reportUrl ? `${content.reportCtaLabel}: ${input.links.reportUrl}` : '',
    input.links.shareUrl ? `${content.shareCtaLabel}: ${input.links.shareUrl}` : '',
    input.links.newDiagnosticUrl ? `${content.newDiagnosticCtaLabel}: ${input.links.newDiagnosticUrl}` : '',
    '',
    postscript,
    '',
    content.planTitle,
    `${content.planPriceIntro} ${content.planPriceStrikethrough} ${content.planPriceCurrent}`,
    ...content.planBullets.map((b) => `• ${b}`),
    content.planClosingLine,
    `${content.planCtaLabel}: ${input.links.plansUrl}`,
    '',
    content.unsubscribeLabel,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text, assets, variant: 'letter' };
}
