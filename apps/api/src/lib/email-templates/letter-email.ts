import {
  CLEEXS_EMAIL_FONT,
  brandAccentFromDomain,
  escapeHtml,
  founderSignatureHtml,
  mergeCleexsText,
  normalizeEmailCompetitors,
  normalizedScore,
  resolveCleexsEmailAssets,
  softBrandBg,
} from './shared';
import { getAppBaseUrlForPublicLinks } from '../app-public-url';
import { buildLogoDevUrl, normalizeBrandAssetDomain } from '../brand-assets';
import type {
  CleexsEmailAssets,
  CleexsEmailBuilt,
  CleexsEmailLinks,
  CleexsEmailPersonalization,
} from './shared';

export type CleexsLetterContent = {
  subject: string;
  preheader: string;
  bodyParagraphs: string[];
  exclusiveLabel: string;
  scoreBenchmarkBadge: string;
  scoreLabelText: string;
  scoreMissingLine: string;
  rivalsLabel: string;
  /** Etiqueta del bullet de insight (default «Señal:»). */
  signalLabel: string;
  signalTemplate: string;
  /** Etiqueta del bullet de acción (default «Acción sugerida:»). */
  actionLabel: string;
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
      'Esta semana repetimos la misma pregunta decenas de veces. Esperábamos respuestas muy distintas. Pero los mismos nombres aparecían una y otra vez.',
      'Parece haber una especie de grupo favorito. Todavía estamos investigando por qué. Pero si esto es así, entrar en ese grupo puede ser extremadamente valioso.',
    ],
    exclusiveLabel: 'Exclusivo para {{domain}}',
    scoreBenchmarkBadge: 'Benchmark del rubro',
    scoreLabelText: 'Cleexs Score',
    scoreMissingLine: '—',
    rivalsLabel: 'Rivales detectados:',
    signalLabel: 'Señal:',
    signalTemplate: 'Hoy {{topCompetitor}} aparece más que {{brandName}} en consultas del rubro.',
    actionLabel: 'Acción sugerida:',
    actionTemplate: 'Reforzar señales en {{domain}} para subir recomendaciones.',
    reportCtaLabel: 'Ver reporte',
    shareCtaLabel: 'Compartir reporte',
    newDiagnosticCtaLabel: 'Generar nuevo diagnóstico',
    newDiagnosticHint: 'Gratis · tarda unos minutos · solo si vos lo pedís',
    postscript: 'PD: ¿Alguna vez le preguntaste a ChatGPT por empresas de tu industria?',
    planTitle: 'Plan de ataque para dominar ChatGPT en 90 días',
    planBadgeLabel: '',
    /** @deprecated Ya no se muestra en la caja (pitch sin precio). */
    planPriceIntro: '',
    planPriceStrikethrough: '',
    planPriceCurrent: '',
    planPriceSuffix: '',
    planBullets: [
      'Acciones prioritarias para tu empresa',
      'Impacto alto en recomendaciones de IA',
      'Hoja de ruta de 90 días',
    ],
    planClosingLine: 'Tu Plan de Ataque personalizado está listo.',
    planCtaLabel: 'Empezar a conseguir clientes desde ChatGPT',
    founderTitle: 'Fundador',
    unsubscribeLabel: 'Dejar de recibir emails',
  };
}

function mergeContent(overrides?: Partial<CleexsLetterContent>): CleexsLetterContent {
  return { ...defaultCleexsLetterContent(), ...overrides };
}

const letterFont = CLEEXS_EMAIL_FONT;
const uiFont = CLEEXS_EMAIL_FONT;

