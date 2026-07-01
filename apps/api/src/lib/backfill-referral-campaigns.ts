import { prisma } from './prisma';

const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;

/** ref generado por email "compartir Cleexs" (d + 12 hex del diagnostic id). */
export function isShareFollowupRefCode(refCode: string): boolean {
  return /^d[a-f0-9]{12}$/.test(refCode.trim().toLowerCase());
}

function humanizeRefName(refCode: string): string {
  return refCode
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type BackfillReferralCampaignCandidate = {
  refCode: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  notes: string;
  source: 'diagnostic' | 'pageview' | 'preset';
};

export async function listBackfillReferralCampaignCandidates(options?: {
  since?: Date;
}): Promise<BackfillReferralCampaignCandidate[]> {
  const since = options?.since ?? new Date(Date.now() - THREE_WEEKS_MS);

  const [diagRows, pvRows, existing] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        ref_code: string;
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        latest_at: Date;
      }>
    >`
      SELECT
        LOWER(TRIM(ref_code)) AS ref_code,
        MAX(utm_source) AS utm_source,
        MAX(utm_medium) AS utm_medium,
        MAX(utm_campaign) AS utm_campaign,
        MAX(created_at) AS latest_at
      FROM public_diagnostics
      WHERE created_at >= ${since}
        AND ref_code IS NOT NULL
        AND TRIM(ref_code) != ''
      GROUP BY 1
    `,
    prisma.$queryRaw<
      Array<{
        ref_code: string;
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        latest_at: Date;
      }>
    >`
      SELECT
        LOWER(TRIM(ref_code)) AS ref_code,
        MAX(utm_source) AS utm_source,
        MAX(utm_medium) AS utm_medium,
        MAX(utm_campaign) AS utm_campaign,
        MAX(created_at) AS latest_at
      FROM page_views
      WHERE created_at >= ${since}
        AND ref_code IS NOT NULL
        AND TRIM(ref_code) != ''
      GROUP BY 1
    `,
    prisma.referralCampaign.findMany({ select: { refCode: true } }),
  ]);

  const existingRefs = new Set(existing.map((c) => c.refCode.toLowerCase()));
  const byRef = new Map<string, BackfillReferralCampaignCandidate>();

  function consider(
    refCode: string,
    utmSource: string | null,
    utmMedium: string | null,
    utmCampaign: string | null,
    source: 'diagnostic' | 'pageview'
  ) {
    const ref = refCode.trim().toLowerCase();
    if (!ref || existingRefs.has(ref) || isShareFollowupRefCode(ref)) return;
    if (utmSource?.toLowerCase() === 'email' && utmMedium?.toLowerCase() === 'followup') return;

    const presetName = ref === 'youtube_tv' ? 'YouTube / WhatsApp TV' : humanizeRefName(ref);
    byRef.set(ref, {
      refCode: ref,
      name: presetName,
      utmSource: (utmSource || (ref === 'youtube_tv' ? 'youtube' : 'auspiciador')).toLowerCase(),
      utmMedium: (utmMedium || (ref === 'youtube_tv' ? 'whatsapp' : 'link')).toLowerCase(),
      utmCampaign: (utmCampaign || ref).toLowerCase(),
      notes: `Recuperado automáticamente desde ${source} (${since.toISOString().slice(0, 10)}+)`,
      source: ref === 'youtube_tv' ? 'preset' : source,
    });
  }

  for (const row of diagRows) consider(row.ref_code, row.utm_source, row.utm_medium, row.utm_campaign, 'diagnostic');
  for (const row of pvRows) consider(row.ref_code, row.utm_source, row.utm_medium, row.utm_campaign, 'pageview');

  if (!existingRefs.has('youtube_tv')) {
    byRef.set('youtube_tv', {
      refCode: 'youtube_tv',
      name: 'YouTube / WhatsApp TV',
      utmSource: 'youtube',
      utmMedium: 'whatsapp',
      utmCampaign: 'qr_tv',
      notes: 'Canal WhatsApp/TV (default del flujo QR)',
      source: 'preset',
    });
  }

  return Array.from(byRef.values()).sort((a, b) => a.refCode.localeCompare(b.refCode));
}

export async function runBackfillReferralCampaigns(options?: {
  apply?: boolean;
  since?: Date;
}): Promise<{ candidates: number; created: number; updated: number; sample: BackfillReferralCampaignCandidate[] }> {
  const candidates = await listBackfillReferralCampaignCandidates({ since: options?.since });

  if (!options?.apply) {
    return { candidates: candidates.length, created: 0, updated: 0, sample: candidates.slice(0, 20) };
  }

  let created = 0;
  let updated = 0;

  for (const c of candidates) {
    const existing = await prisma.referralCampaign.findUnique({ where: { refCode: c.refCode } });
    if (existing) {
      await prisma.referralCampaign.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          utmSource: c.utmSource,
          utmMedium: c.utmMedium,
          utmCampaign: c.utmCampaign,
          notes: c.notes,
          active: true,
        },
      });
      updated += 1;
    } else {
      await prisma.referralCampaign.create({
        data: {
          refCode: c.refCode,
          name: c.name,
          utmSource: c.utmSource,
          utmMedium: c.utmMedium,
          utmCampaign: c.utmCampaign,
          notes: c.notes,
          active: true,
        },
      });
      created += 1;
    }
  }

  return { candidates: candidates.length, created, updated, sample: candidates.slice(0, 20) };
}
