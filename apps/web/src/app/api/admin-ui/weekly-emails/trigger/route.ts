import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

const triggerSchema = {
  segment(value: unknown): 'all' | 'free' | 'premium' {
    return value === 'all' || value === 'premium' || value === 'free' ? value : 'free';
  },
  weekSlot(value: unknown): 1 | 2 | 3 | 4 | undefined {
    return value === 1 || value === 2 || value === 3 || value === 4 ? value : undefined;
  },
};

export async function POST(request: Request) {
  if (!assertAdminUiSession(request)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const dryRun = body.dryRun !== false;
  const limit = Math.min(1000, Math.max(1, Number(body.limit) || 50));
  const payload: Record<string, unknown> = {
    force: true,
    dryRun,
    limit,
    segment: triggerSchema.segment(body.segment),
  };
  const weekSlot = triggerSchema.weekSlot(body.weekSlot);
  if (weekSlot) payload.weekSlot = weekSlot;

  try {
    const res = await forwardToCleexsApi('/api/cron/weekly-emails', {
      method: 'POST',
      body: JSON.stringify(payload),
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
