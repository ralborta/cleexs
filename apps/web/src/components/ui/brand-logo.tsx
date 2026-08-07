'use client';

import { useState } from 'react';
import {
  getCuratedBrandLogoUrl,
  normalizeBrandDomain,
} from '@/lib/brand-logo-overrides';

interface BrandLogoProps {
  name: string;
  domain?: string | null;
  size?: number;
  className?: string;
  /**
   * Solo muestra logo si hay override curado.
   * Evita favicons basura (Mario, app icons) en landings de venta.
   * Si no hay curado, no renderiza nada.
   */
  curatedOnly?: boolean;
}

/** Logos: curado → Logo.dev → Google Favicon → inicial (o null si curatedOnly). */
export function BrandLogo({
  name,
  domain,
  size = 32,
  className = '',
  curatedOnly = false,
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const cleanDomain = normalizeBrandDomain(domain);
  const curatedUrl = getCuratedBrandLogoUrl(cleanDomain);

  if (curatedOnly && !curatedUrl) {
    return null;
  }

  let logoUrl: string | null = curatedUrl;
  if (!logoUrl && logoDevToken) {
    if (cleanDomain) {
      logoUrl = `https://img.logo.dev/${encodeURIComponent(cleanDomain)}?token=${logoDevToken}&size=${size}`;
    } else if (name?.trim()) {
      logoUrl = `https://img.logo.dev/name/${encodeURIComponent(name.trim())}?token=${logoDevToken}&size=${size}`;
    }
  } else if (!logoUrl && cleanDomain) {
    logoUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${Math.min(size, 256)}`;
  }

  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const isCurated = Boolean(curatedUrl && logoUrl === curatedUrl);

  if (logoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URLs dinámicas externas o assets curados
      <img
        src={logoUrl}
        alt={name}
        width={isCurated ? undefined : size}
        height={size}
        className={`rounded-lg object-contain bg-white shrink-0 ${className}`}
        onError={() => setImgError(true)}
        style={{
          minHeight: size,
          maxHeight: size,
          width: isCurated ? 'auto' : size,
          minWidth: isCurated ? Math.round(size * 1.4) : size,
        }}
        loading="lazy"
      />
    );
  }

  if (curatedOnly) return null;

  return (
    <div
      className={`rounded-lg flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-700 text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.45) }}
    >
      {initial}
    </div>
  );
}
