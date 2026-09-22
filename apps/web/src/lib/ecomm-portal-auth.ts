import { createHmac, timingSafeEqual } from 'crypto';

export const ECOMM_PORTAL_COOKIE = 'cleexs_ecomm_portal';
export const ECOMM_PORTAL_TITLE = 'Admin Ecomm';

/** Defaults for demo portal (override with ECOMM_PORTAL_USERNAME / ECOMM_PORTAL_PASSWORD). */
export const ECOMM_PORTAL_DEFAULT_USERNAME = 'Demo';
export const ECOMM_PORTAL_DEFAULT_PASSWORD = 'EmpliadosDemo26';

const SESSION_VERSION = 1;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeSecret(value: string | undefined): string {
  const trimmed = `${value || ''}`.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function expectedUsername(): string {
  return normalizeSecret(process.env.ECOMM_PORTAL_USERNAME) || ECOMM_PORTAL_DEFAULT_USERNAME;
}

function expectedPassword(): string {
  return normalizeSecret(process.env.ECOMM_PORTAL_PASSWORD) || ECOMM_PORTAL_DEFAULT_PASSWORD;
}

function sessionSecret(): string {
  return (
    normalizeSecret(process.env.ECOMM_PORTAL_SESSION_SECRET) ||
    normalizeSecret(process.env.ECOMM_PORTAL_PASSWORD) ||
    ECOMM_PORTAL_DEFAULT_PASSWORD
  );
}

export function verifyEcommPortalCredentials(usernameInput: string, passwordInput: string): boolean {
  const username = usernameInput.trim();
  const password = passwordInput;
  if (!username || !password) return false;

  const userOk = username.toLowerCase() === expectedUsername().toLowerCase();
  const passOk = password === expectedPassword();
  return userOk && passOk;
}

/** Token: `${expMs}.${version}.${username}.${hexSig}` */
export function createEcommPortalSessionToken(username: string): string {
  const secret = sessionSecret();
  const exp = Date.now() + SESSION_TTL_MS;
  const safeUser = username.trim().toLowerCase().replace(/[^a-z0-9._-]/gi, '') || 'demo';
  const payload = `${exp}.${SESSION_VERSION}.${safeUser}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyEcommPortalSessionToken(token: string | undefined | null): { username: string } | null {
  if (!token) return null;
  const secret = sessionSecret();
  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [expStr, versionStr, username, sig] = parts;
  if (Number(versionStr) !== SESSION_VERSION) return null;
  if (!username?.trim()) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;

  const payload = `${expStr}.${versionStr}.${username}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return { username };
}

export function ecommPortalCookieOptions(maxAgeSec = Math.floor(SESSION_TTL_MS / 1000)) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}
