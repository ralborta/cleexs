import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export async function GET() {
  if (!assertAdminUiSession()) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const res = await forwardToCleexsApi('/api/admin/dashboard-summary', { method: 'GET' });
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
