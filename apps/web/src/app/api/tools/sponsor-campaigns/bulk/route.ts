import { NextResponse } from 'next/server';
import { forwardToCleexsApi } from '@/lib/admin-api';

type BulkCampaignInput = {
  name: string;
  refCode: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  notes?: string;
  active?: boolean;
};

/** Migración masiva desde historial local del navegador. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const campaigns = (body as { campaigns?: BulkCampaignInput[] }).campaigns;
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return NextResponse.json({ error: 'Se requiere campaigns[]' }, { status: 400 });
  }
  if (campaigns.length > 50) {
    return NextResponse.json({ error: 'Máximo 50 campañas por request' }, { status: 400 });
  }

  try {
    const res = await forwardToCleexsApi('/api/admin/referrals/upsert/bulk', {
      method: 'PUT',
      body: JSON.stringify(campaigns),
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
