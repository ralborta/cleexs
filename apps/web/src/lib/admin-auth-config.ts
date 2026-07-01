/** Config de auth admin sin Node crypto — seguro para middleware (Edge). */

export const ADMIN_UI_COOKIE_NAME = 'cleexs_admin_ui';

export function adminOpenAccessEnabled(): boolean {
  return process.env.ADMIN_OPEN_ACCESS === 'true';
}

export function adminRequireAuthEnabled(): boolean {
  if (adminOpenAccessEnabled()) return false;
  if (process.env.ADMIN_REQUIRE_AUTH === 'false') return false;
  return true;
}

/** Chequeo liviano de cookie (sin HMAC): suficiente para redirect en Edge. */
export function hasAdminSessionCookie(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig || !/^[a-f0-9]+$/i.test(sig)) return false;
  const exp = Number(expStr);
  return Number.isFinite(exp) && exp > Date.now();
}
