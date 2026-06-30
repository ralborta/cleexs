import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

// PUT /api/admin-ui/strings/:key — upsert
export async function PUT(request: Request, { params }: { params: { key: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const key = encodeURIComponent(params.key);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  try {
    const res = await forwardToCleexsApi(`/api/admin/strings/${key}`, {
      method: 'PUT',
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

// DELETE /api/admin-ui/strings/:key?locale=es — borra y vuelve al default del código
export async function DELETE(request: Request, { params }: { params: { key: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const key = encodeURIComponent(params.key);
  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  const path = qs ? `/api/admin/strings/${key}?${qs}` : `/api/admin/strings/${key}`;
  try {
    const res = await forwardToCleexsApi(path, { method: 'DELETE' });
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
