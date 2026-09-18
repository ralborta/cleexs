import { NextResponse } from 'next/server';
import { adminApiSecret, apiBaseUrl } from '@/lib/admin-api';

async function proxy(init?: RequestInit) {
  const secret = adminApiSecret();
  const base = apiBaseUrl();
  const res = await fetch(`${base}/api/admin/referrals`, {
    ...init,
    headers: {
      'x-admin-secret': secret,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
  });
}

export async function GET() {
  try {
    return await proxy({ method: 'GET' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    return await proxy({ method: 'POST', body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
