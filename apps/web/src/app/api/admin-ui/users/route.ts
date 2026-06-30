import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export async function GET(request: Request) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  if (q.length < 2) {
    return NextResponse.json({ error: 'Parámetro q requerido (mín. 2 caracteres)' }, { status: 400 });
  }

  const path = `/api/admin/users?q=${encodeURIComponent(q)}`;

  try {
    const res = await forwardToCleexsApi(path, { method: 'GET' });
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
