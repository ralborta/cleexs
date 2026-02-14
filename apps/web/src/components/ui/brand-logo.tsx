'use client';

import { useState } from 'react';

interface BrandLogoProps {
  name: string;
  domain?: string | null;
  size?: number;
  className?: string;
}

/** Intenta mostrar logo via Clearbit; fallback a inicial estilizada */
export function BrandLogo({ name, domain, size = 32, className = '' }: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  let cleanDomain = domain?.trim();
  if (cleanDomain) {
    try {
      if (cleanDomain.startsWith('http')) {
        cleanDomain = new URL(cleanDomain).hostname;
      }
      // Quitar www. para mejor resultado en Clearbit
      if (cleanDomain.startsWith('www.')) {
        cleanDomain = cleanDomain.slice(4);
      }
    } catch {
      cleanDomain = undefined;
    }
  }
  const clearbitUrl = cleanDomain
    ? `https://logo.clearbit.com/${encodeURIComponent(cleanDomain)}`
    : null;

  const initial = name.charAt(0).toUpperCase();

  if (clearbitUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Clearbit logos son URLs externas dinámicas
      <img
        src={clearbitUrl}
        alt={name}
        width={size}
        height={size}
        className={`rounded-lg object-contain bg-white shrink-0 ${className}`}
        onError={() => setImgError(true)}
        style={{ minWidth: size, minHeight: size }}
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
