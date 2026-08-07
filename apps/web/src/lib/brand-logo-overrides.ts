/**
 * Logos curados a mano cuando Logo.dev / favicon falla (marcas grandes, demos).
 * Clave = dominio normalizado sin www.
 */
const BRAND_LOGO_OVERRIDES: Record<string, string> = {
  'nintendo.com': '/brand-logos/nintendo.png',
};

export function normalizeBrandDomain(input: string | undefined | null): string | null {
  let raw = input?.trim();
  if (!raw) return null;
  let d: string;
  try {
    if (raw.startsWith('http')) raw = new URL(raw).hostname;
    if (raw.startsWith('www.')) raw = raw.slice(4);
    d = raw.toLowerCase();
  } catch {
    d = raw.replace(/^www\./i, '').toLowerCase();
  }
  if (!d) return null;

  // Typos comunes de TLD que rompen lookups de logo (ej. deeppsy.oi → deeppsy.io)
  const typoFix: Record<string, string> = {
    '.oi': '.io',
    '.con': '.com',
    '.comm': '.com',
  };
  for (const [bad, good] of Object.entries(typoFix)) {
    if (d.endsWith(bad)) {
      d = `${d.slice(0, -bad.length)}${good}`;
      break;
    }
  }
  return d;
}

/** URL local/curada si existe; si no, null. */
export function getCuratedBrandLogoUrl(domain: string | undefined | null): string | null {
  const clean = normalizeBrandDomain(domain);
  if (!clean) return null;
  return BRAND_LOGO_OVERRIDES[clean] ?? null;
}

export function hasCuratedBrandLogo(domain: string | undefined | null): boolean {
  return Boolean(getCuratedBrandLogoUrl(domain));
}
