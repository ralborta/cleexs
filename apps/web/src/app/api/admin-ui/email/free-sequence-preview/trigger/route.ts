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

  const dryRun = body.dryRun !== false;
  const force = body.force !== false;
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 50));
  const enrolledWithinDays = Math.min(180, Math.max(7, Number(body.enrolledWithinDays) || 60));

  try {
    const res = await forwardToCleexsApi('/api/cron/free-onboarding-emails', {
      method: 'POST',
      body: JSON.stringify({ dryRun, force, limit, enrolledWithinDays }),
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
