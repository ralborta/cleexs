import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'cleexs_admin_ui';

export { COOKIE_NAME };

function sessionSecret(): string {
  return (
    process.env.ADMIN_UI_SESSION_SECRET?.trim() ||
    process.env.ADMIN_UI_PASSWORD?.trim() ||
    ''
  );
}

/** Token: `${expMs}.${hexSig}` */
export function createAdminSessionToken(): string {
  const secret = sessionSecret();
  if (!secret) throw new Error('ADMIN_UI_PASSWORD o ADMIN_UI_SESSION_SECRET no configurado');
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const payload = String(exp);
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = sessionSecret();
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac('sha256', secret).update(expStr).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/** Path debe incluir `/api/admin-ui/*`: si fuera solo `/admin`, el navegador no envía la cookie en fetch al proxy API y todas las rutas admin-ui devuelven 401. */
export function adminCookieOptions() {
  const maxAge = 8 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true as const,
    secure,
    sameSite: 'lax' as const,
    path: '/' as const,
    maxAge,
  };
}
