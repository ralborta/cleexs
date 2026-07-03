import { prisma } from './prisma';
import { isShareFollowupRefCode } from './backfill-referral-campaigns';
import {
  SPONSOR_NAMES,
  SPONSOR_REFS,
  type SponsorRef,
} from './sponsor-reattribution';
import { isPlaceholderDiagnosticEmail } from './referral-attribution';

export { SPONSOR_NAMES, SPONSOR_REFS, type SponsorRef };

/** Refs históricos desactivados (share score / placeholder WA). */
export const INACTIVE_LEGACY_REFS = [
  'getplika-com',
  'doble-comando-com-ar',
  'barquieririgoyen-es',
  'youtube_tv',
] as const;

export const SHARE_FOLLOWUP_LABEL = 'Compartir Cleexs (email)';

export type ReferrerDisplayCategory =
  | 'sponsor'
  | 'registered'
  | 'share_followup'
  | 'inactive_legacy'
  | 'other';

export type ReferrerCampaignMeta = {
  name: string;
  active: boolean;
};

export function isSponsorRef(refCode: string): boolean {
  const ref = refCode.trim().toLowerCase();
  return (SPONSOR_REFS as readonly string[]).includes(ref);
}

export function isInactiveLegacyRef(refCode: string): boolean {
  const ref = refCode.trim().toLowerCase();
  return (INACTIVE_LEGACY_REFS as readonly string[]).includes(ref);
}

export function classifyReferrerRef(
  refCode: string,
  registered?: boolean
): ReferrerDisplayCategory {
  const ref = refCode.trim().toLowerCase();
  if (isSponsorRef(ref)) return 'sponsor';
  if (isShareFollowupRefCode(ref)) return 'share_followup';
  if (isInactiveLegacyRef(ref)) return 'inactive_legacy';
  if (registered) return 'registered';
  return 'other';
}

export function resolveReferrerDisplayName(
  refCode: string,
  campaignName?: string | null,
  referrerNameByRef?: Map<string, string>
): string {
  const ref = refCode.trim().toLowerCase();
  if (isSponsorRef(ref)) return SPONSOR_NAMES[ref as SponsorRef];
  if (campaignName?.trim()) return campaignName.trim();
  const fromMap = referrerNameByRef?.get(ref);
  if (fromMap) return fromMap;
  if (isShareFollowupRefCode(ref)) return SHARE_FOLLOWUP_LABEL;
  return ref;
}

export async function loadReferrerCampaignMap(): Promise<Map<string, ReferrerCampaignMeta>> {
  const campaigns = await prisma.referralCampaign.findMany({
    select: { refCode: true, name: true, active: true },
  });
  return new Map(
    campaigns.map((c) => [c.refCode.toLowerCase(), { name: c.name, active: c.active }] as const)
  );
}

export function isWhatsAppDiagnosticChannel(
  sourceChannel: string | null | undefined,
  utmMedium?: string | null
): boolean {
  if (`${sourceChannel || ''}`.trim().toLowerCase() === 'whatsapp_yt') return true;
  return `${utmMedium || ''}`.trim().toLowerCase() === 'whatsapp';
}

type ReferrerMetricsInput = {
  refCode: string;
  visits: number;
};

export type EnrichedReferrerMetrics<T extends ReferrerMetricsInput> = T & {
  name: string;
  registered: boolean;
  active: boolean;
  isSponsor: boolean;
  category: ReferrerDisplayCategory;
};

const CATEGORY_SORT_ORDER: Record<ReferrerDisplayCategory, number> = {
  sponsor: 0,
  registered: 1,
  other: 2,
  share_followup: 3,
  inactive_legacy: 4,
};

export function enrichAndSortReferrerMetrics<T extends ReferrerMetricsInput>(
  rows: T[],
  campaignMap: Map<string, ReferrerCampaignMeta>,
  options?: { limit?: number }
): EnrichedReferrerMetrics<T>[] {
  const enriched = rows.map((row) => {
    const ref = row.refCode.trim().toLowerCase();
    const campaign = campaignMap.get(ref);
    const registered = Boolean(campaign);
    const category = classifyReferrerRef(ref, registered);
    return {
      ...row,
      name: resolveReferrerDisplayName(ref, campaign?.name),
      registered,
      active: campaign?.active ?? isSponsorRef(ref),
      isSponsor: isSponsorRef(ref),
      category,
    };
  });

  enriched.sort((a, b) => {
    const orderDiff = CATEGORY_SORT_ORDER[a.category] - CATEGORY_SORT_ORDER[b.category];
    if (orderDiff !== 0) return orderDiff;
    return b.visits - a.visits;
  });

  const limit = options?.limit ?? 15;
  return enriched.slice(0, limit);
}

export type SponsorChannelBreakdownRow = {
  refCode: SponsorRef;
  name: string;
  web: { diagnostics: number; withEmail: number };
  whatsapp: { diagnostics: number; withEmail: number };
  total: { diagnostics: number; withEmail: number };
};

export function buildSponsorChannelBreakdown(
  diagnostics: Array<{
    refCode: string | null;
    sourceChannel: string | null;
    email: string | null;
    utmMedium: string | null;
  }>
): SponsorChannelBreakdownRow[] {
  const empty = () => ({ diagnostics: 0, withEmail: 0 });
  const byRef = new Map<SponsorRef, SponsorChannelBreakdownRow>(
    SPONSOR_REFS.map((ref) => [
      ref,
      {
        refCode: ref,
        name: SPONSOR_NAMES[ref],
        web: empty(),
        whatsapp: empty(),
        total: empty(),
      },
    ])
  );

  for (const row of diagnostics) {
    const ref = (row.refCode || '').trim().toLowerCase();
    if (!isSponsorRef(ref)) continue;
    const bucket = byRef.get(ref as SponsorRef);
    if (!bucket) continue;

    const hasEmail = Boolean(row.email?.trim()) && !isPlaceholderDiagnosticEmail(row.email);
    const channel = isWhatsAppDiagnosticChannel(row.sourceChannel, row.utmMedium)
      ? bucket.whatsapp
      : bucket.web;

    channel.diagnostics += 1;
    bucket.total.diagnostics += 1;
    if (hasEmail) {
      channel.withEmail += 1;
      bucket.total.withEmail += 1;
    }
  }

  return SPONSOR_REFS.map((ref) => byRef.get(ref)!);
}
