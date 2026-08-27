import type { Prisma } from '@prisma/client';

/** Landings conocidas en Métricas de Conversión (extensible). */
export type ConversionLandingKey = 'all' | 'home' | 'meta-v1';

export const KNOWN_LANDING_CAMPAIGNS = ['meta-v1'] as const;

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

/** Filtro Prisma sobre PublicDiagnostic. Vacío = sin filtro (comportamiento histórico). */
export function diagnosticWhereForLanding(
  landing: ConversionLandingKey
): Prisma.PublicDiagnosticWhereInput {
  if (landing === 'all') return {};
  if (landing === 'meta-v1') return { utmCampaign: 'meta-v1' };
  // Home: todo lo que no sea una landing paga conocida (incluye null/vacío).
  return {
    OR: [
      { utmCampaign: null },
      { utmCampaign: '' },
      { utmCampaign: { notIn: [...KNOWN_LANDING_CAMPAIGNS] } },
    ],
  };
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

export function normalizeUtmCampaign(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** ¿La compra pertenece a la landing seleccionada? */
export function paymentMatchesLanding(
  landing: ConversionLandingKey,
  utmCampaign: string | null | undefined
): boolean {
  if (landing === 'all') return true;
  const c = normalizeUtmCampaign(utmCampaign);
  if (landing === 'meta-v1') return c === 'meta-v1';
  return !(KNOWN_LANDING_CAMPAIGNS as readonly string[]).includes(c);
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
