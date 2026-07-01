import { prisma } from './prisma';

/** Slug interno para filas sin ref_code en reportes de auspiciadores. */
export const SIN_REFERIDOR_SLUG = '__sin_referidor__';

export const SIN_REFERIDOR_LABEL = 'Sin referidor (orgánico / sin ref)';

const WA_PLACEHOLDER_SUFFIX = '@whatsapp.cleexs.net';

export function isPlaceholderDiagnosticEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith(WA_PLACEHOLDER_SUFFIX));
}

export function normalizeReferralRefCode(refCode: string | null | undefined): string {
  const raw = (refCode || '').trim().toLowerCase();
  return raw || SIN_REFERIDOR_SLUG;
}

export type ReferralDiagnosticAggRow = {
  ref_code: string | null;
  diagnostics: number;
  with_email: number;
  unique_emails: number;
  completed: number;
  latest_at: Date | null;
};

export async function aggregateDiagnosticsByRefCode(options?: {
  from?: Date;
  to?: Date;
}): Promise<ReferralDiagnosticAggRow[]> {
  if (!options?.from && !options?.to) {
    return prisma.$queryRaw<ReferralDiagnosticAggRow[]>`
      SELECT
        CASE
          WHEN ref_code IS NULL OR TRIM(ref_code) = '' THEN NULL
          ELSE LOWER(TRIM(ref_code))
        END AS ref_code,
        COUNT(*)::int AS diagnostics,
        COUNT(*) FILTER (
          WHERE email IS NOT NULL AND LOWER(email) NOT LIKE '%@whatsapp.cleexs.net'
        )::int AS with_email,
        COUNT(DISTINCT LOWER(email)) FILTER (
          WHERE email IS NOT NULL AND LOWER(email) NOT LIKE '%@whatsapp.cleexs.net'
        )::int AS unique_emails,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        MAX(created_at) AS latest_at
      FROM public_diagnostics
      GROUP BY 1
    `;
  }

  return prisma.$queryRaw<ReferralDiagnosticAggRow[]>`
    SELECT
      CASE
        WHEN ref_code IS NULL OR TRIM(ref_code) = '' THEN NULL
        ELSE LOWER(TRIM(ref_code))
      END AS ref_code,
      COUNT(*)::int AS diagnostics,
      COUNT(*) FILTER (
        WHERE email IS NOT NULL AND LOWER(email) NOT LIKE '%@whatsapp.cleexs.net'
      )::int AS with_email,
      COUNT(DISTINCT LOWER(email)) FILTER (
        WHERE email IS NOT NULL AND LOWER(email) NOT LIKE '%@whatsapp.cleexs.net'
      )::int AS unique_emails,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      MAX(created_at) AS latest_at
    FROM public_diagnostics
    WHERE created_at >= ${options.from!} AND created_at <= ${options.to!}
    GROUP BY 1
  `;
}

export async function countGlobalUniqueDiagnosticEmails(options?: {
  from?: Date;
  to?: Date;
}): Promise<number> {
  if (!options?.from && !options?.to) {
    const rows = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(DISTINCT LOWER(email))::int AS n
      FROM public_diagnostics
      WHERE email IS NOT NULL AND LOWER(email) NOT LIKE '%@whatsapp.cleexs.net'
    `;
    return rows[0]?.n ?? 0;
  }

  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(DISTINCT LOWER(email))::int AS n
    FROM public_diagnostics
    WHERE email IS NOT NULL
      AND LOWER(email) NOT LIKE '%@whatsapp.cleexs.net'
      AND created_at >= ${options.from!}
      AND created_at <= ${options.to!}
  `;
  return rows[0]?.n ?? 0;
}

export type DiagnosticAttributionInput = {
  refCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  visitorId?: string;
};

/** Si el POST no trae ref, recupera el último pageview del visitante (7 días). */
export async function resolveDiagnosticAttributionFallback(
  input: DiagnosticAttributionInput
): Promise<DiagnosticAttributionInput> {
  const refCode = input.refCode?.trim().toLowerCase();
  if (refCode) return { ...input, refCode };

  const visitorId = input.visitorId?.trim();
  if (!visitorId) return input;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const pageview = await prisma.pageView.findFirst({
    where: {
      visitorId,
      createdAt: { gte: since },
      refCode: { not: null },
      NOT: { refCode: '' },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      refCode: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
    },
  });

  if (!pageview?.refCode?.trim()) return input;

  return {
    refCode: pageview.refCode.trim().toLowerCase(),
    utmSource: input.utmSource?.trim().toLowerCase() || pageview.utmSource?.trim().toLowerCase() || undefined,
    utmMedium: input.utmMedium?.trim().toLowerCase() || pageview.utmMedium?.trim().toLowerCase() || undefined,
    utmCampaign:
      input.utmCampaign?.trim().toLowerCase() || pageview.utmCampaign?.trim().toLowerCase() || undefined,
    visitorId,
  };
}
