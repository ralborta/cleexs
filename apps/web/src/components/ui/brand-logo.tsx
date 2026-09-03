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
   * Usa el resolver de API (cache + Logo.dev/Brandfetch). Default true si hay dominio.
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

function logoDevUrl(domain: string, size: number, token: string): string {
  // fallback=404: sin monograma inventado; onError puede ocultar / probar otra fuente
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=${size}&format=png&fallback=404`;
}

function clientLogoDevUrl(domain: string | null, size: number): string | null {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN?.trim() || '';
  if (!token || !domain) return null;
  return logoDevUrl(domain, size, token);
}

function clientBrandfetchUrl(
  domain: string | null,
  variant: BrandLogoVariant,
  size: number
): string | null {
  const clientId = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID?.trim() || '';
  if (!clientId || !domain) return null;
  return brandfetchUrl(domain, variant, size, clientId);
}

function isBrandfetchUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes('brandfetch.io'));
}

/**
 * Logos de marca — capa 1.
 * Orden: curated → API (Logo.dev preferido) → Logo.dev cliente → Brandfetch → hide/inicial.
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
  const curated = getCuratedBrandLogoUrl(cleanDomain);

  const [logoUrl, setLogoUrl] = useState<string | null>(curated);
  const [fallbackStage, setFallbackStage] = useState(0);
  const [resolved, setResolved] = useState(!shouldResolve || Boolean(curated));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
    setFallbackStage(0);

    if (curated) {
      setLogoUrl(curated);
      setResolved(true);
      return;
    }

    const localPreferred =
      clientLogoDevUrl(cleanDomain, Math.max(size, 128)) ||
      clientBrandfetchUrl(cleanDomain, variant, size);

    if (!shouldResolve || !cleanDomain) {
      setLogoUrl(localPreferred);
      setResolved(true);
      return;
    }

    let cancelled = false;
    setResolved(false);

    brandAssetsApi
      .resolve({ domain: cleanDomain, brandName: name })
      .then((res) => {
        if (cancelled) return;
        // Si la API aún devuelve Brandfetch roto, preferir Logo.dev local
        if (res.status === 'ok' && res.logoUrl && !isBrandfetchUrl(res.logoUrl)) {
          setLogoUrl(res.logoUrl);
        } else {
          setLogoUrl(localPreferred || res.logoUrl || null);
        }
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLogoUrl(localPreferred);
        setResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanDomain, name, variant, size, shouldResolve, curated]);

  const handleError = () => {
    if (!cleanDomain) {
      setImgError(true);
      return;
    }

    // 1) Logo.dev
    if (fallbackStage < 1) {
      const ld = clientLogoDevUrl(cleanDomain, Math.max(size, 128));
      if (ld && ld !== logoUrl) {
        setFallbackStage(1);
        setImgError(false);
        setLogoUrl(ld);
        return;
      }
      setFallbackStage(1);
    }

    // 2) Brandfetch (wordmark) — necesita Referer allowlisted
    if (fallbackStage < 2) {
      const bf = clientBrandfetchUrl(cleanDomain, variant, size);
      if (bf && bf !== logoUrl) {
        setFallbackStage(2);
        setImgError(false);
        setLogoUrl(bf);
        return;
      }
    }

    setImgError(true);
  };

  const isWide = variant === 'logo' || Boolean(logoUrl?.includes('/brand-logos/'));
  const needsReferrer = isBrandfetchUrl(logoUrl);

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
        onError={handleError}
        referrerPolicy={needsReferrer ? 'origin' : undefined}
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
