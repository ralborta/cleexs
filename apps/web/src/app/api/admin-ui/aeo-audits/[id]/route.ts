import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const id = encodeURIComponent(params.id);
  try {
    const res = await forwardToCleexsApi(`/api/admin/aeo-audits/${id}`, { method: 'GET' });
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const id = encodeURIComponent(params.id);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  try {
    const res = await forwardToCleexsApi(`/api/admin/aeo-audits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const id = encodeURIComponent(params.id);
  try {
    const res = await forwardToCleexsApi(`/api/admin/aeo-audits/${id}`, { method: 'DELETE' });
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
