'use client';

import { useEffect, useState } from 'react';
import { brandAssetsApi } from '@/lib/api';
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
  /**
   * Usa el resolver de API (cache + Brandfetch/Logo.dev). Default true si hay dominio.
   */
  resolveViaApi?: boolean;
}

function brandfetchUrl(
  domain: string,
  variant: BrandLogoVariant,
  size: number,
  clientId: string
): string {
  const type = variant === 'logo' ? 'logo' : 'icon';
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

function clientFallbackUrl(
  name: string,
  domain: string | null,
  variant: BrandLogoVariant,
  size: number
): string | null {
  const curated = getCuratedBrandLogoUrl(domain);
  if (curated) return curated;

  const brandfetchClientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID?.trim() || '';
  const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim() || '';

  if (brandfetchClientId && domain) {
    return brandfetchUrl(domain, variant, size, brandfetchClientId);
  }
  if (logoDevToken) {
    return logoDevUrl(domain, name, size, logoDevToken);
  }
  if (variant === 'icon' && domain) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${Math.min(size, 256)}`;
  }
  return null;
}

/**
 * Logos de marca.
 * Capa 1: API resolve (cache DB → Brandfetch/Logo.dev) + fallback cliente.
 * En landings usar hideIfMissing para no mostrar basura.
 */
export function BrandLogo({
  name,
  domain,
  size = 32,
  className = '',
  variant = 'icon',
  hideIfMissing = false,
  resolveViaApi,
}: BrandLogoProps) {
  const cleanDomain = normalizeBrandDomain(domain);
  const shouldResolve = resolveViaApi ?? Boolean(cleanDomain);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() =>
    shouldResolve ? null : clientFallbackUrl(name, cleanDomain, variant, size)
  );
  const [resolved, setResolved] = useState(!shouldResolve);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!shouldResolve || !cleanDomain) {
      setResolvedUrl(clientFallbackUrl(name, cleanDomain, variant, size));
      setResolved(true);
      return;
    }

    let cancelled = false;
    setImgError(false);
    setResolved(false);

    brandAssetsApi
      .resolve({ domain: cleanDomain, brandName: name })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ok' && res.logoUrl) {
          setResolvedUrl(res.logoUrl);
        } else {
          // missing en API: no favicon basura en landings
          setResolvedUrl(hideIfMissing ? null : clientFallbackUrl(name, cleanDomain, variant, size));
        }
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedUrl(clientFallbackUrl(name, cleanDomain, variant, size));
        setResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanDomain, name, variant, size, shouldResolve, hideIfMissing]);

  const logoUrl = resolvedUrl;
  const isWide = variant === 'logo' || Boolean(logoUrl?.includes('/brand-logos/'));

  if (!resolved) {
    if (hideIfMissing) return null;
    return (
      <div
        className={`rounded-lg bg-slate-100 shrink-0 animate-pulse ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

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

  const initial = name?.charAt(0)?.toUpperCase() || '?';
  return (
    <div
      className={`rounded-lg flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-700 text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.45) }}
    >
      {initial}
    </div>
  );
}
