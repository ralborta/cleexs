const STORAGE_KEY = 'cleexs_sponsor_campaign_history_v1';
const MAX_ENTRIES = 3;

export type SponsorCampaignHistoryEntry = {
  refCode: string;
  sponsorName: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  marketingUrl: string;
  appDiagnosticUrl: string | null;
  whatsAppUrl: string | null;
  whatsAppMessage: string | null;
  /** Cuerpo editable del mensaje (sin gentileza ni ref:). */
  whatsAppCustomMessage: string | null;
  updatedAt: string;
};

function isEntry(value: unknown): value is SponsorCampaignHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const o = value as SponsorCampaignHistoryEntry;
  if (typeof o.refCode !== 'string' || typeof o.marketingUrl !== 'string' || typeof o.updatedAt !== 'string') {
    return false;
  }
  if (o.whatsAppCustomMessage === undefined) {
    (o as SponsorCampaignHistoryEntry).whatsAppCustomMessage = null;
  }
  return true;
}

export function listSponsorCampaignHistory(): SponsorCampaignHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isEntry)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export function upsertSponsorCampaignHistory(
  entry: Omit<SponsorCampaignHistoryEntry, 'updatedAt'> & { updatedAt?: string }
): SponsorCampaignHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  const ref = entry.refCode.trim().toLowerCase();
  if (!ref) return listSponsorCampaignHistory();

  const next: SponsorCampaignHistoryEntry = {
    refCode: ref,
    sponsorName: entry.sponsorName.trim(),
    utmSource: entry.utmSource.trim() || 'auspiciador',
    utmMedium: entry.utmMedium.trim() || 'link',
    utmCampaign: entry.utmCampaign.trim(),
    marketingUrl: entry.marketingUrl,
    appDiagnosticUrl: entry.appDiagnosticUrl,
    whatsAppUrl: entry.whatsAppUrl,
    whatsAppMessage: entry.whatsAppMessage,
    whatsAppCustomMessage: entry.whatsAppCustomMessage ?? null,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
  };

  const rest = listSponsorCampaignHistory().filter((e) => e.refCode !== ref);
  const merged: SponsorCampaignHistoryEntry[] = [next, ...rest].slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* quota / private mode */
  }
  return merged;
}

/** Fusiona con entrada existente (no pierde WA si solo actualizás el link web). */
export function patchSponsorCampaignHistory(
  refCode: string,
  patch: Partial<Omit<SponsorCampaignHistoryEntry, 'refCode' | 'updatedAt'>>
): SponsorCampaignHistoryEntry[] {
  const ref = refCode.trim().toLowerCase();
  const existing = listSponsorCampaignHistory().find((e) => e.refCode === ref);
  if (!existing) {
    if (!patch.marketingUrl) return listSponsorCampaignHistory();
    return upsertSponsorCampaignHistory({
      refCode: ref,
      sponsorName: patch.sponsorName ?? '',
      utmSource: patch.utmSource ?? 'auspiciador',
      utmMedium: patch.utmMedium ?? 'link',
      utmCampaign: patch.utmCampaign ?? '',
      marketingUrl: patch.marketingUrl,
      appDiagnosticUrl: patch.appDiagnosticUrl ?? null,
      whatsAppUrl: patch.whatsAppUrl ?? null,
      whatsAppMessage: patch.whatsAppMessage ?? null,
      whatsAppCustomMessage: patch.whatsAppCustomMessage ?? null,
    });
  }
  return upsertSponsorCampaignHistory({
    ...existing,
    ...patch,
    refCode: ref,
    marketingUrl: patch.marketingUrl ?? existing.marketingUrl,
    appDiagnosticUrl:
      patch.appDiagnosticUrl !== undefined ? patch.appDiagnosticUrl : existing.appDiagnosticUrl,
    whatsAppUrl: patch.whatsAppUrl !== undefined ? patch.whatsAppUrl : existing.whatsAppUrl,
    whatsAppMessage:
      patch.whatsAppMessage !== undefined ? patch.whatsAppMessage : existing.whatsAppMessage,
    whatsAppCustomMessage:
      patch.whatsAppCustomMessage !== undefined
        ? patch.whatsAppCustomMessage
        : existing.whatsAppCustomMessage,
  });
}

export function removeSponsorCampaignHistory(refCode: string): SponsorCampaignHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  const ref = refCode.trim().toLowerCase();
  const merged = listSponsorCampaignHistory().filter((e) => e.refCode !== ref);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  return merged;
}

export function clearSponsorCampaignHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
