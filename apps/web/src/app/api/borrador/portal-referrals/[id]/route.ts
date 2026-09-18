import { NextResponse } from 'next/server';
import { adminApiSecret, apiBaseUrl } from '@/lib/admin-api';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 });

  try {
    const secret = adminApiSecret();
    const base = apiBaseUrl();
    const body = await request.text();
    const res = await fetch(`${base}/api/admin/referrals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'x-admin-secret': secret,
        'Content-Type': 'application/json',
      },
      body,
      cache: 'no-store',
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
