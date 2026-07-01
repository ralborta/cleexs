const ATTRIBUTION_STORAGE_KEY = 'cleexs_diagnostic_attribution';
const FIRST_TOUCH_STORAGE_KEY = 'cleexs_first_touch_attribution';
const FIRST_TOUCH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type DiagnosticAttribution = {
  refCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

function normalizeTrackingValue(input: string): string | undefined {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleaned) return undefined;
  return cleaned.slice(0, 120);
}

function readSessionAttribution(): DiagnosticAttribution {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw) as {
      ref?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };
    return {
      refCode: normalizeTrackingValue(j.ref || ''),
      utmSource: normalizeTrackingValue(j.utm_source || ''),
      utmMedium: normalizeTrackingValue(j.utm_medium || ''),
      utmCampaign: normalizeTrackingValue(j.utm_campaign || ''),
    };
  } catch {
    return {};
  }
}

function readFirstTouchAttribution(): DiagnosticAttribution {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_STORAGE_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw) as {
      savedAt?: number;
      ref?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };
    if (j.savedAt && Date.now() - j.savedAt > FIRST_TOUCH_MAX_AGE_MS) {
      localStorage.removeItem(FIRST_TOUCH_STORAGE_KEY);
      return {};
    }
    return {
      refCode: normalizeTrackingValue(j.ref || ''),
      utmSource: normalizeTrackingValue(j.utm_source || ''),
      utmMedium: normalizeTrackingValue(j.utm_medium || ''),
      utmCampaign: normalizeTrackingValue(j.utm_campaign || ''),
    };
  } catch {
    return {};
  }
}

function writeAttributionStores(ref: string, utm_source: string, utm_medium: string, utm_campaign: string) {
  if (typeof window === 'undefined') return;
  if (!ref && !utm_source && !utm_medium && !utm_campaign) return;
  try {
    sessionStorage.setItem(
      ATTRIBUTION_STORAGE_KEY,
      JSON.stringify({ ref, utm_source, utm_medium, utm_campaign })
    );
  } catch {
    /* ignore */
  }
  if (!ref && !utm_source) return;
  try {
    const existing = localStorage.getItem(FIRST_TOUCH_STORAGE_KEY);
    if (!existing) {
      localStorage.setItem(
        FIRST_TOUCH_STORAGE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          ref,
          utm_source,
          utm_medium,
          utm_campaign,
        })
      );
    }
  } catch {
    /* ignore */
  }
}

/** Lee ref/UTM de la URL actual y persiste first-touch (30 días) en localStorage. */
export function captureDiagnosticAttributionFromUrl(searchParams?: URLSearchParams): DiagnosticAttribution {
  if (typeof window === 'undefined') return {};
  const sp = searchParams ?? new URLSearchParams(window.location.search);
  const ref = sp.get('ref') || sp.get('ref_code') || '';
  const utm_source = sp.get('utm_source') || '';
  const utm_medium = sp.get('utm_medium') || '';
  const utm_campaign = sp.get('utm_campaign') || '';
  writeAttributionStores(ref, utm_source, utm_medium, utm_campaign);
  return {
    refCode: normalizeTrackingValue(ref),
    utmSource: normalizeTrackingValue(utm_source),
    utmMedium: normalizeTrackingValue(utm_medium),
    utmCampaign: normalizeTrackingValue(utm_campaign),
  };
}

/** Mejor esfuerzo: URL → session → first-touch localStorage (30 días). */
export function resolveDiagnosticAttributionForCreate(searchParams?: URLSearchParams): DiagnosticAttribution {
  const fromUrl = captureDiagnosticAttributionFromUrl(searchParams);
  const fromSession = readSessionAttribution();
  const fromFirstTouch = readFirstTouchAttribution();

  return {
    refCode: fromUrl.refCode || fromSession.refCode || fromFirstTouch.refCode,
    utmSource: fromUrl.utmSource || fromSession.utmSource || fromFirstTouch.utmSource,
    utmMedium: fromUrl.utmMedium || fromSession.utmMedium || fromFirstTouch.utmMedium,
    utmCampaign: fromUrl.utmCampaign || fromSession.utmCampaign || fromFirstTouch.utmCampaign,
  };
}
