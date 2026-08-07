/**
 * Logos curados a mano cuando Logo.dev / favicon falla (marcas grandes, demos).
 * Clave = dominio normalizado sin www.
 */
const BRAND_LOGO_OVERRIDES: Record<string, string> = {
  'nintendo.com': '/brand-logos/nintendo.png',
};

export function normalizeBrandDomain(input: string | undefined | null): string | null {
  let d = input?.trim();
  if (!d) return null;
  try {
    if (d.startsWith('http')) d = new URL(d).hostname;
    if (d.startsWith('www.')) d = d.slice(4);
    return d.toLowerCase() || null;
  } catch {
    return d.replace(/^www\./i, '').toLowerCase() || null;
  }
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
