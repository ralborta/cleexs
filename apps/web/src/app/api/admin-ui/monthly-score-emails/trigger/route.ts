import { NextResponse } from 'next/server';
import { assertAdminUiSession, forwardToCleexsApi } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

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

  const dryRun = body.dryRun === true;
  const limit = Math.min(1000, Math.max(1, Number(body.limit) || 4));
  const segment =
    body.segment === 'all' || body.segment === 'premium' || body.segment === 'free' ? body.segment : 'all';
  const variant = body.variant === 'editorial' ? 'editorial' : 'letter';

  const payload = {
    force: true,
    dryRun,
    limit,
    segment,
    variant,
  };

  try {
    const res = await forwardToCleexsApi('/api/cron/monthly-score-emails', {
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
