/**
 * URL canónica de la app Next (diagnóstico, resultados, compartir) para enlaces en correos.
 *
 * No usar solo FRONTEND_URL: en Railway suele ser preview/staging (CORS) y no coincide con
 * el dominio del producto (app.cleexs.net).
 *
 * Prioridad: CLEEXS_APP_URL → NEXT_PUBLIC_APP_URL (ignorando localhost) → https://app.cleexs.net
 */
const DEFAULT_APP = 'https://app.cleexs.net';

function trimBase(s: string): string {
  return s.trim().replace(/\/$/, '');
}

function isLocalhostBase(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return /localhost|127\.0\.0\.1/.test(url);
  }
}

export function getAppBaseUrlForPublicLinks(): string {
  const explicit = process.env.CLEEXS_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit && !isLocalhostBase(explicit)) return trimBase(explicit);

  return trimBase(DEFAULT_APP);
}
