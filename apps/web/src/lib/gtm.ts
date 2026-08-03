/** Google Tag Manager — contenedor Cleexs app.cleexs.net */
export const GTM_CONTAINER_ID = 'GTM-W3KK88LC';

/** GTM en páginas públicas; excluye panel /admin (incl. /admin/login). */
export function shouldIncludeGoogleTagManager(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return !pathname.startsWith('/admin');
}

/** Eventos custom hacia GTM (no usar gtag.js directo: GA4 va solo dentro del contenedor). */
export function pushGtmDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(payload);
}
