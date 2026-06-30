import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { adminCookieOptions, COOKIE_NAME, createAdminSessionToken, legacyAdminCookieClearOptions } from '@/lib/admin-session';

export async function POST(request: Request) {
  const expected = process.env.ADMIN_UI_PASSWORD?.trim();
  if (!expected) {
    return NextResponse.json({ error: 'ADMIN_UI_PASSWORD no configurado en el servidor web.' }, { status: 503 });
  }

  const expectedUsername = (process.env.ADMIN_UI_USERNAME || 'admin').trim();

  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const givenUsername = (body.username || '').trim();
  const givenPassword = (body.password || '').trim();

  const usernameOk = (() => {
    const a = Buffer.from(givenUsername, 'utf8');
    const b = Buffer.from(expectedUsername, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  })();
  const passwordOk = (() => {
    const a = Buffer.from(givenPassword, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  })();

  if (!usernameOk || !passwordOk) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  let token: string;
  try {
    token = createAdminSessionToken();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error de configuración' },
      { status: 503 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', legacyAdminCookieClearOptions());
  res.cookies.set(COOKIE_NAME, token, adminCookieOptions());
  return res;
}
