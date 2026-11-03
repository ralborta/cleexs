import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

type Ctx = { params: { path: string[] } };

async function proxy(request: Request, ctx: Ctx) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const path = (ctx.params.path || []).filter(Boolean).join('/');
  if (!path || path.includes('..')) {
    return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  }

  try {
    const incoming = new URL(request.url);
    const target = `/api/reports/internal/${path}${incoming.search || ''}`;
    const method = request.method.toUpperCase();
    const init: RequestInit = { method, cache: 'no-store' };
    if (method !== 'GET' && method !== 'HEAD') {
      init.body = await request.text();
    }
    const res = await forwardToCleexsApi(target, init);
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

export async function GET(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}

export async function POST(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}

export async function PATCH(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}

export async function PUT(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}

export async function DELETE(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}
