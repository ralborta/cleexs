import { NextResponse } from 'next/server';
import { adminApiSecret, apiBaseUrl } from '@/lib/admin-api';

const ALLOWED = new Set(['empliados.net', 'trafogli.com']);

function parseDomain(request: Request): string | null {
  const url = new URL(request.url);
  const domain = (url.searchParams.get('domain') || '').trim().toLowerCase();
  if (!domain || !ALLOWED.has(domain)) return null;
  return domain;
}

async function proxy(domain: string, init?: RequestInit) {
  const secret = adminApiSecret();
  const base = apiBaseUrl();
  const res = await fetch(`${base}/api/admin/brand-portal/${encodeURIComponent(domain)}`, {
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

export async function GET(request: Request) {
  const domain = parseDomain(request);
  if (!domain) {
    return NextResponse.json({ error: 'Dominio no permitido en borrador' }, { status: 400 });
  }
  try {
    return await proxy(domain, { method: 'GET' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de configuración';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const domain = parseDomain(request);
  if (!domain) {
    return NextResponse.json({ error: 'Dominio no permitido en borrador' }, { status: 400 });
  }
  try {
    const body = await request.text();
    return await proxy(domain, { method: 'PATCH', body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de configuración';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
