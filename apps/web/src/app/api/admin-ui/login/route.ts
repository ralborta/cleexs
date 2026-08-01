import { NextResponse } from 'next/server';
import {
  adminCookieOptions,
  COOKIE_NAME,
  createAdminSessionToken,
  legacyAdminCookieClearOptions,
} from '@/lib/admin-session';
import { defaultAdminHomeForRole } from '@/lib/admin-roles';
import { verifyAdminCredentials } from '@/lib/admin-users';

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const givenUsername = (body.username || '').trim();
  const givenPassword = body.password || '';

  const account = verifyAdminCredentials(givenUsername, givenPassword);
  if (!account) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  let token: string;
  try {
    token = createAdminSessionToken({ role: account.role, username: account.username });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error de configuración' },
      { status: 503 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    role: account.role,
    username: account.username,
    redirectTo: defaultAdminHomeForRole(account.role),
  });
  res.cookies.set(COOKIE_NAME, '', legacyAdminCookieClearOptions());
  res.cookies.set(COOKIE_NAME, token, adminCookieOptions());
  return res;
}
