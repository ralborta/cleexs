/** Config de auth admin sin Node crypto — seguro para middleware (Edge). */

import type { AdminRole } from '@/lib/admin-roles';

export const ADMIN_UI_COOKIE_NAME = 'cleexs_admin_ui';

export type AdminSessionLite = {
  role: AdminRole;
  username: string;
};

/** Panel interno abierto por defecto (equipo Cleexs). Forzar login: ADMIN_OPEN_ACCESS=false */
export function adminOpenAccessEnabled(): boolean {
  const raw = process.env.ADMIN_OPEN_ACCESS?.trim().toLowerCase();
  if (raw === 'false') return false;
  return true;
}

export function adminRequireAuthEnabled(): boolean {
  if (adminOpenAccessEnabled()) return false;
  if (process.env.ADMIN_REQUIRE_AUTH === 'false') return false;
  return true;
}

/** Parseo liviano de cookie (sin HMAC): exp + rol para middleware Edge. */
export function parseAdminSessionLite(token: string | undefined | null): AdminSessionLite | null {
  if (!token) return null;
  const parts = token.split('.');

  if (parts.length === 2) {
    const [expStr, sig] = parts;
    if (!expStr || !sig || !/^[a-f0-9]+$/i.test(sig)) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp <= Date.now()) return null;
    return { role: 'admin', username: 'admin' };
  }

  if (parts.length !== 4) return null;

  const [expStr, roleRaw, username, sig] = parts;
  if (!expStr || !sig || !/^[a-f0-9]+$/i.test(sig)) return null;
  if (roleRaw !== 'admin' && roleRaw !== 'marketing') return null;
  if (!username?.trim()) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;

  return { role: roleRaw, username };
}

/** @deprecated Usar parseAdminSessionLite */
export function hasAdminSessionCookie(token: string | undefined | null): boolean {
  return parseAdminSessionLite(token) != null;
}
