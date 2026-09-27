import { NextResponse } from 'next/server';
import { adminApiSecret, apiBaseUrl } from '@/lib/admin-api';

type Ctx = { params: { path: string[] } };

const ALLOWED = new Set([
  'acquisition',
  'acquisition/diagnostic-search',
  'onboarding-profile',
  'email-outreach',
]);

/** Proxy de reportes internos Cleexs para el portal Empliados (mismo patrón que portal-funnel). */
export async function GET(request: Request, ctx: Ctx) {
  try {
    const path = (ctx.params.path || []).join('/');
    if (!ALLOWED.has(path)) {
      return NextResponse.json({ error: 'Ruta de reporte no permitida' }, { status: 404 });
    }
    const secret = adminApiSecret();
    const base = apiBaseUrl();
    const incoming = new URL(request.url);
    const res = await fetch(`${base}/api/reports/internal/${path}${incoming.search || ''}`, {
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
