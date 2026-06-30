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
  scoreBenchmarkBadge: string;
  scoreLabelText: string;
  scoreMissingLine: string;
  rivalsLabel: string;
  signalTemplate: string;
  actionTemplate: string;
  reportCtaLabel: string;
  shareCtaLabel: string;
  newDiagnosticCtaLabel: string;
  newDiagnosticHint: string;
  postscript: string;
  planTitle: string;
  planBadgeLabel: string;
  planPriceIntro: string;
  planPriceStrikethrough: string;
  planPriceCurrent: string;
  planPriceSuffix: string;
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
    scoreBenchmarkBadge: 'Benchmark del rubro',
    scoreLabelText: 'Cleexs Score',
    scoreMissingLine: '—',
    rivalsLabel: 'Rivales detectados:',
    signalTemplate: 'Hoy {{topCompetitor}} aparece más que {{brandName}} en consultas del rubro.',
    actionTemplate: 'Reforzar señales en {{domain}} para subir recomendaciones.',
    reportCtaLabel: 'Ver reporte',
    shareCtaLabel: 'Compartir reporte',
    newDiagnosticCtaLabel: 'Generar nuevo diagnóstico',
    newDiagnosticHint: 'Gratis · unos minutos · solo si vos lo pedís',
    postscript: 'PD: ¿Alguna vez le preguntaste a ChatGPT por empresas de tu industria?',
    planTitle: 'Plan de Ataque: domina ChatGPT en 90 días',
    planBadgeLabel: 'PLAN CONQUISTAR',
    planPriceIntro: 'Por un único pago de',
    planPriceStrikethrough: '$199',
    planPriceCurrent: 'USD 99',
    planPriceSuffix: 'dólares accedés a:',
    planBullets: [
      'Las 20 acciones con mayor impacto para tu empresa.',
      'Priorizadas por facilidad e impacto.',
      'En el orden exacto de implementación.',
      'Adaptadas a tu industria y competidores.',
      'Hoja de ruta semana por semana.',
    ],
    planClosingLine: 'Plan de acción concreto para empezar mañana con tu equipo.',
    planCtaLabel: 'Empezar ahora',
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

function resolveSignalLine(content: CleexsLetterContent, ctx: CleexsEmailPersonalization): string {
  return mergeCleexsText(content.signalTemplate, ctx);
}

function resolveActionLine(content: CleexsLetterContent, ctx: CleexsEmailPersonalization): string {
  const custom = (ctx.improvementTip || '').trim();
  if (custom) return mergeCleexsText(custom, ctx);
  return mergeCleexsText(content.actionTemplate, ctx);
}

function insightBulletHtml(label: string, text: string): string {
  return `<tr>
    <td valign="top" width="14" style="padding:0 8px 10px 0;font-size:14px;line-height:1.5;color:#2563eb;font-family:Inter,Arial,sans-serif;">&#8226;</td>
    <td valign="top" style="padding:0 0 10px;font-size:13px;line-height:1.55;color:#475569;font-family:Inter,Arial,sans-serif;">
      <strong style="color:#334155;">${escapeHtml(label)}</strong> ${escapeHtml(text)}
    </td>
  </tr>`;
}

/** Tarjeta horizontal: score | insight | CTA reporte. */
function reportInsightBoxHtml(
  input: CleexsLetterEmailInput,
  content: CleexsLetterContent,
  ctx: CleexsEmailPersonalization
): string {
  if (input.showScoreBlock === false) return '';

  const hasScore = normalizedScore(ctx.score) != null;
  const scoreNum = hasScore ? String(normalizedScore(ctx.score)) : content.scoreMissingLine;
  const accent = scoreAccent(ctx.score);
  const competitors = normalizeEmailCompetitors(ctx.competitors);
  const rivalNames =
    competitors.length > 0
      ? competitors.map((c) => c.name).join(', ')
      : 'ver en tu reporte';
  const signal = resolveSignalLine(content, ctx);
  const action = resolveActionLine(content, ctx);

  const reportCta =
    input.links.reportUrl && input.showReportLinks !== false
      ? `<a href="${escapeHtml(input.links.reportUrl)}" style="font-size:14px;font-weight:700;color:#2563eb;text-decoration:none;font-family:Inter,Arial,sans-serif;white-space:nowrap;">${escapeHtml(content.reportCtaLabel)} &#8250;</a>`
      : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <tr>
        <td width="26%" valign="top" style="padding:16px 14px;border-right:1px solid #f1f5f9;font-family:Inter,Arial,sans-serif;">
          <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#eff6ff;color:#2563eb;font-size:10px;font-weight:700;letter-spacing:.02em;">${escapeHtml(content.scoreBenchmarkBadge)}</span>
          <p style="margin:10px 0 4px;font-size:12px;color:#64748b;">${escapeHtml(content.scoreLabelText)}</p>
          <p style="margin:0;font-size:40px;font-weight:800;line-height:1;color:${hasScore ? accent : '#94a3b8'};letter-spacing:-1px;">${escapeHtml(scoreNum)}</p>
        </td>
        <td width="54%" valign="top" style="padding:16px 14px;border-right:1px solid #f1f5f9;">
          <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
            ${insightBulletHtml(content.rivalsLabel, rivalNames)}
            ${insightBulletHtml('Señal:', signal)}
            ${insightBulletHtml('Acción sugerida:', action)}
          </table>
        </td>
        <td width="20%" valign="middle" align="center" style="padding:16px 10px;text-align:center;">
          ${reportCta}
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

  return `<p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#cbd5e1;font-family:${letterFont};">${links.join(' · ')}${hint}</p>`;
}

