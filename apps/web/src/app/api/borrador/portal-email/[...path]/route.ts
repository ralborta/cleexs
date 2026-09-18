import { NextResponse } from 'next/server';
import { forwardToCleexsApi } from '@/lib/admin-api';

type Ctx = { params: { path: string[] } };

/**
 * Proxy del admin de email para el portal (sin cookie admin).
 * Reescribe las mismas rutas que /api/admin-ui/email/* (+ triggers cron).
 */
function resolveTarget(pathParts: string[], method: string, search: string): { path: string; method: string } | null {
  const path = pathParts.join('/');
  const qs = search.startsWith('?') ? search : search ? `?${search}` : '';
  const m = method.toUpperCase();

  if (path === 'monthly-score-emails/trigger' && m === 'POST') {
    return { path: '/api/cron/monthly-score-emails', method: 'POST' };
  }
  if (path === 'free-sequence-preview/trigger' && m === 'POST') {
    return { path: '/api/cron/free-onboarding-emails', method: 'POST' };
  }
  if (path === 'free-sequence-preview' && m === 'PATCH') {
    return { path: '/api/admin/email/free-sequence-preview/config', method: 'PATCH' };
  }
  if (path === 'free-sequence-preview/steps' && m === 'PATCH') {
    return { path: '/api/admin/email/free-sequence-preview/steps/reorder', method: 'POST' };
  }
  if (path === 'templates/preview' && m === 'GET') {
    return { path: `/api/admin/email/templates/preview.json${qs}`, method: 'GET' };
  }

  // Default: mirror /api/admin/email/*
  return { path: `/api/admin/email/${path}${qs}`, method: m };
}

async function proxy(request: Request, ctx: Ctx) {
  try {
    const url = new URL(request.url);
    const target = resolveTarget(ctx.params.path || [], request.method, url.search);
    if (!target) {
      return NextResponse.json({ error: 'Ruta no soportada' }, { status: 404 });
    }

    const init: RequestInit = { method: target.method };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const text = await request.text();
      if (text) init.body = text;
    }

    const res = await forwardToCleexsApi(target.path, init);
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
export async function PUT(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function DELETE(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}
