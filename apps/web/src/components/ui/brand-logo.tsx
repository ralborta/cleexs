'use client';

import { useState } from 'react';

interface BrandLogoProps {
  name: string;
  domain?: string | null;
  size?: number;
  className?: string;
}

function normalizeDomain(input: string | undefined | null): string | null {
  let d = input?.trim();
  if (!d) return null;
  try {
    if (d.startsWith('http')) d = new URL(d).hostname;
    if (d.startsWith('www.')) d = d.slice(4);
    return d || null;
  } catch {
    return null;
  }
}

/** Logos: Logo.dev (si hay token), Google Favicon (fallback), o inicial */
export function BrandLogo({ name, domain, size = 32, className = '' }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const cleanDomain = normalizeDomain(domain);

  // 1. Logo.dev: dominio o búsqueda por nombre (5k gratis/día en logo.dev)
  let logoUrl: string | null = null;
  if (logoDevToken) {
    if (cleanDomain) {
      logoUrl = `https://img.logo.dev/${encodeURIComponent(cleanDomain)}?token=${logoDevToken}&size=${size}`;
    } else if (name?.trim()) {
      logoUrl = `https://img.logo.dev/name/${encodeURIComponent(name.trim())}?token=${logoDevToken}&size=${size}`;
    }
  }
  // 2. Google Favicon: solo cuando tenemos dominio (gratis, sin API key)
  else if (cleanDomain) {
    logoUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=${Math.min(size, 256)}`;
  }

  const initial = name?.charAt(0)?.toUpperCase() || '?';

  if (logoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URLs dinámicas externas (Logo.dev, Google)
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className={`rounded-lg object-contain bg-white shrink-0 ${className}`}
        onError={() => setImgError(true)}
        style={{ minWidth: size, minHeight: size }}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`rounded-lg flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-700 text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.45) }}
    >
      {initial}
    </div>
  );
}
