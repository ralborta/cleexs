import { prisma } from './prisma';
import { normalizeDomain } from './classifier';

const AHREFS_DR_FREE_URL = 'https://api.ahrefs.com/v3/public/domain-rating-free';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

export type DomainRatingSnapshot = {
  brand: { name: string; domain: string; rating: number | null };
  competitors: Array<{ name: string; domain: string | null; rating: number | null }>;
  leaderRating: number | null;
  avgCompetitorRating: number | null;
  gapVsLeader: number | null;
  insight: string | null;
};

function isValidTargetDomain(domain: string): boolean {
  const d = normalizeDomain(domain);
  return !!d && d.length >= 4 && !d.startsWith('brand-');
}

function roundRating(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export async function fetchAhrefsDomainRatingFree(target: string): Promise<number | null> {
  const domain = normalizeDomain(target);
  if (!isValidTargetDomain(domain)) return null;

  const url = `${AHREFS_DR_FREE_URL}?target=${encodeURIComponent(domain)}&output=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    domain_rating?: { domain_rating?: number };
  };
  return roundRating(data?.domain_rating?.domain_rating);
}

export async function getCachedDomainRating(domain: string): Promise<number | null> {
  const normalized = normalizeDomain(domain);
  if (!isValidTargetDomain(normalized)) return null;

  const cached = await prisma.domainRatingCache.findUnique({
    where: { domain: normalized },
  });
  const now = Date.now();
  if (cached && now - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return cached.rating == null ? null : roundRating(cached.rating);
  }

  const rating = await fetchAhrefsDomainRatingFree(normalized);
  await prisma.domainRatingCache.upsert({
    where: { domain: normalized },
    create: { domain: normalized, rating },
    update: { rating, fetchedAt: new Date() },
  });
  return rating;
}

export function buildDomainRatingInsight(params: {
  brandRating: number | null;
  leaderRating: number | null;
  avgCompetitorRating: number | null;
  includeCompetitors: boolean;
}): string | null {
  const { brandRating, leaderRating, avgCompetitorRating, includeCompetitors } = params;
  if (brandRating == null) return null;

  if (!includeCompetitors) {
    return `Tu dominio tiene DR ${brandRating}. Mide autoridad SEO por backlinks; no es lo mismo que tu Cleexs Score en IA.`;
  }

  if (leaderRating != null && brandRating < leaderRating - 10) {
    const gap = leaderRating - brandRating;
    return `Tu DR (${brandRating}) está ${gap} puntos por debajo del líder del panel. Parte de la brecha frente a competidores puede venir de autoridad de dominio.`;
  }

  if (avgCompetitorRating != null && brandRating < avgCompetitorRating - 8) {
    const gap = Math.round(avgCompetitorRating - brandRating);
    return `Tu DR (${brandRating}) está por debajo del promedio de competidores (${Math.round(avgCompetitorRating)}). Reforzar autoridad externa puede ayudar a tu visibilidad en IA.`;
  }

  if (leaderRating != null && brandRating >= leaderRating) {
    return `Tu DR (${brandRating}) está a la par o por encima de tus competidores en autoridad de dominio.`;
  }

  return `Tu dominio tiene DR ${brandRating}. Complementa tu Cleexs Score con esta señal de autoridad SEO.`;
}

export async function buildDomainRatingSnapshot(params: {
  brandName: string;
  brandDomain: string;
  competitors: Array<{ name: string; domain: string | null }>;
  includeCompetitors: boolean;
}): Promise<DomainRatingSnapshot | null> {
  const brandDomain = normalizeDomain(params.brandDomain);
  if (!isValidTargetDomain(brandDomain)) return null;

  const brandRating = await getCachedDomainRating(brandDomain);
  const competitors = params.includeCompetitors
    ? await Promise.all(
        params.competitors.map(async (c) => ({
          name: c.name,
          domain: c.domain ? normalizeDomain(c.domain) : null,
          rating: c.domain ? await getCachedDomainRating(c.domain) : null,
        }))
      )
    : [];

  const competitorRatings = competitors
    .map((c) => c.rating)
    .filter((r): r is number => r != null);
  const allRatings = [brandRating, ...competitorRatings].filter((r): r is number => r != null);
  const leaderRating = allRatings.length > 0 ? Math.max(...allRatings) : null;
  const avgCompetitorRating =
    competitorRatings.length > 0
      ? Math.round(competitorRatings.reduce((a, b) => a + b, 0) / competitorRatings.length)
      : null;
  const gapVsLeader =
    brandRating != null && leaderRating != null ? brandRating - leaderRating : null;

  return {
    brand: { name: params.brandName, domain: brandDomain, rating: brandRating },
    competitors,
    leaderRating,
    avgCompetitorRating,
    gapVsLeader,
    insight: buildDomainRatingInsight({
      brandRating,
      leaderRating,
      avgCompetitorRating,
      includeCompetitors: params.includeCompetitors,
    }),
  };
}

export async function enrichRowsWithDomainRating<
  T extends { domain: string | null; domainRating?: number | null },
>(rows: T[]): Promise<T[]> {
  const domains = [...new Set(rows.map((r) => r.domain).filter(Boolean))] as string[];
  const ratings = new Map<string, number | null>();
  await Promise.all(
    domains.map(async (domain) => {
      ratings.set(normalizeDomain(domain), await getCachedDomainRating(domain));
    })
  );
  return rows.map((row) => ({
    ...row,
    domainRating: row.domain ? ratings.get(normalizeDomain(row.domain)) ?? null : null,
  }));
}
