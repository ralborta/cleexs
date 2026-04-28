import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/admin-session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/admin', secure: process.env.NODE_ENV === 'production', maxAge: 0 });
  return res;
}
