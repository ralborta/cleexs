import { prisma } from './prisma';
import { getAppBaseUrlForPublicLinks } from './app-public-url';

const CACHE_TTL_OK_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MISSING_MS = 7 * 24 * 60 * 60 * 1000;

const CURATED: Record<string, string> = {
  'nintendo.com': '/brand-logos/nintendo.png',
};

export type BrandAssetSource = 'curated' | 'brandfetch' | 'logo.dev' | 'none';
export type BrandAssetStatus = 'ok' | 'missing';

export type BrandAssetResult = {
  domain: string;
  brandName: string | null;
  logoUrl: string | null;
  source: BrandAssetSource;
  status: BrandAssetStatus;
  confidence: number | null;
  cached: boolean;
};

function typoFixDomain(d: string): string {
  const typoFix: Record<string, string> = {
    '.oi': '.io',
    '.con': '.com',
    '.comm': '.com',
  };
  for (const [bad, good] of Object.entries(typoFix)) {
    if (d.endsWith(bad)) return `${d.slice(0, -bad.length)}${good}`;
  }
  return d;
}

export function normalizeBrandAssetDomain(input: string | null | undefined): string | null {
  let d = input?.trim();
  if (!d) return null;
  try {
    if (d.startsWith('http')) d = new URL(d).hostname;
    if (d.startsWith('www.')) d = d.slice(4);
    d = d.toLowerCase();
  } catch {
    d = d.replace(/^www\./i, '').toLowerCase();
  }
  if (!d || d.length < 3 || d.startsWith('brand-')) return null;
  return typoFixDomain(d);
}

function brandfetchClientId(): string {
  return (
    process.env.BRANDFETCH_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID?.trim() ||
    ''
  );
}

function logoDevToken(): string {
  return (
    process.env.LOGO_DEV_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim() ||
    ''
  );
}

function absoluteCuratedUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = getAppBaseUrlForPublicLinks().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function brandfetchLogoUrl(domain: string): string {
  const c = brandfetchClientId();
  return `https://cdn.brandfetch.io/domain/${encodeURIComponent(domain)}/w/400/h/120/type/logo/fallback/transparent?c=${encodeURIComponent(c)}`;
}

function logoDevLogoUrl(domain: string): string {
  const token = logoDevToken();
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=256&format=png`;
}

async function probeLogoDev(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(6_000),
      headers: { Accept: 'image/*' },
    });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    return ct.startsWith('image/');
  } catch {
    return false;
  }
}

function isFresh(checkedAt: Date, status: string): boolean {
  const age = Date.now() - checkedAt.getTime();
  return status === 'ok' ? age < CACHE_TTL_OK_MS : age < CACHE_TTL_MISSING_MS;
}

async function persist(result: Omit<BrandAssetResult, 'cached'>): Promise<BrandAssetResult> {
  const row = await prisma.brandAsset.upsert({
    where: { domain: result.domain },
    create: {
      domain: result.domain,
      brandName: result.brandName,
      logoUrl: result.logoUrl,
      source: result.source,
      status: result.status,
      confidence: result.confidence,
      checkedAt: new Date(),
    },
    update: {
      brandName: result.brandName,
      logoUrl: result.logoUrl,
      source: result.source,
      status: result.status,
      confidence: result.confidence,
      checkedAt: new Date(),
    },
  });
  return {
    domain: row.domain,
    brandName: row.brandName,
    logoUrl: row.logoUrl,
    source: (row.source as BrandAssetSource) || 'none',
    status: (row.status as BrandAssetStatus) || 'missing',
    confidence: row.confidence,
    cached: false,
  };
}

/**
 * Resuelve logo de marca (capa 1):
 * cache → curated → Brandfetch CDN → Logo.dev (probe) → missing.
 * No scrapea el sitio (capa 2).
 */
export async function resolveBrandAsset(input: {
  domain: string;
  brandName?: string | null;
  refresh?: boolean;
}): Promise<BrandAssetResult | null> {
  const domain = normalizeBrandAssetDomain(input.domain);
  if (!domain) return null;
  const brandName = input.brandName?.trim() || null;

  if (!input.refresh) {
    const cached = await prisma.brandAsset.findUnique({ where: { domain } });
    if (cached && isFresh(cached.checkedAt, cached.status)) {
      return {
        domain: cached.domain,
        brandName: cached.brandName,
        logoUrl: cached.logoUrl,
        source: (cached.source as BrandAssetSource) || 'none',
        status: (cached.status as BrandAssetStatus) || 'missing',
        confidence: cached.confidence,
        cached: true,
      };
    }
  }

  const curatedPath = CURATED[domain];
  if (curatedPath) {
    return persist({
      domain,
      brandName,
      logoUrl: absoluteCuratedUrl(curatedPath),
      source: 'curated',
      status: 'ok',
      confidence: 100,
    });
  }

  if (brandfetchClientId()) {
    return persist({
      domain,
      brandName,
      logoUrl: brandfetchLogoUrl(domain),
      source: 'brandfetch',
      status: 'ok',
      confidence: 85,
    });
  }

  if (logoDevToken()) {
    const url = logoDevLogoUrl(domain);
    const ok = await probeLogoDev(url);
    if (ok) {
      return persist({
        domain,
        brandName,
        logoUrl: url,
        source: 'logo.dev',
        status: 'ok',
        confidence: 70,
      });
    }
  }

  return persist({
    domain,
    brandName,
    logoUrl: null,
    source: 'none',
    status: 'missing',
    confidence: 0,
  });
}
