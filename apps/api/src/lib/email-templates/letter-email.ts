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
        `<p style="margin:0 0 18px;font-size:17px;line-height:1.8;color:#1e293b;font-family:${letterFont};">${escapeHtml(mergeCleexsText(p, ctx))}</p>`
    )
    .join('\n');
}

function resolveImprovementTip(content: CleexsLetterContent, ctx: CleexsEmailPersonalization): string {
  const custom = (ctx.improvementTip || '').trim();
  if (custom) return mergeCleexsText(custom, ctx);
  return mergeCleexsText(content.improvementTipTemplate, ctx);
}

/** Dato del reporte: secundario, compacto, sin robar foco al mensaje ni al plan. */
function reportInsightBoxHtml(
  input: CleexsLetterEmailInput,
  content: CleexsLetterContent,
  ctx: CleexsEmailPersonalization
): string {
  if (input.showScoreBlock === false) return '';

  const hasScore = normalizedScore(ctx.score) != null;
  const scoreText = hasScore
    ? mergeCleexsText(content.scoreLine, ctx)
    : content.scoreMissingLine;
  const competitors = normalizeEmailCompetitors(ctx.competitors);
  const tip = resolveImprovementTip(content, ctx);
  const competitorNames =
    competitors.length > 0
      ? competitors.map((c) => c.name).join(', ')
      : 'ver en tu reporte';

  const reportInline =
    input.links.reportUrl && input.showReportLinks !== false
      ? ` <a href="${escapeHtml(input.links.reportUrl)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(content.reportCtaLabel)}</a>`
      : '';

  return `
    <p style="margin:16px 0 0;padding-top:14px;border-top:1px solid #f1f5f9;font-size:12px;line-height:1.6;color:#94a3b8;font-family:${letterFont};">
      <span style="color:#64748b;">${escapeHtml(scoreText)}</span>
      · ${escapeHtml(competitorNames)}
      · ${escapeHtml(tip)}${reportInline}
    </p>`;
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

  return `<p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1;font-family:${letterFont};">${links.join(' · ')}${hint}</p>`;
}

function planSalesBlockHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent): string {
  const bullets = content.planBullets
    .map(
      (b) =>
        `<tr>
          <td style="padding:0 0 10px;vertical-align:top;width:24px;font-size:15px;line-height:1.45;color:#34d399;font-weight:700;">✓</td>
          <td style="padding:0 0 10px;font-size:15px;line-height:1.55;color:#e2e8f0;font-family:${letterFont};">${escapeHtml(b)}</td>
        </tr>`
    )
    .join('');

  return `
    <tr>
      <td style="padding:32px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;overflow:hidden;border:2px solid #2563eb;box-shadow:0 12px 32px rgba(37,99,235,.18);">
          <tr>
            <td style="padding:22px 22px 18px;background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);font-family:${letterFont};">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#93c5fd;">Plan Conquistar</p>
              <p style="margin:0;font-size:20px;font-weight:700;line-height:1.35;color:#ffffff;">${escapeHtml(content.planTitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 22px 22px;background:#0f172a;font-family:${letterFont};">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#cbd5e1;">
                ${escapeHtml(content.planPriceIntro)}
                <span style="text-decoration:line-through;color:#64748b;">${escapeHtml(content.planPriceStrikethrough)}</span>
                <strong style="color:#ffffff;font-size:18px;"> ${escapeHtml(content.planPriceCurrent)}</strong> accedés a:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;width:100%;">${bullets}</table>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#94a3b8;font-style:italic;">${escapeHtml(content.planClosingLine)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:12px;background:#ffffff;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.2);">
                    <a href="${escapeHtml(input.links.plansUrl)}" style="display:block;padding:16px 20px;font-size:16px;font-weight:800;color:#1e3a8a;text-decoration:none;font-family:Inter,Arial,sans-serif;letter-spacing:-.2px;">${escapeHtml(content.planCtaLabel)} →</a>
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
            <td style="padding:0 0 16px;">
              <img src="${escapeHtml(assets.logoUrl)}" alt="Cleexs" width="96" style="display:block;width:96px;height:auto;border:0;opacity:.9;" />
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
