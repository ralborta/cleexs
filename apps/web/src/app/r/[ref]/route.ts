import { NextResponse } from 'next/server';
import { CLEEXS_MARKETING_URL } from '@/lib/site';

function apiBaseUrl(): string {
  return (process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || '').replace(/\/$/, '');
}

function normalizeRef(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 120);
}

function fallbackTarget(refCode: string): string {
  const search = new URLSearchParams();
  search.set('ref', refCode);
  search.set('utm_source', 'auspiciador');
  search.set('utm_medium', 'link');
  search.set('utm_campaign', refCode);
  return `${CLEEXS_MARKETING_URL}/?${search.toString()}`;
}

export async function GET(request: Request, { params }: { params: { ref: string } }) {
  const refCode = normalizeRef(params.ref || '');
  if (!refCode) {
    return NextResponse.redirect(CLEEXS_MARKETING_URL, { status: 302 });
  }

  let targetUrl = fallbackTarget(refCode);
  const base = apiBaseUrl();
  if (base) {
    try {
      const res = await fetch(`${base}/api/referrals/${encodeURIComponent(refCode)}/click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': request.headers.get('user-agent') || '',
          'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        },
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => null)) as { targetUrl?: string } | null;
      if (res.ok && data?.targetUrl) targetUrl = data.targetUrl;
    } catch {
      // Si la API no responde, no rompemos el link de campaña: igual llevamos a la home con ref.
    }
  }

  return NextResponse.redirect(targetUrl, { status: 302 });
}
