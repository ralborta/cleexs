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
} from './shared';
import { getAppBaseUrlForPublicLinks } from '../app-public-url';

export type CleexsLetterContent = {
  subject: string;
  preheader: string;
  bodyParagraphs: string[];
  /** Línea sutil con score (después de la firma). */
  scoreHintLine: string;
  scoreMissingHint: string;
  /** Una frase educativa opcional, mismo tono que la carta. */
  scoreHintEducationalLine: string;
  reportCtaLabel: string;
  shareCtaLabel: string;
  newDiagnosticCtaLabel: string;
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
  /** Muestra hint de score + link reporte (mail mensual). */
  showScoreBlock?: boolean;
  /** Muestra links secundarios (compartir, nuevo diagnóstico). */
  showReportLinks?: boolean;
  /** Añade la frase educativa al hint de score. */
  showScoreTipsBlock?: boolean;
};

export function defaultCleexsLetterContent(): CleexsLetterContent {
  return {
    subject: 'Le preguntamos 100 veces a ChatGPT',
    preheader: 'Los mismos nombres aparecían una y otra vez.',
    bodyParagraphs: [
      'Esta semana repetimos la misma pregunta decenas de veces. Esperaba respuestas muy distintas. Pero los mismos nombres aparecían una y otra vez.',
      'Parece haber una especie de grupo favorito. Todavía estamos investigando por qué. Pero si esto es así, entrar en ese grupo puede ser extremadamente valioso.',
    ],
    scoreHintLine: 'Para {{domain}}, tu Cleexs Score es {{score}}.',
    scoreMissingHint: 'Todavía no tenemos un score guardado para {{domain}}.',
    scoreHintEducationalLine:
      'Mide cuánto te recomiendan las IA cuando alguien busca opciones como {{brandName}} — no es tráfico web.',
    reportCtaLabel: 'Ver mi reporte',
    shareCtaLabel: 'Compartir reporte',
    newDiagnosticCtaLabel: 'Generar nuevo diagnóstico',
    postscript: 'PD: ¿Alguna vez le preguntaste a ChatGPT por empresas de tu industria?',
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

const letterFont = "Georgia,'Times New Roman',Times,serif";

function bodyParagraphsHtml(paragraphs: string[], ctx: CleexsEmailPersonalization): string {
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#1e293b;font-family:${letterFont};">${escapeHtml(mergeCleexsText(p, ctx))}</p>`
    )
    .join('\n');
}

function compactReportHintHtml(
  input: CleexsLetterEmailInput,
  content: CleexsLetterContent,
  ctx: CleexsEmailPersonalization
): string {
  if (input.showScoreBlock === false) return '';

  const hasScore = normalizedScore(ctx.score) != null;
  const hint = hasScore
    ? mergeCleexsText(content.scoreHintLine, ctx)
    : mergeCleexsText(content.scoreMissingHint, ctx);
  const edu =
    hasScore && input.showScoreTipsBlock !== false
      ? mergeCleexsText(content.scoreHintEducationalLine, ctx)
      : '';

  const reportInline =
    input.links.reportUrl
      ? ` <a href="${escapeHtml(input.links.reportUrl)}" style="color:#475569;text-decoration:underline;">${escapeHtml(content.reportCtaLabel)}</a>`
      : '';

  return `<p style="margin:20px 0 0;font-size:14px;line-height:1.65;color:#64748b;font-family:${letterFont};">${escapeHtml(hint)}${edu ? ` ${escapeHtml(edu)}` : ''}${reportInline}</p>`;
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
  return `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;font-family:${letterFont};">${links.join(' · ')}</p>`;
}

function planSectionHtml(input: CleexsLetterEmailInput, content: CleexsLetterContent): string {
  return `
    <tr>
      <td style="padding:28px 0 0;border-top:1px solid #e2e8f0;">
        <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#475569;font-family:${letterFont};">${escapeHtml(content.planTitle)}</p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#94a3b8;font-family:${letterFont};">${escapeHtml(content.planPitch)}</p>
        <a href="${escapeHtml(input.links.plansUrl)}" style="font-size:13px;color:#64748b;text-decoration:underline;font-family:${letterFont};">${escapeHtml(content.planCtaLabel)} →</a>
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
            <td style="padding:0 0 24px;">
              <img src="${escapeHtml(assets.logoUrl)}" alt="Cleexs" width="96" style="display:block;width:96px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 24px;">
              ${bodyParagraphsHtml(content.bodyParagraphs, ctx)}
              ${showFounder ? founderSignatureHtml(assets, content.founderTitle) : ''}
              ${compactReportHintHtml(input, content, ctx)}
              ${secondaryLinksHtml(input, content)}
              <p style="margin:24px 0 0;font-size:15px;line-height:1.65;color:#475569;font-style:italic;font-family:${letterFont};">${escapeHtml(postscript)}</p>
            </td>
          </tr>
          ${planSectionHtml(input, content)}
          <tr>
            <td style="padding:24px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8;font-family:${letterFont};">
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

  const hintLine =
    normalizedScore(ctx.score) != null
      ? mergeCleexsText(content.scoreHintLine, ctx)
      : mergeCleexsText(content.scoreMissingHint, ctx);
  const eduLine =
    normalizedScore(ctx.score) != null && input.showScoreTipsBlock !== false
      ? mergeCleexsText(content.scoreHintEducationalLine, ctx)
      : '';

  const text = [
    subject,
    '',
    ...content.bodyParagraphs.map((p) => mergeCleexsText(p, ctx)),
    '',
    hintLine,
    eduLine,
    input.links.reportUrl ? `${content.reportCtaLabel}: ${input.links.reportUrl}` : '',
    input.links.shareUrl ? `${content.shareCtaLabel}: ${input.links.shareUrl}` : '',
    input.links.newDiagnosticUrl ? `${content.newDiagnosticCtaLabel}: ${input.links.newDiagnosticUrl}` : '',
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
