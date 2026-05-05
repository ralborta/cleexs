/** Captura ?ref= para el programa de referidos del portal cliente (sessionStorage). */
export const PORTAL_REF_STORAGE_KEY = 'cleexs_portal_ref_slug';

export function capturePortalReferralFromLocation(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = new URLSearchParams(window.location.search).get('ref');
    const slug =
      raw
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '') ?? '';
    if (slug.length >= 6 && slug.length <= 64) {
      sessionStorage.setItem(PORTAL_REF_STORAGE_KEY, slug);
    }
  } catch {
    /* noop */
  }
}

export function peekPortalReferralSlug(): string | undefined {
  try {
    const s = sessionStorage.getItem(PORTAL_REF_STORAGE_KEY)?.trim();
    return s && s.length >= 6 ? s : undefined;
  } catch {
    return undefined;
  }
}

export function clearPortalReferralSlug(): void {
  try {
    sessionStorage.removeItem(PORTAL_REF_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
