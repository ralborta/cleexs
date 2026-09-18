import { NextResponse } from 'next/server';
import { forwardToCleexsApi } from '@/lib/admin-api';

type Ctx = { params: { path?: string[] } };

/**
 * Proxy de Auditoría Agéntica para el portal (sin cookie admin).
 * Misma API que /api/admin-ui/agentic-audits → /api/admin/agentic-audits.
 */
async function proxy(request: Request, ctx: Ctx) {
  try {
    const url = new URL(request.url);
    const parts = ctx.params.path || [];
    const suffix = parts.length ? `/${parts.join('/')}` : '';
    const target = `/api/admin/agentic-audits${suffix}${url.search}`;

    const init: RequestInit = { method: request.method };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const text = await request.text();
      if (text) init.body = text;
    }

    const res = await forwardToCleexsApi(target, init);
    const out = await res.text();
    return new NextResponse(out, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

export async function GET(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function POST(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function PATCH(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function DELETE(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}
