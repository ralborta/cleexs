import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const id = encodeURIComponent(params.id);
  try {
    const res = await forwardToCleexsApi(`/api/admin/aeo-audits/${id}/run`, { method: 'POST' });
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
