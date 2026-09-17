import { NextResponse } from 'next/server';
import { adminApiSecret, apiBaseUrl } from '@/lib/admin-api';

/** Proxy del funnel interno Cleexs (mismo endpoint que /admin/funnel) para el borrador de portal. */
export async function GET(request: Request) {
  try {
    const secret = adminApiSecret();
    const base = apiBaseUrl();
    const incoming = new URL(request.url);
    const res = await fetch(`${base}/api/reports/internal/funnel-metrics${incoming.search || ''}`, {
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
