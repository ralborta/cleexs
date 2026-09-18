import { NextResponse } from 'next/server';
import { agenteCleexsFetch } from '@/lib/agente-cleexs';

/** Proxy Discovery status + oportunidades (mismo backend que /cleexs/discovery). */
export async function GET(request: Request) {
  try {
    const incoming = new URL(request.url);
    const workspace = (incoming.searchParams.get('workspace') || 'empleados').trim();
    const [statusRes, oppsRes] = await Promise.all([
      agenteCleexsFetch(`/api/discovery/${encodeURIComponent(workspace)}/status`),
      agenteCleexsFetch(`/api/opportunities?workspace=${encodeURIComponent(workspace)}`),
    ]);

    const statusText = await statusRes.text();
    const oppsText = await oppsRes.text();
    if (!statusRes.ok) {
      return new NextResponse(statusText, {
        status: statusRes.status,
        headers: { 'Content-Type': statusRes.headers.get('Content-Type') || 'application/json' },
      });
    }
    if (!oppsRes.ok) {
      return new NextResponse(oppsText, {
        status: oppsRes.status,
        headers: { 'Content-Type': oppsRes.headers.get('Content-Type') || 'application/json' },
      });
    }

    const status = JSON.parse(statusText) as Record<string, unknown>;
    const opps = JSON.parse(oppsText) as Record<string, unknown>;
    return NextResponse.json({ ok: true, workspace, status, opportunities: opps });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
