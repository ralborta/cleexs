import { cookies } from 'next/headers';
import { COOKIE_NAME, verifyAdminSessionToken } from '@/lib/admin-session';

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

export function assertAdminUiSession(): boolean {
  const c = cookies().get(COOKIE_NAME)?.value;
  return verifyAdminSessionToken(c);
}

export async function forwardToCleexsApi(path: string, init: RequestInit): Promise<Response> {
  const base = apiBaseUrl();
  const secret = adminApiSecret();
  const headers = new Headers(init.headers);
  headers.set('x-admin-secret', secret);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${base}${path}`, { ...init, headers });
}
