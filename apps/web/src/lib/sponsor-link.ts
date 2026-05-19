import { CLEEXS_APP_URL, CLEEXS_MARKETING_URL } from '@/lib/site';

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
  baseUrl?: string;
};

function buildTrackingSearchParams(params: SponsorLinkParams): URLSearchParams | null {
  const ref = normalizeTrackingValue(params.ref);
  if (!ref) return null;

  const search = new URLSearchParams();
  search.set('ref', ref);

  const utmSource = params.utmSource ? normalizeTrackingValue(params.utmSource) : undefined;
  const utmMedium = params.utmMedium ? normalizeTrackingValue(params.utmMedium) : undefined;
  const utmCampaign = params.utmCampaign ? normalizeTrackingValue(params.utmCampaign) : undefined;

  if (utmSource) search.set('utm_source', utmSource);
  if (utmMedium) search.set('utm_medium', utmMedium);
  if (utmCampaign) search.set('utm_campaign', utmCampaign);

  return search;
}

/**
 * Home de cleexs.net con ref/UTM (lo que pide marketing: aterriza en la web pública).
 * El tracking al diagnóstico se completa cuando WP reenvía esos params a la app al hacer "Checkear visibilidad".
 */
export function buildSponsorMarketingHomeUrl(params: SponsorLinkParams): string | null {
  const search = buildTrackingSearchParams(params);
  if (!search) return null;
  const base = (params.baseUrl?.trim() || CLEEXS_MARKETING_URL).replace(/\/$/, '');
  return `${base}/?${search.toString()}`;
}

/** Diagnóstico directo en la app (pruebas o enlaces internos). */
export function buildSponsorDiagnosticAppUrl(params: SponsorLinkParams): string | null {
  const search = buildTrackingSearchParams(params);
  if (!search) return null;
  const base = CLEEXS_APP_URL.replace(/\/$/, '');
  return `${base}/diagnostico/crear?${search.toString()}`;
}

/** @deprecated Usar buildSponsorMarketingHomeUrl — alias por compatibilidad. */
export function buildSponsorDiagnosticUrl(params: SponsorLinkParams): string | null {
  return buildSponsorMarketingHomeUrl(params);
}
