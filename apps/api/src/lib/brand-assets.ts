import { prisma } from './prisma';
import { getAppBaseUrlForPublicLinks } from './app-public-url';

const CACHE_TTL_OK_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MISSING_MS = 7 * 24 * 60 * 60 * 1000;

const CURATED: Record<string, string> = {
  'nintendo.com': '/brand-logos/nintendo.png',
};

export type BrandAssetSource = 'curated' | 'brandfetch' | 'logo.dev' | 'site' | 'none';
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
  // fallback=404 evita monogramas falsos cacheados como "ok"
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=256&format=png&fallback=404`;
}

async function probeImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(6_000),
      headers: { Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
    });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return false;
    // Rechazar respuestas vacías / 1x1 sospechosas
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 200;
  } catch {
    return false;
  }
}

function absolutizeUrl(href: string, base: URL): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function scoreSiteIcon(href: string, rel: string, sizesAttr: string | null): number {
  let score = 10;
  const relL = rel.toLowerCase();
  const hrefL = href.toLowerCase();
  if (relL.includes('apple-touch')) score += 40;
  if (relL === 'icon' || relL.includes('shortcut')) score += 15;
  if (/\.(png|webp|svg)(\?|$)/i.test(hrefL)) score += 20;
  if (/\.ico(\?|$)/i.test(hrefL)) score -= 10;
  if (sizesAttr) {
    const m = sizesAttr.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (m) {
      const n = Math.max(parseInt(m[1], 10), parseInt(m[2], 10));
      if (n >= 128) score += Math.min(n, 512) / 4;
      if (n < 48) score -= 20;
    }
  }
  // Prefer filenames that look like logos
  if (/logo|brand|mark/i.test(hrefL)) score += 25;
  return score;
}

/**
 * Capa 2 ligera: lee <link rel="icon|apple-touch-icon"> del sitio.
 * No usa og:image (suele ser foto hero, no logo).
 */
async function scrapeSiteLogo(domain: string): Promise<string | null> {
  const origins = [`https://${domain}/`, `https://www.${domain}/`];
  const candidates: { url: string; score: number }[] = [];

  for (const origin of origins) {
    try {
      const res = await fetch(origin, {
        method: 'GET',
        signal: AbortSignal.timeout(8_000),
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (compatible; CleexsBrandBot/1.0)',
        },
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (!html || html.length < 200) continue;
      const base = new URL(res.url);

      const linkRe =
        /<link\b[^>]*\brel=["']([^"']*icon[^"']*)["'][^>]*>/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(html)) !== null) {
        const tag = m[0];
        const rel = m[1] || '';
        const hrefM = tag.match(/\bhref=["']([^"']+)["']/i);
        if (!hrefM) continue;
        const abs = absolutizeUrl(hrefM[1], base);
        if (!abs) continue;
        const sizesM = tag.match(/\bsizes=["']([^"']+)["']/i);
        candidates.push({
          url: abs,
          score: scoreSiteIcon(abs, rel, sizesM?.[1] ?? null),
        });
      }

      // Favicon clásico como último candidato de este origen
      const fav = absolutizeUrl('/favicon.ico', base);
      if (fav) candidates.push({ url: fav, score: 5 });

      if (candidates.length) break;
    } catch {
      // siguiente origen
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  for (const c of candidates.slice(0, 6)) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    if (await probeImageUrl(c.url)) return c.url;
  }
  return null;
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
 * Resuelve logo de marca:
 * cache → curated → Logo.dev (probe) → scrape sitio (icons) → Brandfetch → missing.
 *
 * Logo.dev primero (imagen verificable). Si no hay cobertura (marcas locales),
 * capa 2 lee apple-touch-icon / favicon del propio sitio.
 * Brandfetch queda como último intento de URL (hotlink frágil).
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
    // Invalidar cache viejo de Brandfetch: URLs que el browser no puede cargar
    const brandfetchCached =
      cached?.source === 'brandfetch' &&
      typeof cached.logoUrl === 'string' &&
      cached.logoUrl.includes('brandfetch.io');
    if (cached && isFresh(cached.checkedAt, cached.status) && !brandfetchCached) {
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

  // 1) Logo.dev (GET + content-type image) — fuente confiable hoy
  if (logoDevToken()) {
    const url = logoDevLogoUrl(domain);
    const ok = await probeImageUrl(url);
    if (ok) {
      return persist({
        domain,
        brandName,
        logoUrl: url,
        source: 'logo.dev',
        status: 'ok',
        confidence: 80,
      });
    }
  }

  // 2) Capa 2: icons del sitio (útil para marcas locales sin cobertura CDN)
  const siteLogo = await scrapeSiteLogo(domain);
  if (siteLogo) {
    return persist({
      domain,
      brandName,
      logoUrl: siteLogo,
      source: 'site',
      status: 'ok',
      confidence: 70,
    });
  }

  // 3) Brandfetch como URL de intento (wordmark). Hotlink frágil.
  if (brandfetchClientId()) {
    return persist({
      domain,
      brandName,
      logoUrl: brandfetchLogoUrl(domain),
      source: 'brandfetch',
      status: 'ok',
      confidence: 50,
    });
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

/** URL Logo.dev para un dominio (si hay token). Útil como fallback en el cliente. */
export function buildLogoDevUrl(domain: string, size = 256): string | null {
  const token = logoDevToken();
  const d = normalizeBrandAssetDomain(domain);
  if (!token || !d) return null;
  return `https://img.logo.dev/${encodeURIComponent(d)}?token=${encodeURIComponent(token)}&size=${size}&format=png&fallback=404`;
}