function planCheckIconHtml(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0"><tr>
    <td width="24" height="24" align="center" valign="middle" style="width:24px;height:24px;border-radius:50%;background:#2563eb;color:#ffffff;font-size:13px;font-weight:700;font-family:Inter,Arial,sans-serif;line-height:24px;">✓</td>
  </tr></table>`;
}

function planSalesBlockHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent): string {
  const bullets = content.planBullets
    .map((b, i) => {
      const border =
        i < content.planBullets.length - 1 ? 'border-bottom:1px solid #1e293b;' : '';
      return `<tr>
        <td colspan="2" style="padding:14px 0;${border}">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td width="36" valign="top" style="padding-right:10px;">${planCheckIconHtml()}</td>
              <td valign="top" style="font-size:15px;line-height:1.55;color:#e2e8f0;font-family:${letterFont};">${escapeHtml(b)}</td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  return `
    <tr>
      <td style="padding:32px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:16px;overflow:hidden;border:1px solid #1e3a8a;box-shadow:0 16px 40px rgba(15,23,42,.22);">
          <tr>
            <td style="padding:24px 24px 20px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 55%,#1e40af 100%);font-family:${letterFont};">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#dbeafe;font-family:Inter,Arial,sans-serif;">
                <span style="font-size:13px;margin-right:6px;">&#9819;</span>${escapeHtml(content.planBadgeLabel)}
              </p>
              <p style="margin:0;font-size:22px;font-weight:700;line-height:1.3;color:#ffffff;">${escapeHtml(content.planTitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 24px;background:#0b1220;font-family:${letterFont};">
              <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#94a3b8;font-family:Inter,Arial,sans-serif;">
                ${escapeHtml(content.planPriceIntro)}
                <span style="text-decoration:line-through;color:#64748b;">${escapeHtml(content.planPriceStrikethrough)}</span>
                <strong style="color:#60a5fa;font-size:20px;font-weight:800;"> ${escapeHtml(content.planPriceCurrent)}</strong>
                ${escapeHtml(content.planPriceSuffix)}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 18px;">${bullets}</table>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#94a3b8;font-style:italic;">
                <span style="margin-right:6px;">&#128640;</span>${escapeHtml(content.planClosingLine)}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:12px;background:#ffffff;text-align:center;">
                    <a href="${escapeHtml(input.links.plansUrl)}" style="display:block;padding:16px 20px;font-size:16px;font-weight:800;color:#1d4ed8;text-decoration:none;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.planCtaLabel)} &#8594;</a>
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
  const signal = resolveSignalLine(content, ctx);
  const action = resolveActionLine(content, ctx);

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

  const scoreLine = normalizedScore(ctx.score) != null ? String(normalizedScore(ctx.score)) : content.scoreMissingLine;

  const text = [
    subject,
    '',
    ...content.bodyParagraphs.map((p) => mergeCleexsText(p, ctx)),
    '',
    `${content.scoreLabelText}: ${scoreLine}`,
    `${content.rivalsLabel} ${competitors.map((c) => c.name).join(', ')}`,
    `Señal: ${signal}`,
    `Acción sugerida: ${action}`,
    input.links.reportUrl ? `${content.reportCtaLabel}: ${input.links.reportUrl}` : '',
    input.links.shareUrl ? `${content.shareCtaLabel}: ${input.links.shareUrl}` : '',
    input.links.newDiagnosticUrl ? `${content.newDiagnosticCtaLabel}: ${input.links.newDiagnosticUrl}` : '',
    '',
    postscript,
    '',
    content.planTitle,
    `${content.planPriceIntro} ${content.planPriceStrikethrough} ${content.planPriceCurrent} ${content.planPriceSuffix}`,
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
