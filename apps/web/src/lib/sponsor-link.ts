import { CLEEXS_APP_URL, CLEEXS_SPONSOR_LINK_BASE_URL } from '@/lib/site';

/** Misma normalización que `/diagnostico/crear` al persistir ref y UTM. */
export function normalizeTrackingValue(input: string): string | undefined {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleaned) return undefined;
  return cleaned.slice(0, 120);
}

export function slugifySponsorLabel(label: string): string {
  return normalizeTrackingValue(label.trim().replace(/\s+/g, '_')) ?? '';
}

export type SponsorLinkParams = {
  ref: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** Dominio base sin path; por defecto cleexs.net (CLEEXS_SPONSOR_LINK_BASE_URL) */
  baseUrl?: string;
};

function buildSponsorDiagnosticUrlWithBase(baseUrl: string, params: SponsorLinkParams): string | null {
  const ref = normalizeTrackingValue(params.ref);
  if (!ref) return null;

  const base = baseUrl.replace(/\/$/, '');
  const search = new URLSearchParams();
  search.set('ref', ref);

  const utmSource = params.utmSource ? normalizeTrackingValue(params.utmSource) : undefined;
  const utmMedium = params.utmMedium ? normalizeTrackingValue(params.utmMedium) : undefined;
  const utmCampaign = params.utmCampaign ? normalizeTrackingValue(params.utmCampaign) : undefined;

  if (utmSource) search.set('utm_source', utmSource);
  if (utmMedium) search.set('utm_medium', utmMedium);
  if (utmCampaign) search.set('utm_campaign', utmCampaign);

  return `${base}/diagnostico/crear?${search.toString()}`;
}

/** Link público para compartir (cleexs.net por defecto). */
export function buildSponsorDiagnosticUrl(params: SponsorLinkParams): string | null {
  const base = (params.baseUrl?.trim() || CLEEXS_SPONSOR_LINK_BASE_URL).replace(/\/$/, '');
  return buildSponsorDiagnosticUrlWithBase(base, params);
}

/** Misma campaña en app.cleexs.net (diagnóstico directo, sin pasar por marketing). */
export function buildSponsorDiagnosticAppUrl(params: SponsorLinkParams): string | null {
  return buildSponsorDiagnosticUrlWithBase(CLEEXS_APP_URL, params);
}
