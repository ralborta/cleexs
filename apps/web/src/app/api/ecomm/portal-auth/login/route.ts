import { NextResponse } from 'next/server';
import {
  ECOMM_PORTAL_COOKIE,
  ECOMM_PORTAL_TITLE,
  createEcommPortalSessionToken,
  ecommPortalCookieOptions,
  verifyEcommPortalCredentials,
} from '@/lib/ecomm-portal-auth';

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!verifyEcommPortalCredentials(username, password)) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  const token = createEcommPortalSessionToken(username);
  const res = NextResponse.json({
    ok: true,
    username: username.trim(),
    portal: ECOMM_PORTAL_TITLE,
  });
  res.cookies.set(ECOMM_PORTAL_COOKIE, token, ecommPortalCookieOptions());
  return res;
}
