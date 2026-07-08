import { getAppBaseUrlForPublicLinks } from '../app-public-url';
import {
  type CleexsEmailAssets,
  type CleexsEmailBuilt,
  type CleexsEmailLinks,
  type CleexsEmailPersonalization,
  escapeHtml,
  mergeCleexsText,
  normalizedScore,
  resolveCleexsEmailAssets,
  scoreAccent,
} from './shared';

export type CleexsEditorialContent = {
  subject: string;
  preheader: string;
  heroEyebrow: string;
  headline: string;
  introParagraphs: string[];
  scoreTitle: string;
  scoreDescription: string;
  scoreMissingText: string;
  ctaLabel: string;
  ctaHint: string;
  editorialTitle: string;
  editorialBody: string;
  planTitle: string;
  planPitch: string;
  planCtaLabel: string;
  unsubscribeLabel: string;
};

export type CleexsEditorialEmailInput = {
  personalization: CleexsEmailPersonalization;
  links: CleexsEmailLinks;
  assets?: Partial<CleexsEmailAssets>;
  content?: Partial<CleexsEditorialContent>;
  showFounderSignature?: boolean;
  /** Si es false, no se muestra el anillo de score (p. ej. email mensual: ver al clickear). */
  showScoreBlock?: boolean;
};

const ENGINE_CHIPS = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity'] as const;

const METRICS = [
  {
    title: 'Visibilidad',
    body: 'Qué tan seguido aparecés cuando preguntan por soluciones como la tuya.',
  },
  {
    title: 'Confianza',
    body: 'Qué tan clara y favorable es la forma en que la IA te describe.',
  },
  {
    title: 'Competencia',
    body: 'Cómo quedás parado frente a otros proveedores del mercado.',
  },
] as const;

export function defaultMonthlyScoreEditorialContent(): CleexsEditorialContent {
  return {
    subject: 'Tu Cleexs Score fue actualizado',
    preheader: 'Entrá con un click para ver tu score actualizado en Cleexs.',
    heroEyebrow: 'Cleexs Score Mensual',
    headline: 'Tu nuevo Cleexs Score está listo.',
    introParagraphs: [
      'Actualizamos tu medición de visibilidad en motores de IA. El número y el detalle no están en este mail: al entrar arrancamos el diagnóstico con la URL de {{domain}} y ahí ves tu score nuevo.',
      'Tocá el botón de abajo para abrir tu Cleexs Score actualizado de {{brandName}}.',
    ],
    scoreTitle: 'Tu Cleexs Score',
    scoreDescription: 'El score actualizado te espera en el reporte.',
    scoreMissingText: 'Sin score reciente',
    ctaLabel: 'Ver mi Cleexs Score',
    ctaHint: 'Arranca solo con tu URL · tarda unos minutos · sin costo',
    editorialTitle: 'Aparecer bien en IA dejó de ser algo decorativo.',
    editorialBody:
      'Los que miden hoy empiezan a entender qué dicen los motores de IA, dónde pierden presencia y qué señales necesitan fortalecer antes que el resto reaccione.',
    planTitle: 'Con Plan Conquistar seguís tu score mes a mes.',
    planPitch:
      'Comparás con competidores, ves más motores de IA y dejás de adivinar cómo te están recomendando.',
    planCtaLabel: 'Ver Plan Conquistar',
  unsubscribeLabel: 'Gestionar lo que recibo',
  };
}

export function defaultCleexsEditorialContent(): CleexsEditorialContent {
  return {
    subject: 'Tu Cleexs Score del mes: {{score}}',
    preheader: 'Tu último score guardado y un link para generar un diagnóstico nuevo cuando quieras.',
    heroEyebrow: 'Cleexs Score Mensual',
    headline: 'Tu visibilidad en motores de IA, medida con claridad.',
    introParagraphs: [
      'Cada mes te enviamos un recordatorio simple: los motores de IA ya influyen en cómo tus clientes descubren, comparan y eligen proveedores.',
      'Tu último Cleexs Score registrado resume qué tan visible y confiable aparecés hoy en esas respuestas.',
    ],
    scoreTitle: 'Tu último Cleexs Score',
    scoreDescription:
      'Este número corresponde al último registro guardado. Para ver una foto actualizada de tu posicionamiento, podés generar un nuevo diagnóstico.',
    scoreMissingText: 'Sin score reciente',
    ctaLabel: 'Generar nuevo diagnóstico',
    ctaHint: 'Gratis · tarda unos minutos · solo si vos lo pedís',
    editorialTitle: 'Aparecer bien en IA dejó de ser algo decorativo.',
    editorialBody:
      'Los que miden hoy empiezan a entender qué dicen los motores de IA, dónde pierden presencia y qué señales necesitan fortalecer antes que el resto reaccione.',
    planTitle: 'Con Plan Conquistar seguís tu score mes a mes.',
    planPitch:
      'Comparás con competidores, ves más motores de IA y dejás de adivinar cómo te están recomendando.',
    planCtaLabel: 'Ver Plan Conquistar',
  unsubscribeLabel: 'Gestionar lo que recibo',
  };
}

