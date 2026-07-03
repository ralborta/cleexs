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

export const CLEEXS_LETTER_FONT =
  "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, 'Times New Roman', serif";

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
    reportUrl: `${base}/ver-resultado?diagnosticId=preview-example`,
    shareUrl: `${base}/score/ejemplo-preview`,
    plansUrl: buildPlansUrl(base, 'monthly_score'),
    unsubscribeUrl: `${base}/email/unsubscribe?example=1`,
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
