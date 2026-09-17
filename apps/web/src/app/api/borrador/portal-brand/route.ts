import { NextResponse } from 'next/server';
import { adminApiSecret, apiBaseUrl } from '@/lib/admin-api';

const ALLOWED = new Set(['empliados.net', 'trafogli.com']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = (url.searchParams.get('domain') || '').trim().toLowerCase();
  if (!domain || !ALLOWED.has(domain)) {
    return NextResponse.json({ error: 'Dominio no permitido en borrador' }, { status: 400 });
  }

  try {
    const secret = adminApiSecret();
    const base = apiBaseUrl();
    const res = await fetch(`${base}/api/admin/brand-portal/${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: { 'x-admin-secret': secret },
      cache: 'no-store',
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de configuración';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
