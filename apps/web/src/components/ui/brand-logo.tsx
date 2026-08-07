'use client';

import { useState } from 'react';
import {
  getCuratedBrandLogoUrl,
  normalizeBrandDomain,
} from '@/lib/brand-logo-overrides';

export type BrandLogoVariant = 'logo' | 'icon';

interface BrandLogoProps {
  name: string;
  domain?: string | null;
  size?: number;
  className?: string;
  /**
   * `logo` = wordmark horizontal (landings). `icon` = mark cuadrado (listas/avatars).
   * Default `icon` para no romper dashboards existentes.
   */
  variant?: BrandLogoVariant;
  /**
   * Si true y no hay URL usable, no renderiza nada (evita iniciales/favicons basura en landings).
   */
  hideIfMissing?: boolean;
}

function brandfetchUrl(
  domain: string,
  variant: BrandLogoVariant,
  size: number,
  clientId: string
): string {
  const type = variant === 'logo' ? 'logo' : 'icon';
  // Wordmark: ancho mayor; icon: cuadrado.
  const w = variant === 'logo' ? Math.max(size * 3, 180) : size * 2;
  const h = size * 2;
  const fallback = variant === 'logo' ? 'transparent' : 'lettermark';
  return `https://cdn.brandfetch.io/domain/${encodeURIComponent(domain)}/w/${w}/h/${h}/type/${type}/fallback/${fallback}?c=${encodeURIComponent(clientId)}`;
}

function logoDevUrl(domain: string | null, name: string, size: number, token: string): string | null {
  if (domain) {
    return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${token}&size=${size}`;
  }
  if (name.trim()) {
    return `https://img.logo.dev/name/${encodeURIComponent(name.trim())}?token=${token}&size=${size}`;
  }
  return null;
}

/**
 * Logos de marca.
 * Orden: override curado → Brandfetch (`type=logo|icon`) → Logo.dev → (solo icon) favicon → inicial.
 */
export function BrandLogo({
  name,
  domain,
  size = 32,
  className = '',
  variant = 'icon',
  hideIfMissing = false,
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  const brandfetchClientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID?.trim() || '';
  const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim() || '';
  const cleanDomain = normalizeBrandDomain(domain);
  const curatedUrl = getCuratedBrandLogoUrl(cleanDomain);

  let logoUrl: string | null = curatedUrl;
  let source: 'curated' | 'brandfetch' | 'logo.dev' | 'favicon' | null = curatedUrl ? 'curated' : null;

  if (!logoUrl && brandfetchClientId && cleanDomain) {
    logoUrl = brandfetchUrl(cleanDomain, variant, size, brandfetchClientId);
    source = 'brandfetch';
  }

  if (!logoUrl && logoDevToken) {
    logoUrl = logoDevUrl(cleanDomain, name, size, logoDevToken);
    if (logoUrl) source = 'logo.dev';
  }

  // Favicon solo para iconos chicos; en wordmark ensucia (Mario, app icons).
  if (!logoUrl && variant === 'icon' && cleanDomain) {
    logoUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${Math.min(size, 256)}`;
    source = 'favicon';
  }

  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const isWide = variant === 'logo' || source === 'curated';

  if (logoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- CDN externos / assets curados
      <img
        src={logoUrl}
        alt={name}
        width={isWide ? undefined : size}
        height={size}
        className={`rounded-lg object-contain bg-white shrink-0 ${className}`}
        onError={() => setImgError(true)}
        style={{
          minHeight: size,
          maxHeight: size,
          width: isWide ? 'auto' : size,
          minWidth: isWide ? Math.round(size * (variant === 'logo' ? 2.2 : 1.4)) : size,
        }}
        loading="lazy"
      />
    );
  }

  if (hideIfMissing) return null;

  return (
    <div
      className={`rounded-lg flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-700 text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.45) }}
    >
      {initial}
    </div>
  );
}
