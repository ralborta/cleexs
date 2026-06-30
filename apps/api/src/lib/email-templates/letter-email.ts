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

function planBulletDotHtml(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0"><tr>
    <td width="16" height="16" align="center" valign="middle" style="width:16px;height:16px;border-radius:50%;background:#2563eb;">
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td width="6" height="6" style="width:6px;height:6px;border-radius:50%;background:#ffffff;font-size:0;line-height:0;">&nbsp;</td>
      </tr></table>
    </td>
  </tr></table>`;
}

function planShieldIconHtml(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0"><tr>
    <td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;border-radius:9px;background:#1d4ed8;color:#ffffff;font-size:16px;line-height:34px;">&#9819;</td>
  </tr></table>`;
}

function planSalesBlockHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent): string {
  const bulletRows = content.planBullets
    .map(
      (b) =>
        `<tr>
          <td width="24" valign="top" style="padding:0 10px 10px 0;">${planBulletDotHtml()}</td>
          <td valign="top" style="padding:0 0 10px;font-size:14px;line-height:1.55;color:#f8fafc;font-family:${letterFont};">${escapeHtml(b)}</td>
        </tr>`
    )
    .join('');

  return `
    <tr>
      <td style="padding:32px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:14px;overflow:hidden;border:1px solid #1e3a8a;box-shadow:0 14px 36px rgba(15,23,42,.2);">
          <tr>
            <td style="padding:14px 18px;background:#2563eb;font-family:${letterFont};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="1" valign="middle" style="white-space:nowrap;padding-right:10px;">
                    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                      <td valign="middle" style="padding-right:8px;">${planShieldIconHtml()}</td>
                      <td valign="middle" style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#dbeafe;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.planBadgeLabel)}</td>
                    </tr></table>
                  </td>
                  <td width="1" valign="middle" style="padding:0 14px;">
                    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                      <td width="1" style="width:1px;height:34px;background:rgba(255,255,255,.35);font-size:0;line-height:0;">&nbsp;</td>
                    </tr></table>
                  </td>
                  <td valign="middle" style="font-size:19px;font-weight:700;line-height:1.3;color:#ffffff;">${escapeHtml(content.planTitle)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 18px 18px;background:#0b1220;font-family:${letterFont};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="30%" valign="top" style="padding-right:16px;border-right:1px solid #1e293b;">
                    <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#cbd5e1;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.planPriceIntro)}</p>
                    <p style="margin:0 0 2px;font-size:13px;line-height:1.4;color:#64748b;font-family:Inter,Arial,sans-serif;">
                      <span style="text-decoration:line-through;">${escapeHtml(content.planPriceStrikethrough)}</span>
                    </p>
                    <p style="margin:0 0 8px;font-size:28px;font-weight:800;line-height:1.1;color:#60a5fa;font-family:Inter,Arial,sans-serif;letter-spacing:-.5px;">${escapeHtml(content.planPriceCurrent)}</p>
                    <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#cbd5e1;font-family:Inter,Arial,sans-serif;">${escapeHtml(content.planPriceSuffix)}</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
                      <td style="height:1px;background:#1e293b;font-size:0;line-height:0;">&nbsp;</td>
                    </tr></table>
                  </td>
                  <td width="70%" valign="top" style="padding-left:18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:12px;">${bulletRows}</table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td valign="bottom" style="padding-right:12px;">
                          <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;font-style:italic;">${escapeHtml(content.planClosingLine)}</p>
                        </td>
                        <td width="1" valign="bottom" align="right" style="white-space:nowrap;">
                          <table role="presentation" cellspacing="0" cellpadding="0" align="right">
                            <tr>
                              <td style="border-radius:10px;background:#2563eb;text-align:center;">
                                <a href="${escapeHtml(input.links.plansUrl)}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Inter,Arial,sans-serif;white-space:nowrap;">${escapeHtml(content.planCtaLabel)} &#8594;</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
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