function mergeContent(overrides?: Partial<CleexsEditorialContent>): CleexsEditorialContent {
  return { ...defaultCleexsEditorialContent(), ...overrides };
}

function scoreDisplay(score: number | null, content: CleexsEditorialContent): { value: string; sub: string } {
  const n = normalizedScore(score);
  if (n == null) {
    return { value: '—', sub: content.scoreMissingText };
  }
  return { value: String(n), sub: 'de 100' };
}

function engineChipsHtml(): string {
  return ENGINE_CHIPS.map(
    (chip) =>
      `<span style="display:inline-block;margin:0 8px 8px 0;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.28);color:#ffffff;border-radius:999px;padding:8px 11px;font-size:13px;font-weight:700;">${chip}</span>`
  ).join('');
}

function metricsHtml(): string {
  const cells = METRICS.map(
    (m) => `
      <td class="metric-cell" width="33%" valign="top" style="padding:0 6px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dce8fb;background:#f8fbff;border-radius:14px;">
          <tr>
            <td style="padding:16px;font-family:Inter,Arial,Helvetica,sans-serif;">
              <b style="display:block;font-size:14px;margin-bottom:6px;color:#102449;">${m.title}</b>
              <span style="display:block;font-size:13px;line-height:1.45;color:#667895;">${m.body}</span>
            </td>
          </tr>
        </table>
      </td>`
  ).join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0 26px;">
      <tr>${cells}</tr>
    </table>`;
}

function editorialIllustrationHtml(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#0f172a 0%,#1e40af 100%);">
      <tr>
        <td align="center" style="padding:28px;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:420px;background:#ffffff;border-radius:16px;box-shadow:0 22px 42px rgba(0,0,0,.25);">
            <tr>
              <td style="padding:16px;font-family:Inter,Arial,Helvetica,sans-serif;">
                <table role="presentation" cellspacing="0" cellpadding="0"><tr>
                  <td width="8" height="8" style="background:#cbd5e1;border-radius:50%;"></td>
                  <td width="6"></td>
                  <td width="8" height="8" style="background:#cbd5e1;border-radius:50%;"></td>
                  <td width="6"></td>
                  <td width="8" height="8" style="background:#cbd5e1;border-radius:50%;"></td>
                </tr></table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;border:1px solid #dbe7fb;border-radius:12px;background:#f8fbff;">
                  <tr><td style="padding:12px;">
                    <strong style="display:block;color:#1d4ed8;font-size:14px;margin-bottom:5px;">Respuesta de IA</strong>
                    <div style="height:8px;border-radius:999px;background:#dbeafe;margin:7px 0;"></div>
                    <div style="height:8px;border-radius:999px;background:#dbeafe;margin:7px 0;"></div>
                    <div style="height:8px;width:70%;border-radius:999px;background:#dbeafe;margin:7px 0;"></div>
                  </td></tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:9px;border:1px solid #dbe7fb;border-radius:12px;background:#f8fbff;">
                  <tr><td style="padding:12px;">
                    <strong style="display:block;color:#1d4ed8;font-size:14px;margin-bottom:5px;">Proveedor recomendado</strong>
                    <div style="height:8px;border-radius:999px;background:#dbeafe;margin:7px 0;"></div>
                    <div style="height:8px;width:70%;border-radius:999px;background:#dbeafe;margin:7px 0;"></div>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function heroBlock(content: CleexsEditorialContent, assets: CleexsEmailAssets): string {
  if (assets.heroImageUrl) {
    return `
      <tr>
        <td style="padding:0 0 22px;">
          <img src="${escapeHtml(assets.heroImageUrl)}" alt="" width="680" style="display:block;width:100%;max-width:680px;height:auto;border:0;border-radius:18px;" />
        </td>
      </tr>`;
  }

  return `
      <tr>
        <td style="padding:0 0 22px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:18px;border:1px solid rgba(255,255,255,.7);background:linear-gradient(135deg,#0f3fb6 0%,#2563eb 46%,#7dd3fc 120%);box-shadow:0 16px 38px rgba(37,99,235,.24);">
            <tr>
              <td style="padding:30px;font-family:Inter,Arial,Helvetica,sans-serif;color:#ffffff;">
                <p style="margin:0 0 10px;text-transform:uppercase;letter-spacing:2px;font-size:12px;font-weight:800;opacity:.88;">${escapeHtml(content.heroEyebrow)}</p>
                <h1 style="margin:0;max-width:480px;font-size:34px;line-height:1.03;letter-spacing:-1.1px;font-weight:800;color:#ffffff;">${escapeHtml(content.headline)}</h1>
                <div style="margin-top:22px;">${engineChipsHtml()}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

function scoreTeaserHtml(content: CleexsEditorialContent): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 22px;background:linear-gradient(180deg,#f8fbff,#eef5ff);border:1px solid #cfe0ff;border-radius:18px;">
      <tr>
        <td style="padding:24px;font-family:Inter,Arial,Helvetica,sans-serif;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:#2563eb;">Cleexs Score</p>
          <h2 style="margin:0 0 8px;font-size:22px;letter-spacing:-.4px;color:#172033;">${escapeHtml(content.scoreTitle)}</h2>
          <p style="margin:0;font-size:15px;color:#667895;line-height:1.55;">${escapeHtml(content.scoreDescription)}</p>
        </td>
      </tr>
    </table>`;
}

function scoreRingHtml(score: number | null, scoreValue: string, accent: string): string {
  const pct = normalizedScore(score) ?? 0;
  const ringBg = `conic-gradient(${accent} 0 ${pct}%, #d8e6ff ${pct}% 100%)`;

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
      <tr>
        <td width="150" height="150" align="center" valign="middle" style="width:150px;height:150px;border-radius:50%;background:${ringBg};">
          <table role="presentation" cellspacing="0" cellpadding="0" width="116" height="116" style="width:116px;height:116px;border-radius:50%;background:#ffffff;box-shadow:0 8px 18px rgba(37,99,235,.12);">
            <tr>
              <td align="center" valign="middle" style="text-align:center;font-family:Inter,Arial,Helvetica,sans-serif;">
                <div style="font-size:48px;line-height:1;font-weight:900;color:${accent};letter-spacing:-2px;">${escapeHtml(scoreValue)}</div>
                <div style="font-size:12px;color:#667895;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;margin-top:4px;">de 100</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function buildEditorialEmail(input: CleexsEditorialEmailInput): CleexsEmailBuilt {
  const content = mergeContent(input.content);
  const ctx = input.personalization;
  const assets = resolveCleexsEmailAssets(getAppBaseUrlForPublicLinks(), input.assets);
  const subject = mergeCleexsText(content.subject, ctx);
  const { value: scoreValue } = scoreDisplay(ctx.score, content);
  const accent = scoreAccent(ctx.score);
  const showFounder = input.showFounderSignature !== false && Boolean(assets.founderPhotoUrl);
  const showScoreBlock = input.showScoreBlock !== false;
  const preheader = mergeCleexsText(content.preheader, ctx);

  const introHtml = content.introParagraphs
    .map(
      (p) =>
        `<p style="margin:0 0 18px;font-size:17px;line-height:1.65;color:#172033;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(mergeCleexsText(p, ctx))}</p>`
    )
    .join('\n');

  const founderBlock = showFounder
    ? `
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <img src="${escapeHtml(assets.founderPhotoUrl!)}" alt="Gonzalo" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;border:3px solid #eaf2ff;object-fit:cover;" />
                  </td>
                  <td style="vertical-align:middle;font-family:Inter,Arial,Helvetica,sans-serif;">
                    <strong style="color:#172033;font-size:15px;">Gonzalo</strong><br/>
                    <span style="color:#667895;font-size:14px;">Cleexs</span>
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
  <style>
    @media only screen and (max-width:560px){
      .score-wrap-left,.score-wrap-right{display:block !important;width:100% !important;text-align:center !important;}
      .metric-cell{display:block !important;width:100% !important;padding:0 0 12px !important;}
      .plan-left,.plan-right{display:block !important;width:100% !important;text-align:left !important;}
    }
  </style>
</head>
<body style="margin:0;padding:32px 14px;background:#eef4fb;font-family:Inter,Arial,Helvetica,sans-serif;color:#172033;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:680px;">
          <tr>
            <td style="padding:0 0 22px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e4edf8;border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.05);">
                <tr>
                  <td style="padding:12px 18px;">
                    <img src="${escapeHtml(assets.logoUrl)}" alt="Cleexs" width="132" style="display:block;width:132px;height:auto;border:0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${heroBlock(content, assets)}

          <tr>
            <td style="background:#ffffff;border:1px solid #dde7f4;border-radius:18px;padding:28px;box-shadow:0 12px 28px rgba(15,23,42,.06);">
              ${introHtml}

              ${
                showScoreBlock
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 22px;background:linear-gradient(180deg,#f8fbff,#eef5ff);border:1px solid #cfe0ff;border-radius:18px;">
                <tr>
                  <td class="score-wrap-left" width="170" valign="middle" align="center" style="padding:24px 12px 24px 24px;">
                    ${scoreRingHtml(ctx.score, scoreValue, accent)}
                  </td>
                  <td class="score-wrap-right" valign="middle" style="padding:24px 24px 24px 12px;font-family:Inter,Arial,Helvetica,sans-serif;">
                    <h2 style="margin:0 0 8px;font-size:22px;letter-spacing:-.4px;color:#172033;">${escapeHtml(content.scoreTitle)}</h2>
                    <p style="margin:0;font-size:15px;color:#667895;line-height:1.55;">${escapeHtml(content.scoreDescription)}</p>
                  </td>
                </tr>
              </table>`
                  : scoreTeaserHtml(content)
              }

              ${metricsHtml()}

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);box-shadow:0 12px 22px rgba(37,99,235,.26);">
                    <a href="${escapeHtml(input.links.newDiagnosticUrl)}" style="display:inline-block;padding:15px 22px;font-size:16px;font-weight:900;color:#ffffff;text-decoration:none;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(content.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0;font-size:13px;color:#7d8faa;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(content.ctaHint)}</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid #dce8fb;border-radius:18px;overflow:hidden;background:#ffffff;">
                <tr><td style="padding:0;">${editorialIllustrationHtml()}</td></tr>
                <tr>
                  <td style="padding:24px;font-family:Inter,Arial,Helvetica,sans-serif;">
                    <h3 style="margin:0 0 8px;font-size:22px;letter-spacing:-.3px;color:#172033;">${escapeHtml(content.editorialTitle)}</h3>
                    <p style="margin:0;font-size:16px;color:#30405b;line-height:1.65;">${escapeHtml(content.editorialBody)}</p>
                  </td>
                </tr>
              </table>

              ${founderBlock}
            </td>
          </tr>

          <tr>
            <td style="padding-top:24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;border-radius:18px;">
                <tr>
                  <td class="plan-left" valign="middle" style="padding:24px;font-family:Inter,Arial,Helvetica,sans-serif;color:#ffffff;">
                    <b style="display:block;font-size:18px;margin-bottom:6px;">${escapeHtml(content.planTitle)}</b>
                    <span style="color:#c7d2fe;line-height:1.5;font-size:14px;">${escapeHtml(content.planPitch)}</span>
                  </td>
                  <td class="plan-right" align="right" valign="middle" style="padding:24px;font-family:Inter,Arial,Helvetica,sans-serif;">
                    <a href="${escapeHtml(input.links.plansUrl)}" style="color:#bfdbfe;font-weight:900;text-decoration:none;white-space:nowrap;font-size:15px;">${escapeHtml(content.planCtaLabel)} →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 0 4px;text-align:center;color:#7f8da6;font-size:13px;line-height:1.6;font-family:Inter,Arial,Helvetica,sans-serif;">
              <a href="${escapeHtml(input.links.unsubscribeUrl)}" style="color:#7f8da6;text-decoration:underline;">${escapeHtml(content.unsubscribeLabel)}</a><br/>
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
    ...content.introParagraphs.map((p) => mergeCleexsText(p, ctx)),
    '',
    ...(showScoreBlock
      ? [`${content.scoreTitle}: ${scoreValue}`, content.scoreDescription, '']
      : [content.scoreDescription, '']),
    `${content.ctaLabel}: ${input.links.newDiagnosticUrl}`,
    content.ctaHint,
    '',
    content.editorialTitle,
    content.editorialBody,
    '',
    content.planTitle,
    content.planPitch,
    `${content.planCtaLabel}: ${input.links.plansUrl}`,
    '',
    content.unsubscribeLabel,
  ].join('\n');

  return { subject, html, text, assets, variant: 'editorial' };
}
