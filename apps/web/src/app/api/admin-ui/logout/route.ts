import { NextResponse } from 'next/server';
import { adminCookieOptions, COOKIE_NAME, legacyAdminCookieClearOptions } from '@/lib/admin-session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { ...adminCookieOptions(), maxAge: 0 });
  res.cookies.set(COOKIE_NAME, '', legacyAdminCookieClearOptions());
  return res;
}