function bodyParagraphsHtml(paragraphs: string[], ctx: CleexsEmailPersonalization): string {
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 20px;font-size:19px;line-height:1.85;color:#1e293b;font-family:${letterFont};">${escapeHtml(mergeCleexsText(p, ctx))}</p>`
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

function insightLineHtml(label: string, text: string): string {
  return `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#475569;font-family:${uiFont};">
    <strong style="color:#1e293b;">${escapeHtml(label)}</strong> ${escapeHtml(text)}
  </p>`;
}

function primaryButtonHtml(href: string, label: string, accent: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" align="right">
      <tr>
        <td style="border-radius:10px;background:${accent};text-align:center;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 16px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;font-family:${uiFont};white-space:nowrap;">${escapeHtml(label)} &#8594;</a>
        </td>
      </tr>
    </table>`;
}

function secondaryLinksHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent, accent: string): string {
  if (input.showReportLinks === false) return '';

  const links: string[] = [];
  if (input.links.shareUrl) {
    links.push(
      `<a href="${escapeHtml(input.links.shareUrl)}" style="color:${accent};text-decoration:none;font-weight:600;font-family:${uiFont};">${escapeHtml(content.shareCtaLabel)}</a>`
    );
  }
  if (input.showScoreBlock !== false && input.links.newDiagnosticUrl) {
    links.push(
      `<a href="${escapeHtml(input.links.newDiagnosticUrl)}" style="color:${accent};text-decoration:none;font-weight:600;font-family:${uiFont};">${escapeHtml(content.newDiagnosticCtaLabel)}</a>`
    );
  }

  if (!links.length) return '';
  const hint =
    input.showScoreBlock !== false && input.links.newDiagnosticUrl
      ? `<span style="display:block;margin-top:6px;font-size:11px;color:#94a3b8;font-family:${uiFont};">${escapeHtml(content.newDiagnosticHint)}</span>`
      : '';

  return `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${accent};font-family:${uiFont};">${links.join(' · ')}${hint}</p>`;
}

/**
 * Una sola pieza: score/rivales (colores marca) + Plan listo con stats y carátula.
 * Replica el mock aprobado (email-safe con tablas; sin CSS 3D real).
 */
function planAndScoreBlockHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent): string {
  const ctx = input.personalization;
  const domain = (ctx.domain || ctx.brandName || 'tu marca').trim();
  const brand = (ctx.brandName || domain).trim();
  const accent = brandAccentFromDomain(domain);
  const soft = softBrandBg(accent);
  const softBorder = `${accent}33`;
  const actionsLabel =
    ctx.actionsCount != null && Number.isFinite(ctx.actionsCount) && ctx.actionsCount > 0
      ? String(Math.round(ctx.actionsCount))
      : '—';

  const hasScore = normalizedScore(ctx.score) != null;
  const scoreNum = hasScore ? String(normalizedScore(ctx.score)) : content.scoreMissingLine;
  const competitors = normalizeEmailCompetitors(ctx.competitors);
  const rivalNames =
    competitors.length > 0 ? competitors.map((c) => c.name).join(', ') : 'ver en tu reporte';
  const signal = resolveSignalLine(content, ctx);
  const action = resolveActionLine(content, ctx);

  const base = getAppBaseUrlForPublicLinks().replace(/\/+$/, '');
  const normalizedDomain = normalizeBrandAssetDomain(domain) || domain;
  const brandLogo =
    buildLogoDevUrl(normalizedDomain, 128) ||
    (normalizedDomain === 'nintendo.com' ? `${base}/brand-logos/nintendo.png` : null);
  const generatedAt = new Date()
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();

  const scoreStrip =
    input.showScoreBlock === false
      ? ''
      : `
          <tr>
            <td style="padding:16px 18px;background:${soft};border-bottom:1px solid ${softBorder};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="110" valign="top" style="padding-right:14px;">
                    <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${accent}22;color:${accent};font-size:10px;font-weight:700;font-family:${uiFont};">${escapeHtml(content.scoreBenchmarkBadge)}</span>
                    <p style="margin:10px 0 0;font-size:12px;color:#64748b;font-family:${uiFont};">${escapeHtml(content.scoreLabelText)}</p>
                    <p style="margin:4px 0 0;font-size:40px;line-height:1;font-weight:900;color:${accent};font-family:${uiFont};letter-spacing:-1.5px;">${escapeHtml(scoreNum)}</p>
                    <p style="margin:4px 0 0;font-size:11px;font-weight:700;color:#64748b;font-family:${uiFont};">de 100</p>
                  </td>
                  <td valign="top">
                    ${insightLineHtml(content.rivalsLabel, rivalNames)}
                    ${insightLineHtml(content.signalLabel, signal)}
                    ${insightLineHtml(content.actionLabel, action)}
                    ${
                      input.links.reportUrl && input.showReportLinks !== false
                        ? `<div style="margin-top:10px;text-align:right;">${primaryButtonHtml(input.links.reportUrl, content.reportCtaLabel, accent)}</div>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  const logoBlock = brandLogo
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 14px;">
        <tr>
          <td style="padding:10px;border-radius:16px;background:${accent};">
            <table role="presentation" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;">
              <tr>
                <td style="padding:8px;">
                  <img src="${escapeHtml(brandLogo)}" alt="${escapeHtml(brand)}" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:contain;border:0;border-radius:8px;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : '';

  const statCard = (value: string, top: string, bottom: string, icon: string) => `
    <td width="33%" valign="top" style="padding:6px 4px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #f1f5f9;border-radius:14px;background:#ffffff;">
        <tr>
          <td align="center" style="padding:14px 8px;">
            <div style="font-size:18px;line-height:1;color:${accent};">${icon}</div>
            <div style="margin-top:8px;font-size:22px;font-weight:900;color:${accent};font-family:${uiFont};line-height:1;">${escapeHtml(value)}</div>
            <div style="margin-top:6px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#0f172a;font-family:${uiFont};">${escapeHtml(top)}</div>
            <div style="font-size:11px;color:#64748b;font-family:${uiFont};">${escapeHtml(bottom)}</div>
          </td>
        </tr>
      </table>
    </td>`;

  const bookCover = `
    <table role="presentation" width="220" cellspacing="0" cellpadding="0" align="center" style="border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 18px 40px rgba(15,23,42,.22);">
      <tr>
        <td style="padding:18px 14px 16px;background:${accent};text-align:center;">
          ${
            brandLogo
              ? `<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 12px;background:#ffffff;border-radius:8px;">
                  <tr><td style="padding:6px 10px;">
                    <img src="${escapeHtml(brandLogo)}" alt="${escapeHtml(brand)}" width="36" height="36" style="display:block;width:36px;height:36px;object-fit:contain;border:0;" />
                  </td></tr>
                </table>`
              : ''
          }
          <p style="margin:0;font-size:11px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;color:#ffffff;line-height:1.35;font-family:${uiFont};">${escapeHtml(content.planTitle)}</p>
          <p style="margin:12px 0 0;">
            <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#ffffff;color:${accent};font-size:10px;font-weight:900;font-family:${uiFont};">${escapeHtml(domain)}</span>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 12px 12px;background:#ffffff;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td width="33%" align="center" style="font-family:${uiFont};">
                <div style="font-size:12px;color:${accent};">◎</div>
                <div style="margin-top:4px;font-size:15px;font-weight:900;color:${accent};">${escapeHtml(actionsLabel)}</div>
                <div style="font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;">acciones</div>
              </td>
              <td width="33%" align="center" style="font-family:${uiFont};">
                <div style="font-size:12px;color:${accent};">↗</div>
                <div style="margin-top:4px;font-size:15px;font-weight:900;color:${accent};">ALTO</div>
                <div style="font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;">impacto</div>
              </td>
              <td width="33%" align="center" style="font-family:${uiFont};">
                <div style="font-size:12px;color:${accent};">▦</div>
                <div style="margin-top:4px;font-size:15px;font-weight:900;color:${accent};">90</div>
                <div style="font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;">días</div>
              </td>
            </tr>
          </table>
          <div style="margin-top:12px;border-top:2px solid ${accent};padding-top:10px;text-align:center;">
            <p style="margin:0;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#0f172a;font-family:${uiFont};">Generado el ${escapeHtml(generatedAt)}</p>
            <p style="margin:4px 0 0;font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#64748b;font-family:${uiFont};">Plan personalizado · Confidencial</p>
          </div>
        </td>
      </tr>
    </table>`;

  return `
    <tr>
      <td style="padding:28px 0 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 36px rgba(15,23,42,.1);">
          ${scoreStrip}
          <tr>
            <td style="padding:12px 18px;background:${accent};text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ffffff;font-family:${uiFont};">${escapeHtml(content.planTitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 18px 8px;background:#ffffff;">
              ${logoBlock}
              <p style="margin:0;font-size:24px;line-height:1.2;font-weight:800;color:#0f172a;font-family:${uiFont};">
                Tu Plan de Ataque personalizado <span style="color:${accent};">está listo.</span>
              </p>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#64748b;font-family:${uiFont};">
                Preparado exclusivamente para <strong style="color:${accent};">${escapeHtml(domain)}</strong>
                ${brand && brand !== domain ? ` · ${escapeHtml(brand)}` : ''}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 18px 6px;background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="56%" valign="top" style="padding-right:10px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #f1f5f9;border-radius:14px;background:#ffffff;margin-bottom:10px;">
                      <tr>
                        <td style="padding:12px 14px;font-size:13px;line-height:1.5;color:#334155;font-family:${uiFont};">
                          <span style="color:${accent};font-weight:700;">◎</span>
                          No genérico. No teórico. <strong style="color:${accent};">Hecho 100% para tu negocio.</strong>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        ${statCard(actionsLabel, 'ACCIONES', 'prioritarias', '◎')}
                        ${statCard('ALTO', 'IMPACTO', 'en tu negocio', '↗')}
                        ${statCard('90', 'DÍAS', 'para resultados', '▦')}
                      </tr>
                    </table>
                  </td>
                  <td width="44%" valign="middle" align="center" style="padding-left:6px;">
                    ${bookCover}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 18px 22px;background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius:999px;background:${accent};">
                    <a href="${escapeHtml(input.links.plansUrl)}" style="display:inline-block;padding:15px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:${uiFont};">${escapeHtml(content.planCtaLabel)} →</a>
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
  const accent = brandAccentFromDomain(ctx.domain || ctx.brandName);

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
        <table role="presentation" width="100%" style="max-width:680px;">
          <tr>
            <td style="padding:0 0 18px;">
              <img src="${escapeHtml(assets.logoUrl)}" alt="Cleexs" width="110" style="display:block;width:110px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 8px;">
              ${bodyParagraphsHtml(content.bodyParagraphs, ctx)}
              ${showFounder ? founderSignatureHtml(assets, content.founderTitle) : ''}
              <p style="margin:24px 0 0;font-size:17px;line-height:1.7;color:#475569;font-style:italic;font-family:${letterFont};">${escapeHtml(postscript)}</p>
            </td>
          </tr>
          ${planAndScoreBlockHtml(input, content)}
          <tr>
            <td style="padding:14px 0 0;">
              ${secondaryLinksHtml(input, content, accent)}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8;font-family:${uiFont};">
              <a href="${escapeHtml(input.links.unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline;">${escapeHtml(content.unsubscribeLabel)}</a><br/>
              Cleexs - Conseguí clientes desde ChatGPT
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
    postscript,
    '',
    `${content.scoreLabelText}: ${scoreLine}`,
    `${content.rivalsLabel} ${competitors.map((c) => c.name).join(', ')}`,
    `Señal: ${signal}`,
    `Acción sugerida: ${action}`,
    input.links.reportUrl ? `${content.reportCtaLabel}: ${input.links.reportUrl}` : '',
    '',
    content.planTitle,
    content.planClosingLine,
    ctx.actionsCount != null && ctx.actionsCount > 0
      ? `• ${Math.round(ctx.actionsCount)} acciones prioritarias`
      : null,
    ...content.planBullets.map((b) => `• ${b}`),
    `${content.planCtaLabel}: ${input.links.plansUrl}`,
    '',
    input.links.shareUrl ? `${content.shareCtaLabel}: ${input.links.shareUrl}` : '',
    input.links.newDiagnosticUrl ? `${content.newDiagnosticCtaLabel}: ${input.links.newDiagnosticUrl}` : '',
    '',
    content.unsubscribeLabel,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text, assets, variant: 'letter' };
}
