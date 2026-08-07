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

function logoDevUrl(domain: string, size: number, token: string): string {
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=${size}&format=png`;
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

/**
 * Logos de marca — capa 1.
 * Orden: API (cache/Brandfetch) → onError Logo.dev → curated → (icon) nada/inicial.
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
  const [triedLogoDev, setTriedLogoDev] = useState(false);
  const [resolved, setResolved] = useState(!shouldResolve || Boolean(curated));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
    setTriedLogoDev(false);

    if (curated) {
      setLogoUrl(curated);
      setResolved(true);
      return;
    }

    if (!shouldResolve || !cleanDomain) {
      setLogoUrl(
        clientBrandfetchUrl(cleanDomain, variant, size) ||
          clientLogoDevUrl(cleanDomain, size)
      );
      setResolved(true);
      return;
    }

    let cancelled = false;
    setResolved(false);

    brandAssetsApi
      .resolve({ domain: cleanDomain, brandName: name })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ok' && res.logoUrl) {
          setLogoUrl(res.logoUrl);
        } else {
          setLogoUrl(
            clientBrandfetchUrl(cleanDomain, variant, size) ||
              clientLogoDevUrl(cleanDomain, size)
          );
        }
        setResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLogoUrl(
          clientBrandfetchUrl(cleanDomain, variant, size) ||
            clientLogoDevUrl(cleanDomain, size)
        );
        setResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanDomain, name, variant, size, shouldResolve, curated]);

  const handleError = () => {
    // Si falló Brandfetch (u otra URL), probar Logo.dev una vez
    if (!triedLogoDev && cleanDomain) {
      const ld = clientLogoDevUrl(cleanDomain, Math.max(size, 128));
      if (ld && ld !== logoUrl) {
        setTriedLogoDev(true);
        setImgError(false);
        setLogoUrl(ld);
        return;
      }
    }
    setImgError(true);
  };

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
        onError={handleError}
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
