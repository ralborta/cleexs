import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const id = encodeURIComponent(params.id);
  try {
    const res = await forwardToCleexsApi(`/api/reports/internal/plan-conquistar/runs/${id}/engines`, {
      method: 'GET',
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

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const id = encodeURIComponent(params.id);
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  try {
    const res = await forwardToCleexsApi(`/api/reports/internal/plan-conquistar/runs/${id}/engines`, {
      method: 'POST',
      body: JSON.stringify(body),
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
