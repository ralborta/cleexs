import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { adminCookieOptions, COOKIE_NAME, createAdminSessionToken } from '@/lib/admin-session';

export async function POST(request: Request) {
  const expected = process.env.ADMIN_UI_PASSWORD?.trim();
  if (!expected) {
    return NextResponse.json({ error: 'ADMIN_UI_PASSWORD no configurado en el servidor web.' }, { status: 503 });
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const given = (body.password || '').trim();
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
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
  res.cookies.set(COOKIE_NAME, token, adminCookieOptions());
  return res;
}
