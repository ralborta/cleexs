import { getAppBaseUrlForPublicLinks } from '../app-public-url';

export type CleexsEmailTemplateVariant = 'letter' | 'editorial';

export type CleexsEmailAssets = {
  logoUrl: string;
  heroImageUrl?: string | null;
  founderPhotoUrl?: string | null;
};

export type CleexsEmailCompetitor = {
  name: string;
  score?: number | null;
};

export type CleexsEmailPersonalization = {
  score: number | null;
  brandName?: string | null;
  domain?: string | null;
  /** Nombres o filas con score; se usan en el bloque de insight del reporte. */
  competitors?: Array<CleexsEmailCompetitor | string>;
  /** Si no viene, se arma desde `improvementTipTemplate` en la plantilla. */
  improvementTip?: string | null;
};

export type CleexsEmailLinks = {
  newDiagnosticUrl: string;
  reportUrl?: string | null;
  shareUrl?: string | null;
  plansUrl: string;
  unsubscribeUrl: string;
};

export type CleexsEmailBuilt = {
  subject: string;
  html: string;
  text: string;
  assets: CleexsEmailAssets;
  variant: CleexsEmailTemplateVariant;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function normalizedScore(score: number | null): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function scoreAccent(score: number | null): string {
  const n = normalizedScore(score);
  if (n == null) return '#2563eb';
  if (n >= 70) return '#059669';
  if (n >= 40) return '#2563eb';
  return '#d97706';
}

/** Color de marca estable por dominio (misma idea que el borrador web). */
export function brandAccentFromDomain(domain?: string | null): string {
  const d = (domain || '').trim().toLowerCase();
  if (!d) return '#2563eb';
  // Overrides conocidos (alineados con logos fuertes)
  if (d.includes('nintendo')) return '#E60012';
  if (d.includes('coppel')) return '#0033A0';
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const s = 0.62;
  const l = 0.42;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex((r + m) * 255)}${toHex((g + m) * 255)}${toHex((b + m) * 255)}`;
}

export function softBrandBg(primary: string): string {
  // Aproxima un fondo suave (~12% tint) sin parsear hex complejo en todos los clientes.
  return `${primary}14`;
}

export type MergeContext = {
  score: number | null;
  brandName?: string | null;
  domain?: string | null;
  competitors?: Array<CleexsEmailCompetitor | string>;
  improvementTip?: string | null;
};

export function normalizeEmailCompetitors(
  raw?: Array<CleexsEmailCompetitor | string> | null
): CleexsEmailCompetitor[] {
  if (!raw?.length) return [];
  return raw
    .map((c) => (typeof c === 'string' ? { name: c.trim() } : { name: (c.name || '').trim(), score: c.score }))
    .filter((c) => c.name.length > 0)
    .slice(0, 5);
}

export function mergeCleexsText(template: string, ctx: MergeContext): string {
  const scoreText = normalizedScore(ctx.score) != null ? String(normalizedScore(ctx.score)) : '—';
  const brandName = (ctx.brandName || 'tu marca').trim() || 'tu marca';
  const domain = (ctx.domain || 'tu sitio').trim() || 'tu sitio';
  const competitors = normalizeEmailCompetitors(ctx.competitors);
  const competitorsList =
    competitors.map((c) => c.name).join(', ') || 'tus competidores del reporte';
  const topCompetitor = competitors[0]?.name || 'tu principal competidor';
  const values: Record<string, string> = {
    score: scoreText,
    brandName,
    domain,
    competitorsList,
    topCompetitor,
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
}

export function buildNewDiagnosticUrl(
  baseUrl = getAppBaseUrlForPublicLinks(),
  medium = 'cleexs_email'
): string {
  const base = trimBase(baseUrl);
  const params = new URLSearchParams({
    utm_source: 'email',
    utm_medium: medium,
    utm_campaign: 'cleexs_email',
  });
  return `${base}/diagnostico/crear?${params.toString()}`;
}

export function buildPlansUrl(baseUrl = getAppBaseUrlForPublicLinks(), medium = 'cleexs_email'): string {
  return `${trimBase(baseUrl)}/planes?utm_source=email&utm_medium=${encodeURIComponent(medium)}&utm_campaign=plan_conquistar`;
}

/** Upsell Plan Conquistar (CTA «Ver cómo es» en secuencia free). */
export function buildPlanConquistarUrl(
  baseUrl = getAppBaseUrlForPublicLinks(),
  medium = 'cleexs_email',
  campaign = 'plan_conquistar'
): string {
  const base = trimBase(baseUrl);
  const params = new URLSearchParams({
    utm_source: 'email',
    utm_medium: medium,
    utm_campaign: campaign,
  });
  return `${base}/plan-conquistar?${params.toString()}`;
}

export function resolveCleexsEmailAssets(
  baseUrl = getAppBaseUrlForPublicLinks(),
  overrides?: Partial<CleexsEmailAssets>
): CleexsEmailAssets {
  const base = trimBase(baseUrl);
  const heroFromEnv = process.env.MONTHLY_SCORE_EMAIL_HERO_URL?.trim() || null;
  const founderFromEnv = process.env.MONTHLY_SCORE_EMAIL_FOUNDER_PHOTO_URL?.trim() || null;

  return {
    logoUrl: overrides?.logoUrl || `${base}/CleexsLogo.png`,
    heroImageUrl: overrides?.heroImageUrl ?? heroFromEnv,
    founderPhotoUrl: overrides?.founderPhotoUrl ?? founderFromEnv ?? `${base}/gonzalo-founder.png`,
  };
}

export const CLEEXS_EMAIL_FONT = 'Inter, Arial, Helvetica, sans-serif';

/** @deprecated Usar CLEEXS_EMAIL_FONT */
export const CLEEXS_LETTER_FONT = CLEEXS_EMAIL_FONT;

export function founderSignatureHtml(assets: CleexsEmailAssets, founderTitle: string): string {
  if (!assets.founderPhotoUrl) return '';
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 0;">
      <tr>
        <td style="padding-right:12px;vertical-align:middle;">
          <img src="${escapeHtml(assets.founderPhotoUrl)}" alt="Gonzalo" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;border:2px solid #e2e8f0;object-fit:cover;" />
        </td>
        <td style="vertical-align:middle;font-family:${CLEEXS_LETTER_FONT};">
          <strong style="color:#1e293b;font-size:17px;">Gonzalo</strong><br/>
          <span style="color:#64748b;font-size:15px;">${escapeHtml(founderTitle)} · Cleexs</span>
        </td>
      </tr>
    </table>`;
}

/** URLs de ejemplo para previews en admin. */
export function sampleCleexsEmailLinks(baseUrl = getAppBaseUrlForPublicLinks()): CleexsEmailLinks {
  const base = trimBase(baseUrl);
  return {
    newDiagnosticUrl: buildNewDiagnosticUrl(base, 'monthly_score'),
    plansUrl: buildPlanConquistarUrl(base, 'monthly_score'),
    unsubscribeUrl: `${base}/email/unsubscribe?preview=1`,
  };
}

export function sampleCleexsPersonalization(overrides?: Partial<CleexsEmailPersonalization>): CleexsEmailPersonalization {
  return {
    score: overrides?.score ?? 62,
    brandName: overrides?.brandName ?? 'Empliados',
    domain: overrides?.domain ?? 'empliados.net',
    competitors: overrides?.competitors ?? [
      { name: 'Rival HR', score: 78 },
      { name: 'TalentoPro', score: 71 },
      { name: 'PeopleFirst', score: 65 },
    ],
    improvementTip: overrides?.improvementTip,
  };
}
