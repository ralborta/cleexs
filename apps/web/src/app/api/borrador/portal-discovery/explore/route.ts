import { NextResponse } from 'next/server';
import { agenteCleexsFetch } from '@/lib/agente-cleexs';

/** Proxy POST explore (mismo endpoint que Agente Cleexs Discovery). */
export async function POST(request: Request) {
  try {
    const incoming = new URL(request.url);
    const workspace = (incoming.searchParams.get('workspace') || 'empleados').trim();
    const body = await request.text();
    const res = await agenteCleexsFetch(`/api/discovery/${encodeURIComponent(workspace)}/explore`, {
      method: 'POST',
      body,
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
