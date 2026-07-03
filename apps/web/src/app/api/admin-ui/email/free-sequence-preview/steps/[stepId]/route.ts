import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export async function PATCH(request: Request, { params }: { params: { stepId: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const stepId = params.stepId?.trim();
  if (!stepId) return NextResponse.json({ error: 'stepId inválido' }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  try {
    const res = await forwardToCleexsApi(`/api/admin/email/free-sequence-preview/steps/${encodeURIComponent(stepId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { stepId: string } }) {
  if (!assertAdminUiSession(_request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const stepId = params.stepId?.trim();
  if (!stepId) return NextResponse.json({ error: 'stepId inválido' }, { status: 400 });
  try {
    const res = await forwardToCleexsApi(`/api/admin/email/free-sequence-preview/steps/${encodeURIComponent(stepId)}`, {
      method: 'DELETE',
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 503 });
  }
}
