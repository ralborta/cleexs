/** Google Tag Manager — contenedor Cleexs app.cleexs.net
 *  IMPORTANTE: no agregar gtag.js ni GA4 directo en paralelo; duplica visitas/eventos.
 *  GA4 va configurado solo dentro del contenedor GTM-W3KK88LC. */
export const GTM_CONTAINER_ID = 'GTM-W3KK88LC';

/** GTM en todas las rutas excepto /admin/* (incl. /admin/login). */
export function shouldIncludeGoogleTagManager(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !pathname.startsWith('/admin');
}

/** Header seteado por middleware en cada request. */
export function shouldIncludeGoogleTagManagerFromHeaders(
  gtmHeader: string | null | undefined,
  pathname: string | null | undefined,
): boolean {
  if (gtmHeader === '1') return true;
  if (gtmHeader === '0') return false;
  return shouldIncludeGoogleTagManager(pathname);
}

/** Eventos custom hacia GTM (no usar gtag.js directo: GA4 va solo dentro del contenedor). */
export function pushGtmDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(payload);
}
