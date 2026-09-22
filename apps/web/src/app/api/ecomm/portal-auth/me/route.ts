import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ECOMM_PORTAL_COOKIE,
  ECOMM_PORTAL_TITLE,
  verifyEcommPortalSessionToken,
} from '@/lib/ecomm-portal-auth';

export async function GET() {
  const jar = await cookies();
  const token = jar.get(ECOMM_PORTAL_COOKIE)?.value;
  const session = verifyEcommPortalSessionToken(token);
  if (!session) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    authenticated: true,
    username: session.username,
    portal: ECOMM_PORTAL_TITLE,
  });
}
