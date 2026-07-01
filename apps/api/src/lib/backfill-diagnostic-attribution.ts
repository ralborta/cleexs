import { prisma } from './prisma';

export type BackfillCandidate = {
  diagnosticId: string;
  refCode: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  source: 'share_unlock' | 'pageview_session';
};

type RawCandidate = {
  diagnostic_id: string;
  ref_code: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  source: string;
};

/** Diagnósticos sin ref vinculados por visitorId en share/unlock + pageview previo. */
async function findShareUnlockCandidates(): Promise<BackfillCandidate[]> {
  const rows = await prisma.$queryRaw<RawCandidate[]>`
    WITH visitor_links AS (
      SELECT DISTINCT diagnostic_id, visitor_id
      FROM (
        SELECT diagnostic_id, visitor_id
        FROM share_events
        WHERE diagnostic_id IS NOT NULL AND visitor_id IS NOT NULL AND TRIM(visitor_id) != ''
        UNION
        SELECT diagnostic_id, visitor_id
        FROM unlock_click_events
        WHERE diagnostic_id IS NOT NULL AND visitor_id IS NOT NULL AND TRIM(visitor_id) != ''
      ) links
    )
    SELECT DISTINCT ON (d.id)
      d.id AS diagnostic_id,
      LOWER(TRIM(pv.ref_code)) AS ref_code,
      NULLIF(LOWER(TRIM(pv.utm_source)), '') AS utm_source,
      NULLIF(LOWER(TRIM(pv.utm_medium)), '') AS utm_medium,
      NULLIF(LOWER(TRIM(pv.utm_campaign)), '') AS utm_campaign,
      'share_unlock' AS source
    FROM visitor_links vl
    JOIN public_diagnostics d ON d.id = vl.diagnostic_id
    JOIN page_views pv ON pv.visitor_id = vl.visitor_id
      AND pv.ref_code IS NOT NULL
      AND TRIM(pv.ref_code) != ''
      AND pv.created_at <= d.created_at
      AND pv.created_at >= d.created_at - INTERVAL '7 days'
    WHERE d.ref_code IS NULL OR TRIM(d.ref_code) = ''
    ORDER BY d.id, pv.created_at DESC
  `;

  return rows.map((row) => ({
    diagnosticId: row.diagnostic_id,
    refCode: row.ref_code,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    source: 'share_unlock',
  }));
}

/**
 * Pageview en /diagnostico/crear con ref + un solo diagnóstico null-ref del mismo visitante en 30 min.
 * Heurística conservadora: si hay más de un diagnóstico en la ventana, se omite.
 */
async function findPageviewSessionCandidates(excludeIds: Set<string>): Promise<BackfillCandidate[]> {
  const rows = await prisma.$queryRaw<RawCandidate[]>`
    WITH crear_pageviews AS (
      SELECT
        visitor_id,
        LOWER(TRIM(ref_code)) AS ref_code,
        NULLIF(LOWER(TRIM(utm_source)), '') AS utm_source,
        NULLIF(LOWER(TRIM(utm_medium)), '') AS utm_medium,
        NULLIF(LOWER(TRIM(utm_campaign)), '') AS utm_campaign,
        created_at AS pv_at
      FROM page_views
      WHERE path = '/diagnostico/crear'
        AND visitor_id IS NOT NULL
        AND TRIM(visitor_id) != ''
        AND ref_code IS NOT NULL
        AND TRIM(ref_code) != ''
    ),
    matches AS (
      SELECT
        d.id AS diagnostic_id,
        pv.ref_code,
        pv.utm_source,
        pv.utm_medium,
        pv.utm_campaign,
        pv.pv_at,
        COUNT(*) OVER (PARTITION BY pv.visitor_id, pv.pv_at) AS diag_in_window
      FROM crear_pageviews pv
      JOIN public_diagnostics d ON d.created_at >= pv.pv_at
        AND d.created_at <= pv.pv_at + INTERVAL '30 minutes'
        AND (d.ref_code IS NULL OR TRIM(d.ref_code) = '')
    )
    SELECT DISTINCT ON (diagnostic_id)
      diagnostic_id,
      ref_code,
      utm_source,
      utm_medium,
      utm_campaign,
      'pageview_session' AS source
    FROM matches
    WHERE diag_in_window = 1
    ORDER BY diagnostic_id, pv_at DESC
  `;

  return rows
    .filter((row) => !excludeIds.has(row.diagnostic_id))
    .map((row) => ({
      diagnosticId: row.diagnostic_id,
      refCode: row.ref_code,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      source: 'pageview_session',
    }));
}

export async function listBackfillDiagnosticAttributionCandidates(): Promise<BackfillCandidate[]> {
  const shareUnlock = await findShareUnlockCandidates();
  const exclude = new Set(shareUnlock.map((c) => c.diagnosticId));
  const pageviewSession = await findPageviewSessionCandidates(exclude);
  return [...shareUnlock, ...pageviewSession];
}

export type BackfillResult = {
  candidates: number;
  updated: number;
  bySource: Record<string, number>;
  sample: BackfillCandidate[];
};

export async function runBackfillDiagnosticAttribution(options?: {
  apply?: boolean;
  sampleSize?: number;
}): Promise<BackfillResult> {
  const candidates = await listBackfillDiagnosticAttributionCandidates();
  const bySource: Record<string, number> = {};

  if (!options?.apply) {
    for (const c of candidates) {
      bySource[c.source] = (bySource[c.source] ?? 0) + 1;
    }
    return {
      candidates: candidates.length,
      updated: 0,
      bySource,
      sample: candidates.slice(0, options?.sampleSize ?? 15),
    };
  }

  let updated = 0;
  for (const c of candidates) {
    const result = await prisma.publicDiagnostic.updateMany({
      where: {
        id: c.diagnosticId,
        OR: [{ refCode: null }, { refCode: '' }],
      },
      data: {
        refCode: c.refCode,
        ...(c.utmSource ? { utmSource: c.utmSource } : {}),
        ...(c.utmMedium ? { utmMedium: c.utmMedium } : {}),
        ...(c.utmCampaign ? { utmCampaign: c.utmCampaign } : {}),
      },
    });
    if (result.count > 0) {
      updated += result.count;
      bySource[c.source] = (bySource[c.source] ?? 0) + 1;
    }
  }

  return {
    candidates: candidates.length,
    updated,
    bySource,
    sample: candidates.slice(0, options?.sampleSize ?? 15),
  };
}
