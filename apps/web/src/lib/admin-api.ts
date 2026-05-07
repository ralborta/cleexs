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

/** Valida sesión admin: cookie store y cabecera `Cookie` (por si el store difiere del request). */
export function assertAdminUiSession(request?: Request): boolean {
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
