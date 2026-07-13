const ATTRIBUTION_STORAGE_KEY = 'cleexs_diagnostic_attribution';
const FIRST_TOUCH_STORAGE_KEY = 'cleexs_first_touch_attribution';
const ATTRIBUTION_COOKIE = 'cleexs_attr';
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

function readAttributionCookie(): DiagnosticAttribution {
  if (typeof document === 'undefined') return {};
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${ATTRIBUTION_COOKIE}=([^;]*)`));
    if (!match?.[1]) return {};
    const j = JSON.parse(decodeURIComponent(match[1])) as {
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

function writeAttributionCookie(ref: string, utm_source: string, utm_medium: string, utm_campaign: string) {
  if (typeof document === 'undefined') return;
  if (!ref && !utm_source && !utm_medium && !utm_campaign) return;
  try {
    const value = encodeURIComponent(JSON.stringify({ ref, utm_source, utm_medium, utm_campaign }));
    // Compartido entre cleexs.net y app.cleexs.net
    document.cookie = `${ATTRIBUTION_COOKIE}=${value};path=/;domain=.cleexs.net;max-age=${60 * 60 * 24 * 30};SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/**
 * Videos de YouTube conocidos → campaña de auspiciador.
 * Si el referrer trae el video id (a veces YouTube lo manda), atribuye al sponsor.
 */
const YOUTUBE_VIDEO_TO_CAMPAIGN: Record<
  string,
  { refCode: string; utmSource: string; utmMedium: string; utmCampaign: string }
> = {
  // Los Herederos de Alberdi — https://www.youtube.com/watch?v=h6TUsFUyDQo
  h6tusfuydqo: {
    refCode: 'herederos',
    utmSource: 'auspiciador',
    utmMedium: 'youtube',
    utmCampaign: 'herederos',
  },
};

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
  writeAttributionCookie(ref, utm_source, utm_medium, utm_campaign);
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

function parseYoutubeVideoIdFromReferrer(referrer: string): string | null {
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[\w-]{11}$/i.test(id) ? id.toLowerCase() : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const fromQuery = url.searchParams.get('v');
      if (fromQuery && /^[\w-]{11}$/i.test(fromQuery)) return fromQuery.toLowerCase();
      const parts = url.pathname.split('/').filter(Boolean);
      if (
        (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'watch') &&
        parts[1] &&
        /^[\w-]{11}$/i.test(parts[1])
      ) {
        return parts[1].toLowerCase();
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isYoutubeReferrerHost(referrer: string): boolean {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    return (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'youtube-nocookie.com'
    );
  } catch {
    return false;
  }
}

/**
 * Si llega desde YouTube sin ?ref=/utm_, inferimos atribución por document.referrer.
 * - Video conocido → campaña sponsor (ej. herederos)
 * - YouTube genérico → utm_source=youtube (no inventamos ref)
 */
export function attributionFromDocumentReferrer(referrerRaw?: string): DiagnosticAttribution {
  if (typeof window === 'undefined' && !referrerRaw) return {};
  const referrer = (referrerRaw ?? (typeof document !== 'undefined' ? document.referrer : '')).trim();
  if (!referrer || !isYoutubeReferrerHost(referrer)) return {};

  const videoId = parseYoutubeVideoIdFromReferrer(referrer);
  if (videoId && YOUTUBE_VIDEO_TO_CAMPAIGN[videoId]) {
    const mapped = YOUTUBE_VIDEO_TO_CAMPAIGN[videoId];
    return {
      refCode: mapped.refCode,
      utmSource: mapped.utmSource,
      utmMedium: mapped.utmMedium,
      utmCampaign: mapped.utmCampaign,
    };
  }

  return {
    utmSource: 'youtube',
    utmMedium: 'referral',
    utmCampaign: videoId ? `yt_${videoId}` : 'youtube_organic',
  };
}

function mergeAttribution(...parts: DiagnosticAttribution[]): DiagnosticAttribution {
  return {
    refCode: parts.map((p) => p.refCode).find(Boolean),
    utmSource: parts.map((p) => p.utmSource).find(Boolean),
    utmMedium: parts.map((p) => p.utmMedium).find(Boolean),
    utmCampaign: parts.map((p) => p.utmCampaign).find(Boolean),
  };
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

/** Mejor esfuerzo: URL → session → cookie (.cleexs.net) → first-touch → referrer YouTube. */
export function resolveDiagnosticAttributionForCreate(searchParams?: URLSearchParams): DiagnosticAttribution {
  const fromUrl = captureDiagnosticAttributionFromUrl(searchParams);
  const fromSession = readSessionAttribution();
  const fromCookie = readAttributionCookie();
  const fromFirstTouch = readFirstTouchAttribution();
  const fromReferrer = attributionFromDocumentReferrer();

  const merged = mergeAttribution(fromUrl, fromSession, fromCookie, fromFirstTouch, fromReferrer);

  // Si solo vino por referrer/cookie, persistir para el resto del flujo / first-touch.
  if (
    (fromReferrer.utmSource || fromCookie.refCode || fromCookie.utmSource) &&
    !fromUrl.refCode &&
    !fromUrl.utmSource &&
    !fromSession.refCode &&
    !fromSession.utmSource
  ) {
    writeAttributionStores(
      merged.refCode || '',
      merged.utmSource || '',
      merged.utmMedium || '',
      merged.utmCampaign || ''
    );
  }

  return merged;
}
