'use client';

// Tracking liviano y anónimo para el funnel de conversión interno.
// Best-effort: nunca rompe la UX; si falla, se ignora.

function apiBase(): string {
  // En el navegador usamos proxy same-origin (evita CORS/credentials con sendBeacon).
  if (typeof window !== 'undefined') return '/proxy-api';
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
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

// Evita doble disparo por re-render. Si el 1er fire llegó sin UTM (hydration),
// permitimos un 2º fire cuando sí haya atribución.
const firedPaths = new Map<string, boolean>();

export function trackPageview(path: string, attribution?: PageViewAttribution): void {
  if (typeof window === 'undefined') return;
  const hasAttr = Boolean(
    attribution?.refCode || attribution?.utmSource || attribution?.utmMedium || attribution?.utmCampaign
  );
  const prior = firedPaths.get(path);
  if (prior === true) return;
  if (prior === false && !hasAttr) return;
  firedPaths.set(path, hasAttr);
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

export function trackUnlockClick(opts: {
  unlockKey: string;
  label: string;
  diagnosticId?: string;
}): void {
  post('/api/public/track/unlock-click', {
    unlockKey: opts.unlockKey,
    label: opts.label,
    visitorId: getVisitorId(),
    ...(opts.diagnosticId ? { diagnosticId: opts.diagnosticId } : {}),
  });
}
