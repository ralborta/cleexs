import type { Prisma } from '@prisma/client';

/** Landings conocidas en Métricas de Conversión (extensible). */
export type ConversionLandingKey = 'all' | 'home' | 'meta-v1';

/** Sello Cleexs de la landing /meta (CTA sin UTM de ads). */
export const META_LANDING_CAMPAIGN = 'meta-v1';

/**
 * Campañas de Meta Ads ya vistas en producción (además de meta-v1).
 * El Ads Manager manda su propio utm_campaign; el filtro Meta debe contarlas.
 */
export const META_AD_CAMPAIGNS = ['meta-v1', 'cleexs_ventas_ar', 'cleexs_2026'] as const;

export const META_AD_SOURCES = ['facebook', 'meta', 'fb', 'ig', 'instagram'] as const;

export const META_AD_MEDIUMS = ['ads', 'paid', 'cpc', 'ppc', 'paidsocial', 'paid_social'] as const;

/** @deprecated usar META_AD_CAMPAIGNS — alias para no romper imports viejos */
export const KNOWN_LANDING_CAMPAIGNS = META_AD_CAMPAIGNS;

/**
 * Corte de métricas Meta: el filtro "Meta" solo cuenta eventos desde este instante.
 * Home y Todas no se afectan. No borra filas en DB.
 */
export const META_V1_METRICS_SINCE = new Date('2026-08-26T16:20:00.000-03:00');

export const CONVERSION_LANDING_OPTIONS = [
  {
    key: 'all' as const,
    label: 'Todas',
    sub: 'Home + landings',
    paths: null as string[] | null,
    campaign: null as string | null,
  },
  {
    key: 'home' as const,
    label: 'Home',
    sub: 'cleexs.net/',
    paths: ['/', '/home', '/inicio'],
    campaign: null as string | null,
  },
  {
    key: 'meta-v1' as const,
    label: 'Meta',
    sub: '/meta · meta-v1',
    paths: ['/meta'],
    campaign: 'meta-v1',
  },
] as const;

export function parseConversionLanding(raw: unknown): ConversionLandingKey {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === 'home' || v === 'meta-v1') return v;
  return 'all';
}

export function landingMeta(landing: ConversionLandingKey) {
  return CONVERSION_LANDING_OPTIONS.find((o) => o.key === landing) ?? CONVERSION_LANDING_OPTIONS[0];
}

/**
 * Ajusta el rango efectivo por landing.
 * Meta: ignora todo lo anterior a META_V1_METRICS_SINCE → queda en 0 hasta tráfico nuevo.
 */
export function effectiveRangeForLanding(
  landing: ConversionLandingKey,
  from: Date,
  to: Date
): { from: Date; to: Date; empty: boolean } {
  if (landing !== 'meta-v1') return { from, to, empty: false };
  const since = META_V1_METRICS_SINCE;
  const effFrom = from.getTime() > since.getTime() ? from : since;
  if (effFrom.getTime() > to.getTime()) return { from: effFrom, to, empty: true };
  return { from: effFrom, to, empty: false };
}

export function normalizeUtmCampaign(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** ¿Este UTM pertenece al embudo Meta (landing /meta o ads Meta/IG)? */
export function isMetaFunnelAttribution(input: {
  utmCampaign?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
}): boolean {
  const c = normalizeUtmCampaign(input.utmCampaign);
  const s = normalizeUtmCampaign(input.utmSource);
  const m = normalizeUtmCampaign(input.utmMedium);
  if ((META_AD_CAMPAIGNS as readonly string[]).includes(c)) return true;
  if (
    (META_AD_SOURCES as readonly string[]).includes(s) &&
    (META_AD_MEDIUMS as readonly string[]).includes(m)
  ) {
    return true;
  }
  return false;
}

/** Filtro Prisma Meta: campaña conocida O source+medium de ads Meta/IG. */
export function metaDiagnosticWhere(): Prisma.PublicDiagnosticWhereInput {
  return {
    OR: [
      { utmCampaign: { in: [...META_AD_CAMPAIGNS] } },
      {
        AND: [
          { utmSource: { in: [...META_AD_SOURCES] } },
          { utmMedium: { in: [...META_AD_MEDIUMS] } },
        ],
      },
    ],
  };
}

/** Filtro Prisma sobre PublicDiagnostic. Vacío = sin filtro (comportamiento histórico). */
export function diagnosticWhereForLanding(
  landing: ConversionLandingKey
): Prisma.PublicDiagnosticWhereInput {
  if (landing === 'all') return {};
  if (landing === 'meta-v1') return metaDiagnosticWhere();
  // Home: todo lo que no sea atribución Meta/ads.
  return { NOT: metaDiagnosticWhere() };
}

export function pathsForLanding(landing: ConversionLandingKey): readonly string[] | null {
  return landingMeta(landing).paths;
}

/** Paths de marketing conocidas (home + landings de ads). Usado por filtro "Todas". */
export function allMarketingPaths(): string[] {
  const paths = new Set<string>();
  for (const opt of CONVERSION_LANDING_OPTIONS) {
    if (!opt.paths) continue;
    for (const p of opt.paths) paths.add(p);
  }
  return [...paths];
}

/** ¿La compra pertenece a la landing seleccionada? */
export function paymentMatchesLanding(
  landing: ConversionLandingKey,
  utmCampaign: string | null | undefined,
  utmSource?: string | null,
  utmMedium?: string | null
): boolean {
  if (landing === 'all') return true;
  const meta = isMetaFunnelAttribution({ utmCampaign, utmSource, utmMedium });
  if (landing === 'meta-v1') return meta;
  return !meta;
}

export function extractPaymentUtmCampaign(input: {
  subscriptionCampaign?: string | null;
  rawPayload?: unknown;
}): string {
  const fromSub = normalizeUtmCampaign(input.subscriptionCampaign);
  if (fromSub) return fromSub;
  const raw =
    input.rawPayload && typeof input.rawPayload === 'object'
      ? (input.rawPayload as Record<string, unknown>)
      : {};
  return (
    normalizeUtmCampaign(raw.utmCampaign) ||
    normalizeUtmCampaign(raw.utm_campaign) ||
    ''
  );
}

export function extractPaymentUtmSource(input: {
  subscriptionSource?: string | null;
  rawPayload?: unknown;
}): string {
  const fromSub = normalizeUtmCampaign(input.subscriptionSource);
  if (fromSub) return fromSub;
  const raw =
    input.rawPayload && typeof input.rawPayload === 'object'
      ? (input.rawPayload as Record<string, unknown>)
      : {};
  return (
    normalizeUtmCampaign(raw.utmSource) ||
    normalizeUtmCampaign(raw.utm_source) ||
    ''
  );
}

export function extractPaymentUtmMedium(input: {
  subscriptionMedium?: string | null;
  rawPayload?: unknown;
}): string {
  const fromSub = normalizeUtmCampaign(input.subscriptionMedium);
  if (fromSub) return fromSub;
  const raw =
    input.rawPayload && typeof input.rawPayload === 'object'
      ? (input.rawPayload as Record<string, unknown>)
      : {};
  return (
    normalizeUtmCampaign(raw.utmMedium) ||
    normalizeUtmCampaign(raw.utm_medium) ||
    ''
  );
}
