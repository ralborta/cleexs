import { NextResponse } from 'next/server';
import { ECOMM_PORTAL_COOKIE, ecommPortalCookieOptions } from '@/lib/ecomm-portal-auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ECOMM_PORTAL_COOKIE, '', { ...ecommPortalCookieOptions(0), maxAge: 0 });
  return res;
}
