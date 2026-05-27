import type { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { COOKIE_NAME, verifyAdminSessionToken } from '@/lib/admin-session';

function cookieValueFromHeader(raw: string | null | undefined, name: string): string | undefined {
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const p = part.trim();
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    if (k !== name) continue;
    try {
      return decodeURIComponent(p.slice(eq + 1).trim());
    } catch {
      return p.slice(eq + 1).trim();
    }
  }
  return undefined;
}

export function apiBaseUrl(): string {
  const u = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!u) throw new Error('API_URL o NEXT_PUBLIC_API_URL no configurado');
  return u.replace(/\/$/, '');
}

export function adminApiSecret(): string {
  const s = process.env.ADMIN_API_SECRET?.trim();
  if (!s) throw new Error('ADMIN_API_SECRET no configurado en el servidor web');
  return s;
}

/** Lee cookie del objeto Request de Next (Route Handlers); prioridad sobre `cookies()` del contexto. */
function cookieFromNextRequest(request: Request | undefined): string | undefined {
  if (!request || !('cookies' in request)) return undefined;
  const jar = (request as NextRequest).cookies;
  return jar?.get(COOKIE_NAME)?.value;
}

/**
 * Bypass para demo: si en Vercel está seteado ADMIN_DEMO_BYPASS=true (o
 * NEXT_PUBLIC_ADMIN_DEMO_BYPASS=true para casos en que la build inline el
 * valor), `assertAdminUiSession` siempre devuelve true y todas las pantallas
 * internas funcionan sin login. Quitar la env var en produccion real para
 * restablecer el login.
 */
function adminAuthBypassEnabled(): boolean {
  const a = process.env.ADMIN_DEMO_BYPASS?.toString().trim().toLowerCase();
  if (a === 'true' || a === '1' || a === 'yes') return true;
  const b = process.env.NEXT_PUBLIC_ADMIN_DEMO_BYPASS?.toString().trim().toLowerCase();
  if (b === 'true' || b === '1' || b === 'yes') return true;
  return false;
}

/** Valida sesión admin: NextRequest.cookies, cookie store de headers(), cabecera Cookie. */
export function assertAdminUiSession(request?: Request): boolean {
  if (adminAuthBypassEnabled()) return true;

  const fromReqCookie = cookieFromNextRequest(request);
  if (verifyAdminSessionToken(fromReqCookie)) return true;

  const fromJar = cookies().get(COOKIE_NAME)?.value;
  if (verifyAdminSessionToken(fromJar)) return true;

  const raw = request?.headers.get('cookie') ?? headers().get('cookie');
  const c = cookieValueFromHeader(raw, COOKIE_NAME);
  return verifyAdminSessionToken(c);
}

export async function forwardToCleexsApi(path: string, init: RequestInit): Promise<Response> {
  const base = apiBaseUrl();
  const secret = adminApiSecret();
  const hdr = new Headers(init.headers);
  hdr.set('x-admin-secret', secret);
  if (!hdr.has('Content-Type') && init.body) {
    hdr.set('Content-Type', 'application/json');
  }
  return fetch(`${base}${path}`, { ...init, headers: hdr });
}
