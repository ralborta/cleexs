import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { chatId: string } }) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const chatId = params.chatId?.trim();
  if (!chatId) return NextResponse.json({ error: 'chatId inválido' }, { status: 400 });
  try {
    const incoming = new URL(request.url);
    const target = `/api/reports/internal/whatsapp/conversations/${encodeURIComponent(chatId)}/messages${incoming.search || ''}`;
    const res = await forwardToCleexsApi(target, { method: 'GET' });
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
