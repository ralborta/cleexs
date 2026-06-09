'use client';

// Tracking liviano y anónimo para el funnel de conversión interno.
// Best-effort: nunca rompe la UX; si falla, se ignora.

function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return '/proxy-api';
  return 'https://cleexsapi-production.up.railway.app';
}

const VISITOR_KEY = 'cleexs_vid';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function post(path: string, body: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const url = `${apiBase()}${path}`;
    const payload = JSON.stringify(body);
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

export type PageViewAttribution = {
  refCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  sourceChannel?: string;
};

// Evita doble disparo por re-render dentro de la misma sesión/ruta.
const firedPaths = new Set<string>();

export function trackPageview(path: string, attribution?: PageViewAttribution): void {
  if (typeof window === 'undefined') return;
  if (firedPaths.has(path)) return;
  firedPaths.add(path);
  post('/api/public/track/pageview', {
    path,
    visitorId: getVisitorId(),
    ...attribution,
  });
}

export type ShareChannel = 'whatsapp' | 'email' | 'linkedin' | 'x' | 'copy' | 'other';

export function trackShare(
  channel: ShareChannel,
  opts?: { diagnosticId?: string; shareSlug?: string }
): void {
  post('/api/public/track/share', {
    channel,
    visitorId: getVisitorId(),
    ...opts,
  });
}
