/** Roles de link en emails de marketing para utm_content y clasificación de clics. */
export type EmailLinkRole =
  | 'cta_plans'
  | 'cta_primary'
  | 'cta_diagnostic'
  | 'cta_report'
  | 'cta_share'
  | 'other';

export type EmailClickRole = 'plans' | 'diagnostic' | 'report' | 'share' | 'other';

export const EMAIL_CLICK_ROLE_LABELS: Record<EmailClickRole, string> = {
  plans: 'Planes',
  diagnostic: 'Diagnóstico',
  report: 'Reporte',
  share: 'Compartir',
  other: 'Otros',
};

export type EmailAttributionInput = {
  campaignSlug: string;
  variant?: string | null;
  linkRole: EmailLinkRole;
  medium?: string;
};

export function withEmailAttribution(url: string, params: EmailAttributionInput): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'email');
    u.searchParams.set('utm_medium', params.medium || 'cleexs_email');
    u.searchParams.set('utm_campaign', params.campaignSlug);
    u.searchParams.set('utm_content', params.linkRole);
    if (params.variant) u.searchParams.set('utm_term', params.variant);
    return u.toString();
  } catch {
    return url;
  }
}

export function extractResendClickLink(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as {
    data?: { click?: { link?: string }; link?: string };
    click?: { link?: string };
  };
  const fromClick = root.data?.click?.link ?? root.click?.link ?? root.data?.link;
  return typeof fromClick === 'string' && fromClick.trim() ? fromClick.trim() : null;
}

/** CTA comercial (planes / premium) vs otros links del mail. */
export function classifyEmailClickUrl(url: string): 'campaign' | 'other' {
  return classifyEmailClickRole(url) === 'plans' ? 'campaign' : 'other';
}

/** Desglose comercial por tipo de link (utm_content o path). */
export function classifyEmailClickRole(url: string): EmailClickRole {
  try {
    const u = new URL(url);
    const content = (u.searchParams.get('utm_content') || '').toLowerCase();
    if (content === 'cta_plans' || content === 'cta_primary') return 'plans';
    if (content === 'cta_diagnostic') return 'diagnostic';
    if (content === 'cta_report') return 'report';
    if (content === 'cta_share') return 'share';
    const path = u.pathname.toLowerCase();
    if (path.includes('/planes') || path.includes('/plan-conquistar') || path.includes('/checkout') || path.includes('/suscrib')) {
      return 'plans';
    }
    if (path.includes('/diagnostic') || path.includes('/diagnostico')) return 'diagnostic';
    if (path.includes('/share') || path.includes('/compartir') || path.includes('/refer')) {
      return 'share';
    }
    if (path.includes('/report') || path.includes('/informe')) return 'report';
    return 'other';
  } catch {
    return 'other';
  }
}

export type EmailClickBreakdown = Record<EmailClickRole, boolean>;

export function emptyEmailClickBreakdown(): EmailClickBreakdown {
  return { plans: false, diagnostic: false, report: false, share: false, other: false };
}

export function mergeEmailClickBreakdown(
  current: EmailClickBreakdown,
  role: EmailClickRole
): EmailClickBreakdown {
  return { ...current, [role]: true };
}

export function hasAnyEmailClick(breakdown: EmailClickBreakdown): boolean {
  return Object.values(breakdown).some(Boolean);
}

export function inferVariantFromMergeSummary(mergeSummary: unknown): string | null {
  if (!mergeSummary || typeof mergeSummary !== 'object' || Array.isArray(mergeSummary)) return null;
  const variant = (mergeSummary as { variant?: unknown }).variant;
  return typeof variant === 'string' && variant.trim() ? variant.trim() : null;
}

export function isEmailUtmPurchase(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}): boolean {
  const src = (input.utmSource || '').trim().toLowerCase();
  const medium = (input.utmMedium || '').trim().toLowerCase();
  if (src === 'email') return true;
  return ['monthly_score', 'cleexs_email', 'weekly_email', 'broadcast', 'weekly'].some((m) =>
    medium.includes(m)
  );
}
