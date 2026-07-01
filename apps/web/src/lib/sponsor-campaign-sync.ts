import {
  buildSponsorDiagnosticAppUrl,
  buildSponsorMarketingHomeUrl,
  normalizeTrackingValue,
} from '@/lib/sponsor-link';
import type { SponsorCampaignHistoryEntry } from '@/lib/sponsor-campaign-history';

export type ServerSponsorCampaign = {
  id: string;
  refCode: string;
  name: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  active: boolean;
  updatedAt: string;
};

export function serverCampaignToHistoryEntry(
  campaign: ServerSponsorCampaign,
  local?: Partial<SponsorCampaignHistoryEntry>
): SponsorCampaignHistoryEntry {
  const utmSource = campaign.utmSource || local?.utmSource || 'auspiciador';
  const utmMedium = campaign.utmMedium || local?.utmMedium || 'link';
  const utmCampaign = campaign.utmCampaign || local?.utmCampaign || campaign.refCode;
  const linkParams = {
    ref: campaign.refCode,
    utmSource,
    utmMedium,
    utmCampaign,
  };

  return {
    refCode: campaign.refCode,
    sponsorName: campaign.name || local?.sponsorName || campaign.refCode,
    utmSource,
    utmMedium,
    utmCampaign,
    marketingUrl:
      local?.marketingUrl || buildSponsorMarketingHomeUrl(linkParams) || '',
    appDiagnosticUrl:
      local?.appDiagnosticUrl ?? buildSponsorDiagnosticAppUrl(linkParams),
    whatsAppUrl: local?.whatsAppUrl ?? null,
    whatsAppMessage: local?.whatsAppMessage ?? null,
    whatsAppCustomMessage: local?.whatsAppCustomMessage ?? null,
    updatedAt: local?.updatedAt ?? campaign.updatedAt,
  };
}

export async function fetchServerSponsorCampaigns(): Promise<ServerSponsorCampaign[]> {
  const res = await fetch('/api/tools/sponsor-campaigns', { cache: 'no-store' });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as { campaigns?: ServerSponsorCampaign[] } | null;
  return data?.campaigns ?? [];
}

export async function syncSponsorCampaignToServer(input: {
  refCode: string;
  sponsorName: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}): Promise<{ ok: boolean; error?: string }> {
  const refCode = normalizeTrackingValue(input.refCode);
  if (!refCode) return { ok: false, error: 'ref inválido' };

  const name = input.sponsorName.trim() || refCode;
  const utmCampaign = normalizeTrackingValue(input.utmCampaign) || refCode;

  try {
    const res = await fetch('/api/tools/sponsor-campaigns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        refCode,
        utmSource: normalizeTrackingValue(input.utmSource) || 'auspiciador',
        utmMedium: normalizeTrackingValue(input.utmMedium) || 'link',
        utmCampaign,
        notes: 'Registrado desde /tools/auspiciadores',
        active: true,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error || 'No se pudo guardar en el servidor' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Error de red al guardar la campaña' };
  }
}

/** Fusiona campañas del servidor con cache local (WhatsApp, URLs recientes). */
export function mergeSponsorCampaignHistory(
  server: ServerSponsorCampaign[],
  local: SponsorCampaignHistoryEntry[]
): SponsorCampaignHistoryEntry[] {
  const localByRef = new Map(local.map((e) => [e.refCode, e]));
  const merged = server.map((c) => serverCampaignToHistoryEntry(c, localByRef.get(c.refCode)));

  for (const entry of local) {
    if (!merged.some((m) => m.refCode === entry.refCode)) {
      merged.push(entry);
    }
  }

  return merged.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
