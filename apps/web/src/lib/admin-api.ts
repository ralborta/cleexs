import type { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import {
  adminOpenAccessEnabled,
  COOKIE_NAME,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from '@/lib/admin-session';
import { isAdminApiAllowedForRole } from '@/lib/admin-roles';

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
export function adminAuthBypassEnabled(): boolean {
  return adminOpenAccessEnabled();
}

/** Sesión verificada por cookie (HMAC). Null si no hay cookie válida. */
export function getAdminUiSession(request?: Request): AdminSessionPayload | null {
  const fromReqCookie = cookieFromNextRequest(request);
  const verifiedReq = verifyAdminSessionToken(fromReqCookie);
  if (verifiedReq) return verifiedReq;

  const fromJar = cookies().get(COOKIE_NAME)?.value;
  const verifiedJar = verifyAdminSessionToken(fromJar);
  if (verifiedJar) return verifiedJar;

  const raw = request?.headers.get('cookie') ?? headers().get('cookie');
  const c = cookieValueFromHeader(raw, COOKIE_NAME);
  return verifyAdminSessionToken(c);
}

/** Rol efectivo en UI: sin cookie + acceso abierto = admin completo. */
export function getEffectiveAdminRole(request?: Request): AdminSessionPayload['role'] {
  const session = getAdminUiSession(request);
  if (session) return session.role;
  if (adminAuthBypassEnabled()) return 'admin';
  return 'admin';
}

/** Valida sesión admin y permisos por rol en rutas /api/admin-ui/* y /api/reports/*. */
export function assertAdminUiSession(request?: Request): boolean {
  const session = getAdminUiSession(request);

  if (session) {
    if (session.role === 'marketing' && request?.url) {
      const pathname = new URL(request.url).pathname;
      if (pathname.startsWith('/api/admin-ui') || pathname.startsWith('/api/reports')) {
        return isAdminApiAllowedForRole(pathname, session.role);
      }
    }
    return true;
  }

  if (adminAuthBypassEnabled()) return true;
  return false;
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
