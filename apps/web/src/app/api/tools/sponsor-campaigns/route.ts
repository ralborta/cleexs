import { NextResponse } from 'next/server';
import { forwardToCleexsApi } from '@/lib/admin-api';

type ReferralCampaignRow = {
  id: string | null;
  registered?: boolean;
  isUnattributed?: boolean;
  refCode: string;
  name: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Lista campañas registradas (misma fuente que /admin/referidores). */
export async function GET() {
  try {
    const res = await forwardToCleexsApi('/api/admin/referrals', { method: 'GET' });
    const text = await res.text();
    if (!res.ok) {
      return new NextResponse(text, {
        status: res.status,
        headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
      });
    }
    const data = JSON.parse(text) as { rows?: ReferralCampaignRow[] };
    const campaigns = (data.rows ?? [])
      .filter(
        (row) =>
          row.registered &&
          row.id &&
          row.refCode &&
          !row.isUnattributed
      )
      .map((row) => ({
        id: row.id,
        refCode: row.refCode,
        name: row.name,
        utmSource: row.utmSource,
        utmMedium: row.utmMedium,
        utmCampaign: row.utmCampaign,
        active: row.active,
        updatedAt: row.updatedAt ?? row.createdAt ?? new Date().toISOString(),
      }));
    return NextResponse.json({ campaigns });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

/** Registra o actualiza campaña en BD (upsert por ref). */
export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  try {
    const res = await forwardToCleexsApi('/api/admin/referrals/upsert', {
      method: 'PUT',
      body: JSON.stringify(body),
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
