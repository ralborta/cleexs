import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export async function GET(
  request: Request,
  context: { params: { logId: string } }
) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const logId = context.params.logId?.trim();
  if (!logId) {
    return NextResponse.json({ error: 'logId requerido' }, { status: 400 });
  }

  try {
    const res = await forwardToCleexsApi(`/api/admin/email/logs/${encodeURIComponent(logId)}/content`, {
      method: 'GET',
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
