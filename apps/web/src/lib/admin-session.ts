import { createHmac, timingSafeEqual } from 'crypto';
import {
  adminOpenAccessEnabled,
  adminRequireAuthEnabled,
  ADMIN_UI_COOKIE_NAME,
} from '@/lib/admin-auth-config';
import type { AdminRole } from '@/lib/admin-roles';

const COOKIE_NAME = ADMIN_UI_COOKIE_NAME;

export { COOKIE_NAME, adminOpenAccessEnabled, adminRequireAuthEnabled };

export type AdminSessionPayload = {
  role: AdminRole;
  username: string;
};

function sessionSecret(): string {
  const password = normalizeEnvSecret(process.env.ADMIN_UI_PASSWORD);
  const sessionSecretValue = normalizeEnvSecret(process.env.ADMIN_UI_SESSION_SECRET);
  return sessionSecretValue || password || 'cleexs-admin-session-fallback';
}

export function normalizeEnvSecret(value: string | undefined): string {
  const trimmed = `${value || ''}`.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Token: `${expMs}.${role}.${username}.${hexSig}` · legacy 2-part = admin */
export function createAdminSessionToken(session: AdminSessionPayload): string {
  const secret = sessionSecret();
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = `${exp}.${session.role}.${session.username}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): AdminSessionPayload | null {
  if (!token) return null;
  const secret = sessionSecret();
  const parts = token.split('.');

  if (parts.length === 2) {
    const [expStr, sig] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now()) return null;
    const expected = createHmac('sha256', secret).update(expStr).digest('hex');
    try {
      if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    } catch {
      return null;
    }
    return { role: 'admin', username: normalizeEnvSecret(process.env.ADMIN_UI_USERNAME || 'admin') };
  }

  if (parts.length !== 4) return null;

  const [expStr, roleRaw, username, sig] = parts;
  if (roleRaw !== 'admin' && roleRaw !== 'marketing') return null;
  if (!username?.trim()) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;

  const payload = `${expStr}.${roleRaw}.${username}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  } catch {
    return null;
  }

  return { role: roleRaw, username };
}

/** Path debe incluir `/api/admin-ui/*`: si fuera solo `/admin`, el navegador no envía la cookie en fetch al proxy API y todas las rutas admin-ui devuelven 401. */
export function adminCookieOptions() {
  const maxAge = 30 * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true as const,
    secure,
    sameSite: 'lax' as const,
    path: '/' as const,
    maxAge,
  };
}

/** Cookie antigua (solo path `/admin`): hay que borrarla en login/logout para evitar duplicados. */
export function legacyAdminCookieClearOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/admin' as const,
    maxAge: 0,
  };
}
