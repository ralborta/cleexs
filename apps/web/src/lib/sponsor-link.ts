import {
  buildSponsorWhatsAppPrefillMessage,
  buildWaMeUrl,
  normalizeSponsorTrackingCode,
  slugifySponsorDisplayName,
} from '@/lib/sponsor-whatsapp';
import { CLEEXS_APP_URL, CLEEXS_MARKETING_URL, CLEEXS_WHATSAPP_PHONE_E164 } from '@/lib/site';

export {
  buildSponsorGentilezaLine,
  buildSponsorWhatsAppPrefillMessage,
  buildSponsorWhatsAppPublicMessage,
  buildWaMeUrl,
} from '@/lib/sponsor-whatsapp';

/** Misma normalización que `/diagnostico/crear` al persistir ref y UTM. */
export function normalizeTrackingValue(input: string): string | undefined {
  return normalizeSponsorTrackingCode(input);
}

export function slugifySponsorLabel(label: string): string {
  return slugifySponsorDisplayName(label);
}

export type SponsorWhatsAppLinkParams = {
  phoneE164?: string;
  sponsorDisplayName: string;
  refCode: string;
  customMessage?: string;
};

export function buildSponsorWhatsAppUrl(params: SponsorWhatsAppLinkParams): string | null {
  const phone = (params.phoneE164 || CLEEXS_WHATSAPP_PHONE_E164).replace(/\D/g, '');
  if (!phone) return null;
  const ref = normalizeTrackingValue(params.refCode);
  if (!ref) return null;
  const text = buildSponsorWhatsAppPrefillMessage({
    sponsorDisplayName: params.sponsorDisplayName,
    refCode: ref,
    customBody: params.customMessage,
  });
  return buildWaMeUrl(phone, text);
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
