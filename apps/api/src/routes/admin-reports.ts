import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { executeRunGemini, executeRunPerplexity, executeRunClaude } from '../lib/run-executor';
import { isOpenRouterConfigured } from '../lib/openrouter-runner';
import type { SatelliteModuleResult } from '../lib/satellite-client';
import { buildDomainRatingSnapshot } from '../lib/ahrefs-domain-rating';
import { resolveConversionRange, isPlanConquistarUnlockKey, PLAN_CONQUISTAR_UNLOCK_LINKS, planConquistarUnlockLabel } from '@cleexs/shared';
import {
  aggregateDiagnosticsByRefCode,
  isPlaceholderDiagnosticEmail,
  normalizeReferralRefCode,
  SIN_REFERIDOR_LABEL,
  SIN_REFERIDOR_SLUG,
} from '../lib/referral-attribution';
import {
  buildSponsorChannelBreakdown,
  enrichAndSortReferrerMetrics,
  isSponsorRef,
  loadReferrerCampaignMap,
  resolveReferrerDisplayName,
} from '../lib/referrer-display';
import { enrichContactOnDemand, isCorporateEmail } from '../lib/contact-enrichment';
import { primaryRunWhere } from '../lib/run-type-filters';
import {
  allMarketingPaths,
  diagnosticWhereForLanding,
  effectiveRangeForLanding,
  extractPaymentUtmCampaign,
  extractPaymentUtmMedium,
  extractPaymentUtmSource,
  landingMeta,
  META_V1_METRICS_SINCE,
  parseConversionLanding,
  pathsForLanding,
  paymentMatchesLanding,
  type ConversionLandingKey,
} from '../lib/conversion-landing';

type PlanConquistarEngineKey = 'gemini' | 'perplexity' | 'claude';

function planConquistarGeminiConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  );
}

function planConquistarAvailableEngines(): PlanConquistarEngineKey[] {
  const engines: PlanConquistarEngineKey[] = [];
  if (planConquistarGeminiConfigured()) engines.push('gemini');
  if (isOpenRouterConfigured()) {
    engines.push('perplexity');
    engines.push('claude');
  }
  return engines;
}

function planConquistarReadEngineRuns(
  modelMeta: unknown
): Partial<Record<PlanConquistarEngineKey, string>> {
  if (modelMeta && typeof modelMeta === 'object' && modelMeta !== null && 'engineRuns' in modelMeta) {
    const value = (modelMeta as { engineRuns?: unknown }).engineRuns;
    if (value && typeof value === 'object') {
      return value as Partial<Record<PlanConquistarEngineKey, string>>;
    }
  }
  return {};
}

function planConquistarReadPromptVersionId(modelMeta: unknown): string | undefined {
  if (modelMeta && typeof modelMeta === 'object' && modelMeta !== null && 'promptVersionId' in modelMeta) {
    const value = (modelMeta as { promptVersionId?: unknown }).promptVersionId;
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

function planConquistarExecutorForEngine(engine: PlanConquistarEngineKey) {
  if (engine === 'gemini') return executeRunGemini;
  if (engine === 'perplexity') return executeRunPerplexity;
  return executeRunClaude;
}

function planConquistarExtractSatelliteModule(analysisJson: unknown): SatelliteModuleResult | null {
  if (!analysisJson || typeof analysisJson !== 'object' || Array.isArray(analysisJson)) return null;
  const externalModules = (analysisJson as { externalModules?: unknown }).externalModules;
  if (!externalModules || typeof externalModules !== 'object' || Array.isArray(externalModules)) return null;
  const satellite = (externalModules as { satelliteAeo?: unknown }).satelliteAeo;
  if (!satellite || typeof satellite !== 'object' || Array.isArray(satellite)) return null;
  return satellite as SatelliteModuleResult;
}

const windowDaysSchema = z.object({
  windowDays: z
    .string()
    .optional()
    .transform((value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return 30;
      if (n <= 7) return 7;
      if (n <= 30) return 30;
      return 90;
    }),
});

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function buildDailySeries<T extends { createdAt: Date }>(
  rows: T[],
  fromDate: Date,
  windowDays: number,
  enrich?: (acc: Record<string, number>, row: T, key: string) => void
): Array<{ date: string; count: number; extra?: Record<string, number> }> {
  const series: Array<{ date: string; count: number; extra?: Record<string, number> }> = [];
  for (let i = 0; i < windowDays; i += 1) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + i);
    series.push({ date: dayKey(d), count: 0, extra: enrich ? {} : undefined });
  }
  const lookup = new Map(series.map((row, idx) => [row.date, idx] as const));
  for (const row of rows) {
    const key = dayKey(row.createdAt);
    const idx = lookup.get(key);
    if (idx == null) continue;
    series[idx].count += 1;
    if (enrich && series[idx].extra) enrich(series[idx].extra as Record<string, number>, row, key);
  }
  return series;
}

function envFlag(name: string): boolean {
  return Boolean(process.env[name]?.toString().trim());
}

function envValue(name: string, fallback = ''): string {
  return process.env[name]?.toString().trim() || fallback;
}

function envBool(name: string): boolean {
  return process.env[name]?.toString().trim().toLowerCase() === 'true';
}

const HOW_FOUND_US_LABELS: Record<string, string> = {
  google: 'Búsqueda en Google',
  redes: 'Redes sociales',
  recomendacion: 'Recomendación',
  whatsapp: 'WhatsApp',
  podcast: 'Podcast o video',
  otro: 'Otro',
};

function onboardingProfileFromDraft(json: unknown): {
  country: string | null;
  firstName: string | null;
  lastName: string | null;
  howFoundUs: string | null;
  hasCountry: boolean;
  hasName: boolean;
  hasHowFound: boolean;
  hasAny: boolean;
} {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return {
      country: null,
      firstName: null,
      lastName: null,
      howFoundUs: null,
      hasCountry: false,
      hasName: false,
      hasHowFound: false,
      hasAny: false,
    };
  }
  const o = json as Record<string, unknown>;
  const country = typeof o.confirmedCountry === 'string' ? o.confirmedCountry.trim() : '';
  const firstName = typeof o.firstName === 'string' ? o.firstName.trim() : '';
  const lastName = typeof o.lastName === 'string' ? o.lastName.trim() : '';
  const howFoundUs = typeof o.howFoundUs === 'string' ? o.howFoundUs.trim() : '';
  const hasCountry = Boolean(country);
  const hasName = Boolean(firstName || lastName);
  const hasHowFound = Boolean(howFoundUs);
  return {
    country: country || null,
    firstName: firstName || null,
    lastName: lastName || null,
    howFoundUs: howFoundUs || null,
    hasCountry,
    hasName,
    hasHowFound,
    hasAny: hasCountry || hasName || hasHowFound,
  };
}

function howFoundUsLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return HOW_FOUND_US_LABELS[code] || code;
}

const diagnosticAdminSelect = {
  id: true,
  createdAt: true,
  status: true,
  email: true,
  refCode: true,
  utmSource: true,
  utmMedium: true,
  sourceChannel: true,
  domain: true,
  brandName: true,
  tier: true,
} as const;

type DiagnosticAdminRowInput = {
  id: string;
  createdAt: Date;
  brandName: string;
  domain: string;
  email: string | null;
  status: string;
  tier: string | null;
  refCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  sourceChannel: string | null;
};

function mapDiagnosticToAdminRow(
  row: DiagnosticAdminRowInput,
  campaignMap: Map<string, { name?: string | null }>
) {
  const refCode = row.refCode?.trim().toLowerCase() || null;
  const campaign = refCode ? campaignMap.get(refCode) : undefined;
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    brandName: row.brandName,
    domain: row.domain,
    email: row.email,
    status: row.status,
    tier: row.tier,
    refCode: row.refCode,
    referrerName: refCode ? resolveReferrerDisplayName(refCode, campaign?.name) : null,
    utmSource: row.utmSource,
    sourceChannel: row.sourceChannel,
  };
}

const adminReportsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1) Reporte de Adquisicion y Funnel
  // ----------------------------------------------------------------
  fastify.get('/internal/acquisition', async (request) => {
    const parsed = windowDaysSchema.safeParse(request.query);
    const windowDays = parsed.success ? parsed.data.windowDays : 30;
    const fromDate = startOfDay(new Date());
    fromDate.setDate(fromDate.getDate() - (windowDays - 1));

    const [diagnosticsInWindow, totalDiagnosticsAllTime, campaignMap] = await Promise.all([
      prisma.publicDiagnostic.findMany({
        where: { createdAt: { gte: fromDate } },
        select: diagnosticAdminSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.publicDiagnostic.count(),
      loadReferrerCampaignMap(),
    ]);

    const totalCreated = diagnosticsInWindow.length;
    const totalWithEmail = diagnosticsInWindow.filter((d) => Boolean(d.email)).length;
    const totalCompleted = diagnosticsInWindow.filter((d) => d.status === 'completed').length;
    const totalGold = diagnosticsInWindow.filter((d) => d.tier === 'gold').length;

    const series = buildDailySeries(diagnosticsInWindow, fromDate, windowDays, (extra, row) => {
      extra.completed = (extra.completed || 0) + (row.status === 'completed' ? 1 : 0);
      extra.withEmail = (extra.withEmail || 0) + (row.email ? 1 : 0);
    }).map((row) => ({
      date: row.date,
      created: row.count,
      completed: row.extra?.completed ?? 0,
      withEmail: row.extra?.withEmail ?? 0,
    }));

    const channelMap = new Map<string, number>();
    for (const row of diagnosticsInWindow) {
      const channel = (row.sourceChannel || 'web').trim().toLowerCase() || 'web';
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    }
    const channels = Array.from(channelMap.entries())
      .map(([channel, count]) => ({ channel, count, share: totalCreated ? (count / totalCreated) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);

    type RefRow = {
      refCode: string;
      visits: number;
      completed: number;
      capturedEmails: number;
      latestAt: Date;
    };
    const refMap = new Map<string, RefRow>();
    for (const row of diagnosticsInWindow) {
      const code = (row.refCode || '').trim().toLowerCase();
      if (!code) continue;
      const current = refMap.get(code) || {
        refCode: code,
        visits: 0,
        completed: 0,
        capturedEmails: 0,
        latestAt: row.createdAt,
      };
      current.visits += 1;
      if (row.status === 'completed') current.completed += 1;
      if (row.email) current.capturedEmails += 1;
      if (row.createdAt > current.latestAt) current.latestAt = row.createdAt;
      refMap.set(code, current);
    }
    const topReferrers = enrichAndSortReferrerMetrics(
      Array.from(refMap.values()).map((row) => ({
        refCode: row.refCode,
        visits: row.visits,
        completed: row.completed,
        capturedEmails: row.capturedEmails,
        completionRate: row.visits > 0 ? (row.completed / row.visits) * 100 : 0,
        latestAt: row.latestAt.toISOString(),
      })),
      campaignMap,
      { limit: 15 }
    );

    const sponsorBreakdown = buildSponsorChannelBreakdown(diagnosticsInWindow);

    const utmMap = new Map<string, number>();
    for (const row of diagnosticsInWindow) {
      const src = (row.utmSource || '').trim() || 'directo';
      utmMap.set(src, (utmMap.get(src) || 0) + 1);
    }
    const topUtmSources = Array.from(utmMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const latest = diagnosticsInWindow.slice(0, 25).map((row) => mapDiagnosticToAdminRow(row, campaignMap));

    return {
      windowDays,
      asOf: new Date().toISOString(),
      totals: {
        diagnosticsInWindow: totalCreated,
        diagnosticsAllTime: totalDiagnosticsAllTime,
        completedInWindow: totalCompleted,
        withEmailInWindow: totalWithEmail,
        goldInWindow: totalGold,
        completionRate: totalCreated ? (totalCompleted / totalCreated) * 100 : 0,
        emailCaptureRate: totalCreated ? (totalWithEmail / totalCreated) * 100 : 0,
        goldUpgradeRate: totalCreated ? (totalGold / totalCreated) * 100 : 0,
      },
      dailySeries: series,
      channels,
      topReferrers,
      sponsorBreakdown,
      topUtmSources,
      latestDiagnostics: latest,
    };
  });

  /** Busqueda historica por marca, dominio o email (reuniones / soporte). */
  fastify.get('/internal/acquisition/diagnostic-search', async (request, reply) => {
    const parsed = z
      .object({
        q: z.string().trim().min(2).max(120),
        limit: z.coerce.number().int().min(1).max(100).default(100),
        completedOnly: z
          .union([z.literal('true'), z.literal('false'), z.boolean()])
          .optional()
          .transform((v) => v === true || v === 'true'),
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parametros invalidos', details: parsed.error.flatten() });
    }

    const { q, limit, completedOnly } = parsed.data;
    const campaignMap = await loadReferrerCampaignMap();

    const orFilters: Prisma.PublicDiagnosticWhereInput[] = [
      { brandName: { contains: q, mode: 'insensitive' } },
      { domain: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ];

    const where: Prisma.PublicDiagnosticWhereInput = {
      ...(completedOnly ? { status: 'completed' } : {}),
      OR: orFilters,
    };

    const [totalMatching, rows] = await Promise.all([
      prisma.publicDiagnostic.count({ where }),
      prisma.publicDiagnostic.findMany({
        where,
        select: diagnosticAdminSelect,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    return {
      ok: true as const,
      query: q,
      completedOnly: Boolean(completedOnly),
      limit,
      totalMatching,
      returned: rows.length,
      truncated: totalMatching > rows.length,
      rows: rows.map((row) => mapDiagnosticToAdminRow(row, campaignMap)),
    };
  });

  // 1b) Perfil de onboarding (país, nombre, cómo llegó)
  // ----------------------------------------------------------------
  fastify.get('/internal/onboarding-profile', async (request) => {
    const querySchema = windowDaysSchema.extend({
      country: z.string().trim().max(120).optional(),
    });
    const parsed = querySchema.safeParse(request.query);
    const windowDays = parsed.success ? parsed.data.windowDays : 30;
    const countryFilter = parsed.success ? parsed.data.country?.trim() || '' : '';
    const fromDate = startOfDay(new Date());
    fromDate.setDate(fromDate.getDate() - (windowDays - 1));

    const diagnosticsInWindow = await prisma.publicDiagnostic.findMany({
      where: { createdAt: { gte: fromDate } },
      select: {
        id: true,
        createdAt: true,
        status: true,
        email: true,
        domain: true,
        brandName: true,
        setupDraftJson: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDiagnosticsInWindow = diagnosticsInWindow.length;

    const allRowsRaw = diagnosticsInWindow
      .map((row) => {
        const profile = onboardingProfileFromDraft(row.setupDraftJson);
        if (!profile.hasAny) return null;
        const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || null;
        return {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          brandName: row.brandName,
          domain: row.domain,
          email: row.email,
          status: row.status,
          country: profile.country,
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName,
          howFoundUs: profile.howFoundUs,
          howFoundLabel: howFoundUsLabel(profile.howFoundUs),
          hasCountry: profile.hasCountry,
          hasName: profile.hasName,
          hasHowFound: profile.hasHowFound,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    // Un lead = un dominio. Mismo email con otra empresa/dominio sí puede aparecer.
    // Si el mismo dominio aparece varias veces, nos quedamos con el más reciente.
    const seenDomains = new Set<string>();
    const allRows: typeof allRowsRaw = [];
    let duplicateDomainsSkipped = 0;
    for (const row of allRowsRaw) {
      const key = row.domain.trim().toLowerCase();
      if (!key) continue;
      if (seenDomains.has(key)) {
        duplicateDomainsSkipped += 1;
        continue;
      }
      seenDomains.add(key);
      allRows.push(row);
    }

    const countryCountMap = new Map<string, number>();
    for (const row of allRows) {
      if (!row.country) continue;
      countryCountMap.set(row.country, (countryCountMap.get(row.country) || 0) + 1);
    }
    const availableCountries = Array.from(countryCountMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country, 'es'));

    const countryFilterKey = countryFilter.toLocaleLowerCase('es');
    const rows = countryFilterKey
      ? allRows.filter((row) => (row.country || '').toLocaleLowerCase('es') === countryFilterKey)
      : allRows;

    let withCountry = 0;
    let withName = 0;
    let withHowFound = 0;
    const howFoundMap = new Map<string, number>();
    for (const row of rows) {
      if (row.hasCountry) withCountry += 1;
      if (row.hasName) withName += 1;
      if (row.hasHowFound && row.howFoundUs) {
        withHowFound += 1;
        howFoundMap.set(row.howFoundUs, (howFoundMap.get(row.howFoundUs) || 0) + 1);
      }
    }

    const withProfileData = rows.length;
    const howFoundBreakdown = Array.from(howFoundMap.entries())
      .map(([code, count]) => ({
        code,
        label: howFoundUsLabel(code) || code,
        count,
        share: withHowFound ? (count / withHowFound) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      windowDays,
      asOf: new Date().toISOString(),
      selectedCountry: countryFilter || null,
      availableCountries,
      totals: {
        diagnosticsInWindow: totalDiagnosticsInWindow,
        withProfileData,
        withCountry,
        withName,
        withHowFound,
        duplicateDomainsSkipped,
        profileRate: totalDiagnosticsInWindow ? (withProfileData / totalDiagnosticsInWindow) * 100 : 0,
        countryRate: totalDiagnosticsInWindow ? (withCountry / totalDiagnosticsInWindow) * 100 : 0,
        nameRate: totalDiagnosticsInWindow ? (withName / totalDiagnosticsInWindow) * 100 : 0,
        howFoundRate: totalDiagnosticsInWindow ? (withHowFound / totalDiagnosticsInWindow) * 100 : 0,
      },
      howFoundBreakdown,
      rows,
    };
  });

  // Enrichment on-demand (admin): solo al click, no batch.
  // ----------------------------------------------------------------
  fastify.post('/internal/enrich-contact', async (request, reply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      domain: z.string().trim().max(255).optional().nullable(),
      diagnosticIndustry: z.string().trim().max(255).optional().nullable(),
      brandName: z.string().trim().max(255).optional().nullable(),
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: 'Email inválido o body incompleto.' });
    }

    const email = parsed.data.email.trim().toLowerCase();
    if (!isCorporateEmail(email, parsed.data.domain)) {
      return reply.code(400).send({
        ok: false,
        error: 'Solo enriquecemos emails corporativos (no Gmail/Hotmail/etc.).',
      });
    }

    try {
      const result = await enrichContactOnDemand({
        email,
        domain: parsed.data.domain,
        diagnosticIndustry: parsed.data.diagnosticIndustry,
        brandName: parsed.data.brandName,
      });
      // PDL "Not Found" en persona no es error de ruta: devolvemos ficha igual.
      return result;
    } catch (error) {
      return reply.code(502).send({
        ok: false,
        error: error instanceof Error ? error.message : 'Error al enriquecer contacto.',
      });
    }
  });

  // 2) Reporte de Cleexs Score y posicionamiento
  // ----------------------------------------------------------------
  fastify.get('/internal/cleexs-score', async (request) => {
    const parsed = windowDaysSchema.safeParse(request.query);
    const windowDays = parsed.success ? parsed.data.windowDays : 30;
    const fromDate = startOfDay(new Date());
    fromDate.setDate(fromDate.getDate() - (windowDays - 1));

    const reports = await prisma.pRIAReport.findMany({
      where: {
        createdAt: { gte: fromDate },
        run: primaryRunWhere(),
      },
      include: {
        brand: {
          select: { id: true, name: true, domain: true, industry: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalReports = reports.length;
    const sum = reports.reduce((acc, r) => acc + (r.priaTotal || 0), 0);
    const avgScore = totalReports > 0 ? sum / totalReports : 0;

    const buckets = {
      poor: 0,
      low: 0,
      mid: 0,
      good: 0,
      excellent: 0,
    };
    for (const r of reports) {
      const s = r.priaTotal;
      if (s < 20) buckets.poor += 1;
      else if (s < 40) buckets.low += 1;
      else if (s < 60) buckets.mid += 1;
      else if (s < 80) buckets.good += 1;
      else buckets.excellent += 1;
    }

    type BrandStat = {
      brandId: string;
      brandName: string;
      domain: string | null;
      industry: string | null;
      latestScore: number;
      latestAt: Date;
      avgScore: number;
      runs: number;
    };
    const brandMap = new Map<string, BrandStat>();
    for (const r of reports) {
      const key = r.brandId;
      const current = brandMap.get(key);
      if (!current) {
        brandMap.set(key, {
          brandId: r.brandId,
          brandName: r.brand.name,
          domain: r.brand.domain,
          industry: r.brand.industry,
          latestScore: r.priaTotal,
          latestAt: r.createdAt,
          avgScore: r.priaTotal,
          runs: 1,
        });
        continue;
      }
      current.runs += 1;
      current.avgScore = (current.avgScore * (current.runs - 1) + r.priaTotal) / current.runs;
      if (r.createdAt > current.latestAt) {
        current.latestAt = r.createdAt;
        current.latestScore = r.priaTotal;
      }
    }
    const brandStats = Array.from(brandMap.values()).map((b) => ({
      brandId: b.brandId,
      brandName: b.brandName,
      domain: b.domain,
      industry: b.industry,
      latestScore: Math.round(b.latestScore * 10) / 10,
      avgScore: Math.round(b.avgScore * 10) / 10,
      latestAt: b.latestAt.toISOString(),
      runs: b.runs,
    }));

    const topBrands = [...brandStats].sort((a, b) => b.latestScore - a.latestScore).slice(0, 10);
    const bottomBrands = [...brandStats]
      .sort((a, b) => a.latestScore - b.latestScore)
      .slice(0, 10);

    type IndustryStat = { industry: string; runs: number; sum: number };
    const industryMap = new Map<string, IndustryStat>();
    for (const r of reports) {
      const industry = (r.brand.industry || 'Sin industria').trim() || 'Sin industria';
      const current = industryMap.get(industry) || { industry, runs: 0, sum: 0 };
      current.runs += 1;
      current.sum += r.priaTotal;
      industryMap.set(industry, current);
    }
    const industries = Array.from(industryMap.values())
      .map((row) => ({
        industry: row.industry,
        runs: row.runs,
        avgScore: row.runs ? Math.round((row.sum / row.runs) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 12);

    const series = buildDailySeries(reports, fromDate, windowDays, (extra, row) => {
      extra.scoreSum = (extra.scoreSum || 0) + (row.priaTotal || 0);
    }).map((row) => ({
      date: row.date,
      runs: row.count,
      avgScore:
        row.count > 0 && row.extra
          ? Math.round(((row.extra.scoreSum || 0) / row.count) * 10) / 10
          : 0,
    }));

    return {
      windowDays,
      asOf: new Date().toISOString(),
      totals: {
        reportsInWindow: totalReports,
        brandsAnalyzed: brandMap.size,
        averageScore: Math.round(avgScore * 10) / 10,
      },
      distribution: buckets,
      topBrands,
      bottomBrands,
      industries,
      dailySeries: series,
    };
  });

  // 2.5) Marcas analizadas (vista completa por marca con owner y plan)
  // ----------------------------------------------------------------
  fastify.get('/internal/brands', async (request) => {
    const querySchema = z.object({
      search: z.string().optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n <= 0) return 200;
          return Math.min(n, 500);
        }),
    });
    const parsed = querySchema.safeParse(request.query);
    const limit = parsed.success ? parsed.data.limit : 200;
    const search = parsed.success ? parsed.data.search?.trim().toLowerCase() : undefined;

    const brands = await prisma.brand.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        domain: true,
        industry: true,
        country: true,
        category: true,
        runSchedule: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            tenantCode: true,
            tenantType: true,
            status: true,
            plan: { select: { name: true } },
          },
        },
        runs: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            priaReports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { priaTotal: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { runs: true } },
      },
    });

    const items = brands.map((brand) => {
      const lastRun = brand.runs[0];
      let lastScore: number | null = null;
      let lastScoreAt: string | null = null;
      for (const run of brand.runs) {
        if (run.priaReports[0]) {
          lastScore = run.priaReports[0].priaTotal;
          lastScoreAt = run.priaReports[0].createdAt.toISOString();
          break;
        }
      }
      return {
        id: brand.id,
        name: brand.name,
        domain: brand.domain,
        industry: brand.industry,
        country: brand.country,
        category: brand.category,
        runSchedule: brand.runSchedule,
        createdAt: brand.createdAt.toISOString(),
        updatedAt: brand.updatedAt.toISOString(),
        runsTotal: brand._count.runs,
        lastRun: lastRun
          ? {
              id: lastRun.id,
              status: lastRun.status,
              createdAt: lastRun.createdAt.toISOString(),
            }
          : null,
        lastScore,
        lastScoreAt,
        tenant: brand.tenant
          ? {
              id: brand.tenant.id,
              code: brand.tenant.tenantCode,
              type: brand.tenant.tenantType,
              status: brand.tenant.status,
              plan: brand.tenant.plan?.name ?? null,
            }
          : null,
      };
    });

    const filtered = search
      ? items.filter((b) => {
          const hay = `${b.name} ${b.domain || ''} ${b.industry || ''} ${b.tenant?.code || ''} ${b.tenant?.plan || ''}`.toLowerCase();
          return hay.includes(search);
        })
      : items;

    const summary = {
      total: filtered.length,
      withScore: filtered.filter((b) => b.lastScore != null).length,
      scoredAvg:
        filtered.filter((b) => b.lastScore != null).reduce((acc, b) => acc + (b.lastScore || 0), 0) /
          Math.max(1, filtered.filter((b) => b.lastScore != null).length),
      premium: filtered.filter((b) => (b.tenant?.plan || '').toLowerCase().includes('premium')).length,
      withRuns: filtered.filter((b) => b.runsTotal > 0).length,
    };

    return {
      asOf: new Date().toISOString(),
      summary: {
        ...summary,
        scoredAvg: Math.round(summary.scoredAvg * 10) / 10,
      },
      items: filtered,
    };
  });

  // 3) Reporte de Email y Outreach
  // ----------------------------------------------------------------
  fastify.get('/internal/email-outreach', async (request) => {
    const parsed = windowDaysSchema.safeParse(request.query);
    const windowDays = parsed.success ? parsed.data.windowDays : 30;
    const fromDate = startOfDay(new Date());
    fromDate.setDate(fromDate.getDate() - (windowDays - 1));

    const [
      weeklyLogs,
      weeklyEventsByType,
      outreachEmails,
      outreachContacts,
      campaigns,
    ] = await Promise.all([
      prisma.cleexsInternalEmailSendLog.findMany({
        where: { createdAt: { gte: fromDate } },
        select: {
          id: true,
          status: true,
          campaignSlug: true,
          recipientEmail: true,
          createdAt: true,
          scoreBucket: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cleexsResendWebhookEvent.groupBy({
        by: ['eventType'],
        where: { occurredAt: { gte: fromDate } },
        _count: { _all: true },
      }),
      prisma.leadEmail.findMany({
        where: { createdAt: { gte: fromDate } },
        select: {
          id: true,
          status: true,
          sentAt: true,
          createdAt: true,
          metaJson: true,
          leadContact: { select: { email: true } },
          leadSource: { select: { competitorName: true, competitorDomain: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leadContact.count(),
      prisma.cleexsInternalEmailCampaign.count(),
    ]);

    const weeklyTotals = {
      sent: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    };
    for (const log of weeklyLogs) {
      const key = log.status as keyof typeof weeklyTotals;
      if (key in weeklyTotals) weeklyTotals[key] += 1;
    }

    const weeklyEvents: Record<string, number> = {};
    for (const g of weeklyEventsByType) {
      weeklyEvents[g.eventType] = g._count._all;
    }

    type OutreachMeta = {
      eventCounts?: Record<string, number>;
      lastEvent?: string;
      mode?: string;
    } | null;
    const outreachTotals = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      delivery_delayed: 0,
      shadow: 0,
      real: 0,
      drafts: 0,
    };
    type DomainStat = {
      domain: string;
      sent: number;
      opened: number;
      clicked: number;
    };
    const domainMap = new Map<string, DomainStat>();

    for (const email of outreachEmails) {
      const meta = (email.metaJson as OutreachMeta) ?? {};
      const counts = (meta?.eventCounts || {}) as Record<string, number>;
      if (email.status === 'draft' || email.status === 'queued') {
        outreachTotals.drafts += 1;
      }
      if (email.status === 'sent' || email.sentAt) {
        outreachTotals.sent += 1;
      }
      const lastEvent = (meta?.lastEvent || '').toLowerCase();
      if (lastEvent === 'failed') outreachTotals.failed += 1;
      for (const [evt, c] of Object.entries(counts)) {
        const key = evt.replace('email.', '');
        if (key in outreachTotals) {
          outreachTotals[key as keyof typeof outreachTotals] += c;
        }
      }
      if (meta?.mode === 'shadow') outreachTotals.shadow += 1;
      if (meta?.mode === 'real') outreachTotals.real += 1;

      const domain = (email.leadSource?.competitorDomain || '').trim().toLowerCase();
      if (domain) {
        const current = domainMap.get(domain) || { domain, sent: 0, opened: 0, clicked: 0 };
        if (email.sentAt || email.status === 'sent') current.sent += 1;
        const ev = (meta?.eventCounts || {}) as Record<string, number>;
        current.opened += ev['email.opened'] || ev.opened || 0;
        current.clicked += ev['email.clicked'] || ev.clicked || 0;
        domainMap.set(domain, current);
      }
    }

    const topOutreachDomains = Array.from(domainMap.values())
      .sort((a, b) => {
        const aRate = a.sent > 0 ? a.opened / a.sent : 0;
        const bRate = b.sent > 0 ? b.opened / b.sent : 0;
        return bRate - aRate || b.sent - a.sent;
      })
      .slice(0, 12)
      .map((row) => ({
        domain: row.domain,
        sent: row.sent,
        opened: row.opened,
        clicked: row.clicked,
        openRate: row.sent > 0 ? (row.opened / row.sent) * 100 : 0,
        clickRate: row.sent > 0 ? (row.clicked / row.sent) * 100 : 0,
      }));

    const weeklySeries = buildDailySeries(weeklyLogs, fromDate, windowDays).map((row) => ({
      date: row.date,
      sends: row.count,
    }));
    const outreachSeries = buildDailySeries(outreachEmails, fromDate, windowDays).map((row) => ({
      date: row.date,
      sends: row.count,
    }));

    const outreachDeliveryRate =
      outreachTotals.sent > 0 ? (outreachTotals.delivered / outreachTotals.sent) * 100 : 0;
    const outreachOpenRate =
      outreachTotals.delivered > 0
        ? (outreachTotals.opened / outreachTotals.delivered) * 100
        : 0;
    const outreachBounceRate =
      outreachTotals.sent > 0 ? (outreachTotals.bounced / outreachTotals.sent) * 100 : 0;

    return {
      windowDays,
      asOf: new Date().toISOString(),
      weekly: {
        campaignsConfigured: campaigns,
        totals: weeklyTotals,
        eventsByType: weeklyEvents,
        dailySeries: weeklySeries,
      },
      outreach: {
        contactsAllTime: outreachContacts,
        totals: outreachTotals,
        rates: {
          deliveryRate: Math.round(outreachDeliveryRate * 10) / 10,
          openRate: Math.round(outreachOpenRate * 10) / 10,
          bounceRate: Math.round(outreachBounceRate * 10) / 10,
        },
        topDomains: topOutreachDomains,
        dailySeries: outreachSeries,
      },
      integrations: {
        resendWebhookSecretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
        outreachDomainVerified: process.env.OUTREACH_DOMAIN_VERIFIED === 'true',
      },
    };
  });

  // 4) Configuracion del sistema (integraciones + variables + webhooks + cron + DB)
  // ----------------------------------------------------------------
  fastify.get('/internal/system-config', async () => {
    const now = new Date();
    const since30 = new Date(now);
    since30.setDate(since30.getDate() - 30);
    const since7 = new Date(now);
    since7.setDate(since7.getDate() - 7);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const apiBase =
      envValue('PUBLIC_WEBHOOK_BASE_URL') ||
      envValue('RAILWAY_PUBLIC_DOMAIN') ||
      envValue('API_URL') ||
      'https://cleexsapi-production.up.railway.app';
    const apiBaseHttp = apiBase.startsWith('http') ? apiBase : `https://${apiBase}`;

    const [
      mpEventsLast30,
      mpLastEvent,
      resendEventsLast30,
      resendLastEvent,
      resendEventsByType,
      weeklyLastSend,
      weeklySendsLast30,
      weeklySendsLast7,
      weeklyCampaignsActive,
      outreachTodayReal,
      outreachLast7,
      dbCounts,
    ] = await Promise.all([
      prisma.webhookEvent
        .count({ where: { receivedAt: { gte: since30 } } })
        .catch(() => 0),
      prisma.webhookEvent
        .findFirst({ orderBy: { receivedAt: 'desc' }, select: { receivedAt: true, provider: true } })
        .catch(() => null),
      prisma.cleexsResendWebhookEvent
        .count({ where: { occurredAt: { gte: since30 } } })
        .catch(() => 0),
      prisma.cleexsResendWebhookEvent
        .findFirst({ orderBy: { occurredAt: 'desc' }, select: { occurredAt: true, eventType: true } })
        .catch(() => null),
      prisma.cleexsResendWebhookEvent
        .groupBy({
          by: ['eventType'],
          where: { occurredAt: { gte: since30 } },
          _count: { _all: true },
        })
        .catch(() => [] as Array<{ eventType: string; _count: { _all: number } }>),
      prisma.cleexsInternalEmailSendLog
        .findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, status: true } })
        .catch(() => null),
      prisma.cleexsInternalEmailSendLog
        .count({ where: { createdAt: { gte: since30 } } })
        .catch(() => 0),
      prisma.cleexsInternalEmailSendLog
        .count({ where: { createdAt: { gte: since7 } } })
        .catch(() => 0),
      prisma.cleexsInternalEmailCampaign
        .count({ where: { active: true } })
        .catch(() => 0),
      prisma.leadEmail
        .count({
          where: {
            sentAt: { gte: startOfToday },
            metaJson: { path: ['mode'], equals: 'real' },
          },
        })
        .catch(() => 0),
      prisma.leadEmail.count({ where: { sentAt: { gte: since7 } } }).catch(() => 0),
      Promise.all([
        prisma.tenant.count(),
        prisma.user.count(),
        prisma.brand.count(),
        prisma.run.count({ where: primaryRunWhere() }),
        prisma.payment.count(),
        prisma.subscription.count(),
        prisma.leadContact.count(),
        prisma.leadEmail.count(),
        prisma.publicDiagnostic.count(),
      ]).then(([tenants, users, brands, runs, payments, subscriptions, leadContacts, leadEmails, publicDiagnostics]) => ({
        tenants,
        users,
        brands,
        runs,
        payments,
        subscriptions,
        leadContacts,
        leadEmails,
        publicDiagnostics,
      })),
    ]);

    const resendEventsByTypeMap: Record<string, number> = {};
    for (const g of resendEventsByType) {
      resendEventsByTypeMap[g.eventType] = g._count._all;
    }

    return {
      asOf: now.toISOString(),
      environment: {
        nodeVersion: process.version,
        uptimeSec: Math.floor(process.uptime()),
        hostname: process.env.HOSTNAME || null,
        railwayCommit: envValue('RAILWAY_GIT_COMMIT_SHA') || null,
        railwayBranch: envValue('RAILWAY_GIT_BRANCH') || null,
        railwayDomain: envValue('RAILWAY_PUBLIC_DOMAIN') || null,
        nodeEnv: envValue('NODE_ENV', 'development'),
      },
      integrations: {
        openai: {
          configured: envFlag('OPENAI_API_KEY'),
          model: envValue('DIAGNOSTIC_AI_OPENAI_MODEL', 'gpt-4o-mini'),
          competitorsModel: envValue('DIAGNOSTIC_COMPETITORS_OPENAI_MODEL', 'gpt-4o'),
        },
        gemini: {
          configured:
            envFlag('GEMINI_API_KEY') || envFlag('GOOGLE_API_KEY') || envFlag('GOOGLE_AI_API_KEY'),
        },
        resend: {
          apiKeyConfigured: envFlag('RESEND_API_KEY'),
          webhookSecretConfigured: envFlag('RESEND_WEBHOOK_SECRET'),
        },
        smtp: {
          configured:
            envFlag('SMTP_HOST') &&
            envValue('SMTP_HOST') !== 'localhost' &&
            envFlag('SMTP_USER') &&
            envFlag('SMTP_PASS'),
          host: envValue('SMTP_HOST') || null,
          port: Number(envValue('SMTP_PORT', '587')),
          fromEmail: envValue('SMTP_FROM_EMAIL') || envValue('SMTP_FROM') || null,
          fromName: envValue('SMTP_FROM_NAME') || null,
        },
        mercadopago: {
          accessTokenConfigured: envFlag('MP_ACCESS_TOKEN'),
          webhookSecretConfigured: envFlag('MP_WEBHOOK_SECRET'),
          webhookUrl: `${apiBaseHttp.replace(/\/$/, '')}/api/webhooks/mercadopago`,
        },
        firecrawl: { configured: envFlag('FIRECRAWL_API_KEY') },
        hunter: { configured: envFlag('HUNTER_API_KEY') },
        serper: { configured: envFlag('SERPER_API_KEY') },
        builderbot: {
          configured: envFlag('BUILDERBOT_BOT_ID') && envFlag('BUILDERBOT_API_KEY'),
          baseUrl: envValue('BUILDERBOT_BASE_URL', 'https://app.builderbot.cloud'),
          baileysBotUrl: envValue('BAILEYS_BOT_URL') || null,
          baileysPublicUrl: envValue('BAILEYS_BOT_PUBLIC_URL') || envValue('BAILEYS_BOT_URL') || null,
        },
        whatsapp: {
          apiKeyConfigured: envFlag('WHATSAPP_CHANNEL_API_KEY'),
          dailyLimit: Number(envValue('WA_CHANNEL_DAILY_LIMIT', '5')),
        },
        satellite: {
          enabled: envValue('SATELLITE_ENABLED', 'true').toLowerCase() !== 'false',
          baseUrl: envValue('SATELLITE_BASE_URL') || null,
        },
        database: {
          configured: envFlag('DATABASE_URL'),
        },
      },
      variables: {
        outreach: {
          fromEmail: envValue('OUTREACH_FROM_EMAIL') || null,
          fromName: envValue('OUTREACH_FROM_NAME') || null,
          replyTo: envValue('OUTREACH_REPLY_TO') || null,
          shadowTo: envValue('OUTREACH_SHADOW_TO') || null,
          dailyLimit: Number(envValue('OUTREACH_DAILY_LIMIT', '20')),
          domainVerified: envBool('OUTREACH_DOMAIN_VERIFIED'),
        },
        admin: {
          apiSecretConfigured: envFlag('ADMIN_API_SECRET'),
          requireAuth: envBool('ADMIN_REQUIRE_AUTH'),
          fullAccessEmails:
            envValue('ADMIN_FULL_ACCESS_EMAILS')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean).length,
          allowActorQuery: envBool('ALLOW_USAGE_ACTOR_QUERY'),
        },
        auth: {
          portalJwtSecretConfigured: envFlag('PORTAL_JWT_SECRET'),
          cronSecretConfigured: envFlag('CRON_SECRET'),
        },
        urls: {
          frontend: envValue('FRONTEND_URL') || null,
          frontendList: envValue('FRONTEND_URLS') || null,
          appUrl: envValue('CLEEXS_APP_URL') || envValue('NEXT_PUBLIC_APP_URL') || null,
          marketingUrl: envValue('CLEEXS_MARKETING_URL', 'https://cleexs.net'),
          apiBase: apiBaseHttp,
        },
        billing: {
          usdToArsRate: Number(envValue('BILLING_USD_TO_ARS_RATE', '0')) || null,
          currency: envValue('BILLING_CURRENCY') || null,
        },
        publicDiagnostic: {
          defaultCountry: envValue('PUBLIC_DIAGNOSTIC_DEFAULT_COUNTRY', 'Argentina'),
          marketConfidenceMin: Number(envValue('PUBLIC_DIAGNOSTIC_MARKET_CONFIDENCE_MIN', '70')),
        },
      },
      webhooks: {
        mercadopago: {
          url: `${apiBaseHttp.replace(/\/$/, '')}/api/webhooks/mercadopago`,
          eventsLast30Days: mpEventsLast30,
          lastEventAt: mpLastEvent?.receivedAt?.toISOString() ?? null,
          lastEventSource: mpLastEvent?.provider ?? null,
          configured: envFlag('MP_ACCESS_TOKEN'),
        },
        resend: {
          url: `${apiBaseHttp.replace(/\/$/, '')}/api/webhooks/resend`,
          eventsLast30Days: resendEventsLast30,
          lastEventAt: resendLastEvent?.occurredAt?.toISOString() ?? null,
          lastEventType: resendLastEvent?.eventType ?? null,
          eventsByType: resendEventsByTypeMap,
          configured: envFlag('RESEND_WEBHOOK_SECRET'),
        },
      },
      cron: {
        weeklyEmails: {
          lastSendAt: weeklyLastSend?.createdAt?.toISOString() ?? null,
          lastSendStatus: weeklyLastSend?.status ?? null,
          sendsLast30Days: weeklySendsLast30,
          sendsLast7Days: weeklySendsLast7,
          campaignsActive: weeklyCampaignsActive,
          cronSecretConfigured: envFlag('CRON_SECRET'),
        },
        outreach: {
          dailyLimit: Number(envValue('OUTREACH_DAILY_LIMIT', '20')),
          todayRealSent: outreachTodayReal,
          last7DaysSent: outreachLast7,
          domainVerified: envBool('OUTREACH_DOMAIN_VERIFIED'),
        },
      },
      database: dbCounts,
    };
  });

  // 6) Listado de Facturas / Pagos emitidos a clientes
  // ----------------------------------------------------------------
  fastify.get('/internal/payments', async (request) => {
    const querySchema = z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      page: z.string().optional(),
      pageSize: z.string().optional(),
    });
    const parsed = querySchema.safeParse(request.query);
    const status = parsed.success ? parsed.data.status?.trim() : undefined;
    const search = parsed.success ? parsed.data.search?.trim() : undefined;
    const page = Math.max(1, Number(parsed.success ? parsed.data.page : '1') || 1);
    const pageSizeRaw = Number(parsed.success ? parsed.data.pageSize : '20') || 20;
    const pageSize = Math.min(100, Math.max(5, pageSizeRaw));

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { payerEmail: { contains: search, mode: 'insensitive' } },
        { mpPaymentId: { contains: search, mode: 'insensitive' } },
        { mpMerchantOrderId: { contains: search, mode: 'insensitive' } },
        { tenant: { is: { tenantCode: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [items, total, byStatusRaw, allTime, approvedThisMonth] = await Promise.all([
      prisma.payment.findMany({
        where,
        // paidAt DESC con NULLs first (default PG) enterraba aprobadas detrás de
        // decenas de checkouts pending sin paidAt. Ordenamos por actividad reciente.
        orderBy: [{ createdAt: 'desc' }, { paidAt: { sort: 'desc', nulls: 'last' } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          currency: true,
          amountArs: true,
          amountUsd: true,
          netReceivedAmountArs: true,
          mpPaymentId: true,
          mpMerchantOrderId: true,
          mpPreapprovalId: true,
          paymentMethodId: true,
          paymentTypeId: true,
          statusDetail: true,
          payerEmail: true,
          paidAt: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              tenantCode: true,
              plan: { select: { id: true, name: true } },
            },
          },
          subscription: {
            select: {
              id: true,
              billingInterval: true,
              status: true,
              plan: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'approved' },
        _sum: { amountArs: true, amountUsd: true, netReceivedAmountArs: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'approved', paidAt: { gte: startOfMonth } },
        _sum: { amountArs: true, amountUsd: true, netReceivedAmountArs: true },
        _count: { _all: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[String(row.status)] = row._count?._all ?? 0;
    }

    return {
      items: items.map((p) => ({
        id: p.id,
        status: p.status,
        currency: p.currency,
        amountArs: p.amountArs ? Number(p.amountArs) : null,
        amountUsd: p.amountUsd ? Number(p.amountUsd) : null,
        netReceivedAmountArs: p.netReceivedAmountArs ? Number(p.netReceivedAmountArs) : null,
        mpPaymentId: p.mpPaymentId,
        mpMerchantOrderId: p.mpMerchantOrderId,
        mpPreapprovalId: p.mpPreapprovalId,
        paymentMethodId: p.paymentMethodId,
        paymentTypeId: p.paymentTypeId,
        statusDetail: p.statusDetail,
        payerEmail: p.payerEmail,
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        tenant: p.tenant
          ? {
              id: p.tenant.id,
              tenantCode: p.tenant.tenantCode,
              planName: p.tenant.plan?.name ?? null,
            }
          : null,
        subscription: p.subscription
          ? {
              id: p.subscription.id,
              billingInterval: p.subscription.billingInterval,
              status: p.subscription.status,
              planName: p.subscription.plan?.name ?? null,
            }
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        byStatus,
        approvedAllTime: {
          count: allTime._count?._all ?? 0,
          totalArs: allTime._sum?.amountArs ? Number(allTime._sum.amountArs) : 0,
          totalUsd: allTime._sum?.amountUsd ? Number(allTime._sum.amountUsd) : 0,
          netReceivedArs: allTime._sum?.netReceivedAmountArs
            ? Number(allTime._sum.netReceivedAmountArs)
            : 0,
        },
        approvedThisMonth: {
          count: approvedThisMonth._count?._all ?? 0,
          totalArs: approvedThisMonth._sum?.amountArs
            ? Number(approvedThisMonth._sum.amountArs)
            : 0,
          totalUsd: approvedThisMonth._sum?.amountUsd
            ? Number(approvedThisMonth._sum.amountUsd)
            : 0,
          netReceivedArs: approvedThisMonth._sum?.netReceivedAmountArs
            ? Number(approvedThisMonth._sum.netReceivedAmountArs)
            : 0,
        },
      },
    };
  });

  // 7) Planes (lectura y edicion desde /admin/planes)
  // ----------------------------------------------------------------
  fastify.get('/internal/plans', async () => {
    const plans = await prisma.plan.findMany({
      orderBy: [{ displayOrder: 'asc' }, { priceMonthly: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { tenants: true, subscriptions: true } },
      },
    });

    return {
      items: plans.map((p) => ({
        id: p.id,
        name: p.name,
        tier: p.tier ?? null,
        description: p.description ?? null,
        ctaLabel: p.ctaLabel ?? null,
        badge: p.badge ?? null,
        isRecommended: p.isRecommended,
        isPublic: p.isPublic,
        displayOrder: p.displayOrder,
        priceMonthly: p.priceMonthly == null ? null : Number(p.priceMonthly),
        runsPerMonth: p.runsPerMonth,
        promptsActiveLimit: p.promptsActiveLimit,
        brandsLimit: p.brandsLimit,
        competitorsLimit: p.competitorsLimit,
        retentionMonths: p.retentionMonths,
        automationEnabled: p.automationEnabled,
        features: Array.isArray(p.features) ? (p.features as unknown as string[]) : [],
        engines: Array.isArray(p.engines) ? (p.engines as unknown as string[]) : [],
        tenantsCount: p._count.tenants,
        subscriptionsCount: p._count.subscriptions,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  });

  fastify.patch<{ Params: { id: string } }>('/internal/plans/:id', async (request, reply) => {
    const bodySchema = z
      .object({
        name: z.string().min(1).max(120).optional(),
        tier: z
          .string()
          .max(30)
          .nullable()
          .optional()
          .transform((v) => (v == null ? v : v.trim() || null)),
        description: z
          .string()
          .max(2000)
          .nullable()
          .optional()
          .transform((v) => (v == null ? v : v.trim() || null)),
        ctaLabel: z
          .string()
          .max(60)
          .nullable()
          .optional()
          .transform((v) => (v == null ? v : v.trim() || null)),
        badge: z
          .string()
          .max(40)
          .nullable()
          .optional()
          .transform((v) => (v == null ? v : v.trim() || null)),
        isRecommended: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        displayOrder: z.number().int().min(0).max(999).optional(),
        priceMonthly: z.number().min(0).max(1_000_000).nullable().optional(),
        runsPerMonth: z.number().int().min(0).max(1_000_000).optional(),
        promptsActiveLimit: z.number().int().min(0).max(1_000_000).optional(),
        brandsLimit: z.number().int().min(0).max(1_000_000).optional(),
        competitorsLimit: z.number().int().min(0).max(1_000_000).optional(),
        retentionMonths: z.number().int().min(0).max(120).optional(),
        automationEnabled: z.boolean().optional(),
        features: z.array(z.string().min(1).max(200)).max(20).optional(),
        engines: z.array(z.string().min(1).max(40)).max(10).optional(),
      })
      .strict();

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const { id } = request.params;
    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'plan_not_found' });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.features !== undefined) data.features = parsed.data.features;
    if (parsed.data.engines !== undefined) data.engines = parsed.data.engines;

    const updated = await prisma.plan.update({ where: { id }, data });
    return {
      id: updated.id,
      name: updated.name,
      tier: updated.tier ?? null,
      description: updated.description ?? null,
      ctaLabel: updated.ctaLabel ?? null,
      badge: updated.badge ?? null,
      isRecommended: updated.isRecommended,
      isPublic: updated.isPublic,
      displayOrder: updated.displayOrder,
      priceMonthly: updated.priceMonthly == null ? null : Number(updated.priceMonthly),
      runsPerMonth: updated.runsPerMonth,
      promptsActiveLimit: updated.promptsActiveLimit,
      brandsLimit: updated.brandsLimit,
      competitorsLimit: updated.competitorsLimit,
      retentionMonths: updated.retentionMonths,
      automationEnabled: updated.automationEnabled,
      features: Array.isArray(updated.features) ? (updated.features as unknown as string[]) : [],
      engines: Array.isArray(updated.engines) ? (updated.engines as unknown as string[]) : [],
      updatedAt: updated.updatedAt.toISOString(),
    };
  });

  // 7) Estadisticas de emails semanales (campaignSlug que arranca con "weekly-")
  // ----------------------------------------------------------------
  fastify.get('/internal/weekly-emails-stats', async (request) => {
    const querySchema = z.object({
      windowDays: z.string().optional(),
      campaignLimit: z.string().optional(),
      recipientsLimit: z.string().optional(),
    });
    const parsed = querySchema.safeParse(request.query);
    const windowDays = (() => {
      const n = Number(parsed.success ? parsed.data.windowDays : '90');
      if (!Number.isFinite(n) || n <= 7) return 7;
      if (n <= 30) return 30;
      if (n <= 90) return 90;
      return 180;
    })();
    const campaignLimit = Math.min(
      30,
      Math.max(5, Number(parsed.success ? parsed.data.campaignLimit : '12') || 12)
    );
    const recipientsLimit = Math.min(
      200,
      Math.max(10, Number(parsed.success ? parsed.data.recipientsLimit : '50') || 50)
    );

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const weeklyWhere = {
      campaignSlug: { startsWith: 'weekly-' },
    } as const;

    const [logsInWindow, totalAllTime, byStatusAllTime, lastLog, firstLog, recentRecipients] =
      await Promise.all([
        prisma.cleexsInternalEmailSendLog.findMany({
          where: { ...weeklyWhere, createdAt: { gte: since } },
          select: {
            id: true,
            campaignSlug: true,
            status: true,
            createdAt: true,
            mergeSummary: true,
            recipientEmail: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.cleexsInternalEmailSendLog.count({ where: weeklyWhere }),
        prisma.cleexsInternalEmailSendLog.groupBy({
          by: ['status'],
          where: weeklyWhere,
          _count: { _all: true },
        }),
        prisma.cleexsInternalEmailSendLog.findFirst({
          where: weeklyWhere,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, campaignSlug: true, status: true },
        }),
        prisma.cleexsInternalEmailSendLog.findFirst({
          where: weeklyWhere,
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        prisma.cleexsInternalEmailSendLog.findMany({
          where: weeklyWhere,
          orderBy: { createdAt: 'desc' },
          take: recipientsLimit,
          select: {
            id: true,
            recipientEmail: true,
            campaignSlug: true,
            status: true,
            errorMessage: true,
            externalId: true,
            scoreBucket: true,
            cleexsScore: true,
            mergeSummary: true,
            createdAt: true,
            tenant: { select: { id: true, tenantCode: true } },
          },
        }),
      ]);

    const statusCounts: Record<string, number> = { sent: 0, failed: 0, skipped: 0, pending: 0 };
    for (const row of byStatusAllTime) {
      statusCounts[row.status] = row._count._all;
    }

    const inWindowStatusCounts: Record<string, number> = {
      sent: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    };
    for (const row of logsInWindow) {
      inWindowStatusCounts[row.status] = (inWindowStatusCounts[row.status] ?? 0) + 1;
    }

    type CampaignAcc = {
      slug: string;
      firstAt: Date;
      lastAt: Date;
      sent: number;
      failed: number;
      skipped: number;
      pending: number;
      segment: string | null;
      weekSlot: number | null;
      mode: string | null;
      recipients: number;
    };

    const campaignMap = new Map<string, CampaignAcc>();
    for (const log of logsInWindow) {
      const slug = log.campaignSlug;
      const acc = campaignMap.get(slug) ?? {
        slug,
        firstAt: log.createdAt,
        lastAt: log.createdAt,
        sent: 0,
        failed: 0,
        skipped: 0,
        pending: 0,
        segment: null,
        weekSlot: null,
        mode: null,
        recipients: 0,
      };
      if (log.createdAt < acc.firstAt) acc.firstAt = log.createdAt;
      if (log.createdAt > acc.lastAt) acc.lastAt = log.createdAt;
      if (log.status === 'sent') acc.sent += 1;
      else if (log.status === 'failed') acc.failed += 1;
      else if (log.status === 'skipped') acc.skipped += 1;
      else if (log.status === 'pending') acc.pending += 1;
      acc.recipients += 1;
      if (log.mergeSummary && typeof log.mergeSummary === 'object') {
        const summary = log.mergeSummary as Record<string, unknown>;
        if (acc.segment == null && typeof summary.segment === 'string') {
          acc.segment = summary.segment;
        }
        if (acc.weekSlot == null && typeof summary.weekSlot === 'number') {
          acc.weekSlot = summary.weekSlot;
        }
        if (acc.mode == null && typeof summary.mode === 'string') {
          acc.mode = summary.mode;
        }
      }
      campaignMap.set(slug, acc);
    }

    const campaigns = Array.from(campaignMap.values())
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
      .slice(0, campaignLimit)
      .map((c) => ({
        campaignSlug: c.slug,
        firstSendAt: c.firstAt.toISOString(),
        lastSendAt: c.lastAt.toISOString(),
        recipients: c.recipients,
        sent: c.sent,
        failed: c.failed,
        skipped: c.skipped,
        pending: c.pending,
        successRate: c.recipients > 0 ? (c.sent / c.recipients) * 100 : 0,
        segment: c.segment,
        weekSlot: c.weekSlot,
        mode: c.mode,
      }));

    const todayKey = new Date().toISOString().slice(0, 10);
    const sentToday = logsInWindow.filter(
      (r) => r.status === 'sent' && r.createdAt.toISOString().slice(0, 10) === todayKey
    ).length;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sentLast7 = logsInWindow.filter(
      (r) => r.status === 'sent' && r.createdAt >= sevenDaysAgo
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      windowDays,
      campaignsTracked: campaignMap.size,
      allTime: {
        total: totalAllTime,
        ...statusCounts,
        firstSendAt: firstLog?.createdAt?.toISOString() ?? null,
        lastSendAt: lastLog?.createdAt?.toISOString() ?? null,
        lastCampaignSlug: lastLog?.campaignSlug ?? null,
        lastStatus: lastLog?.status ?? null,
      },
      window: {
        total: logsInWindow.length,
        ...inWindowStatusCounts,
        sentToday,
        sentLast7,
      },
      campaigns,
      recentRecipients: recentRecipients.map((r) => ({
        id: r.id,
        recipientEmail: r.recipientEmail,
        campaignSlug: r.campaignSlug,
        status: r.status,
        errorMessage: r.errorMessage,
        externalId: r.externalId,
        scoreBucket: r.scoreBucket,
        cleexsScore: r.cleexsScore,
        segment:
          r.mergeSummary && typeof r.mergeSummary === 'object'
            ? ((r.mergeSummary as Record<string, unknown>).segment as string | undefined) ?? null
            : null,
        weekSlot:
          r.mergeSummary && typeof r.mergeSummary === 'object'
            ? ((r.mergeSummary as Record<string, unknown>).weekSlot as number | undefined) ?? null
            : null,
        tenantCode: r.tenant?.tenantCode ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      cron: {
        cronSecretConfigured: envFlag('CRON_SECRET'),
        scheduleHint: 'martes 13:00 UTC (10:00 AR)',
      },
    };
  });

  const SCHEDULE_KEY = 'default';

  async function loadWeeklySchedule() {
    let row = await prisma.weeklyEmailSchedule.findUnique({ where: { key: SCHEDULE_KEY } });
    if (!row) {
      row = await prisma.weeklyEmailSchedule.create({
        data: {
          key: SCHEDULE_KEY,
          enabled: true,
          dayOfWeekUtc: 2,
          hourUtc: 13,
          segment: 'free',
          dryRun: false,
        },
      });
    }
    return row;
  }

  fastify.get('/internal/weekly-schedule', async () => {
    const row = await loadWeeklySchedule();
    return {
      id: row.id,
      key: row.key,
      enabled: row.enabled,
      dayOfWeekUtc: row.dayOfWeekUtc,
      hourUtc: row.hourUtc,
      segment: row.segment,
      dryRun: row.dryRun,
      notes: row.notes,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
  });

  const updateScheduleSchema = z.object({
    enabled: z.boolean().optional(),
    dayOfWeekUtc: z.number().int().min(0).max(6).optional(),
    hourUtc: z.number().int().min(0).max(23).optional(),
    segment: z.enum(['all', 'free', 'premium']).optional(),
    dryRun: z.boolean().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  });

  fastify.put('/internal/weekly-schedule', async (request, reply) => {
    const parsed = updateScheduleSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload invalido', details: parsed.error.flatten() });
    }

    const current = await loadWeeklySchedule();

    const row = await prisma.weeklyEmailSchedule.update({
      where: { id: current.id },
      data: {
        enabled: parsed.data.enabled ?? current.enabled,
        dayOfWeekUtc: parsed.data.dayOfWeekUtc ?? current.dayOfWeekUtc,
        hourUtc: parsed.data.hourUtc ?? current.hourUtc,
        segment: parsed.data.segment ?? current.segment,
        dryRun: parsed.data.dryRun ?? current.dryRun,
        notes: parsed.data.notes === undefined ? current.notes : parsed.data.notes,
      },
    });

    return {
      id: row.id,
      key: row.key,
      enabled: row.enabled,
      dayOfWeekUtc: row.dayOfWeekUtc,
      hourUtc: row.hourUtc,
      segment: row.segment,
      dryRun: row.dryRun,
      notes: row.notes,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
  });

  // ============================================
  // WhatsApp · Mensajes (admin)
  // ============================================

  fastify.get<{ Querystring: { search?: string; limit?: string } }>(
    '/internal/whatsapp/conversations',
    async (request) => {
      const search = (request.query.search || '').trim();
      const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 80));
      const looksLikePhoneDigits = (value: string) => /^\d{8,15}$/.test(value);

      // Filtro de busqueda por phone (digitos), chatId o contenido del ultimo mensaje.
      const where: Prisma.WhatsAppMessageWhereInput = search
        ? {
            OR: [
              { chatId: { contains: search, mode: 'insensitive' } },
              { phoneDigits: { contains: search.replace(/\D/g, '') || search } },
              { message: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {};

      // Agrupar por chatId con count y ultimo mensaje (se hace en JS para portabilidad).
      const rows = await prisma.whatsAppMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });

      type ConvBucket = {
        chatId: string;
        phoneDigits: string | null;
        total: number;
        inbound: number;
        outbound: number;
        failed: number;
        lastMessage: string;
        lastDirection: string;
        lastStatus: string;
        lastAt: string;
        firstAt: string;
      };

      const map = new Map<string, ConvBucket>();
      for (const r of rows) {
        // Agrupamos por teléfono cuando está disponible para evitar conversaciones duplicadas
        // del mismo contacto con chatIds distintos (ej: JID vs número limpio).
        const key = (r.phoneDigits || '').trim() || r.chatId;
        const existing = map.get(key);
        if (!existing) {
          const keyIsPhone = looksLikePhoneDigits(key);
          map.set(key, {
            chatId: key,
            phoneDigits: r.phoneDigits || (keyIsPhone ? key : null),
            total: 1,
            inbound: r.direction === 'inbound' ? 1 : 0,
            outbound: r.direction === 'outbound' ? 1 : 0,
            failed: r.status === 'failed' ? 1 : 0,
            lastMessage: r.message,
            lastDirection: r.direction,
            lastStatus: r.status,
            lastAt: r.createdAt.toISOString(),
            firstAt: r.createdAt.toISOString(),
          });
        } else {
          existing.total += 1;
          if (r.direction === 'inbound') existing.inbound += 1;
          else existing.outbound += 1;
          if (r.status === 'failed') existing.failed += 1;
          if (r.createdAt < new Date(existing.firstAt)) {
            existing.firstAt = r.createdAt.toISOString();
          }
        }
      }

      const conversations = Array.from(map.values())
        .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
        .slice(0, limit);

      const totalMessages = await prisma.whatsAppMessage.count();
      const totalInbound = await prisma.whatsAppMessage.count({ where: { direction: 'inbound' } });
      const totalOutbound = await prisma.whatsAppMessage.count({ where: { direction: 'outbound' } });
      const totalFailed = await prisma.whatsAppMessage.count({ where: { status: 'failed' } });

      const since7 = new Date();
      since7.setDate(since7.getDate() - 7);
      const last7Days = await prisma.whatsAppMessage.count({ where: { createdAt: { gte: since7 } } });

      return {
        ok: true,
        kpis: {
          totalMessages,
          totalInbound,
          totalOutbound,
          totalFailed,
          last7Days,
          uniqueChats: map.size,
        },
        conversations,
      };
    }
  );

  fastify.get<{ Params: { chatId: string }; Querystring: { limit?: string } }>(
    '/internal/whatsapp/conversations/:chatId/messages',
    async (request, reply) => {
      const chatId = decodeURIComponent(request.params.chatId || '').trim();
      if (!chatId) return reply.code(400).send({ error: 'chatId requerido' });
      const limit = Math.min(500, Math.max(1, Number(request.query.limit) || 200));
      const isPhoneGroup = /^\d{8,15}$/.test(chatId);

      const messages = await prisma.whatsAppMessage.findMany({
        where: isPhoneGroup
          ? {
              OR: [{ phoneDigits: chatId }, { chatId }],
            }
          : { chatId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      return {
        ok: true,
        chatId,
        count: messages.length,
        messages: messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          message: m.message,
          mediaUrl: m.mediaUrl,
          status: m.status,
          source: m.source,
          externalId: m.externalId,
          errorMessage: m.errorMessage,
          diagnosticId: m.diagnosticId,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    }
  );

  // ============================================
  // Métricas de Conversión (funnel interno del team)
  // ============================================
  fastify.get<{ Querystring: { from?: string; to?: string; landing?: string } }>(
    '/internal/conversion-metrics',
    async (request) => {
      const resolved = resolveConversionRange(request.query);
      // Default "all" = mismo embudo histórico (no altera números actuales).
      const landing: ConversionLandingKey = parseConversionLanding(request.query.landing);
      const landingInfo = landingMeta(landing);
      const { fromDay, toDay } = resolved;
      // Solo Meta: ignora histórico previo al corte → métricas en 0 hasta tráfico nuevo.
      const { from, to, empty: metaRangeEmpty } = effectiveRangeForLanding(
        landing,
        resolved.from,
        resolved.to
      );
      const landingDiagWhere = diagnosticWhereForLanding(landing);
      const diagWhere = { createdAt: { gte: from, lte: to }, ...landingDiagWhere };

      const where = { createdAt: { gte: from, lte: to } };
      const pct = (num: number, den: number): number | null =>
        den > 0 ? Math.round((num / den) * 1000) / 10 : null;

      if (metaRangeEmpty) {
        return {
          ok: true,
          range: { from: fromDay, to: toDay, timezone: 'America/Argentina/Buenos_Aires' },
          landing: {
            key: landing,
            label: landingInfo.label,
            sub: landingInfo.sub,
            metricsSince: META_V1_METRICS_SINCE.toISOString(),
          },
          funnel: {
            homeVisitors: { count: 0, pageViews: 0, source: landing },
            urlSubmitted: { count: 0, pct: null },
            emailLeft: { count: 0, pct: null, pctOfVisitors: null },
            shared: { count: 0, pct: null, byChannel: [] },
            referred: { count: 0, pct: null, byCode: [] },
            unlockClicks: { count: 0, pct: null },
            purchased: { count: 0, pct: null, checkoutAttempts: 0, bySource: [] },
          },
          outreach: {
            emailsSent: 0,
            domainsContacted: 0,
            domainsReturned: 0,
            returnPct: null,
          },
          emailsByReferrer: [],
          sponsorBreakdown: [],
        };
      }

      const [
        pageViewsTotal,
        visitorGroups,
        urlSubmitted,
        emailLeadRows,
        shareGroups,
        referredRows,
        purchases,
        checkoutAttempts,
        sentEmails,
        unlockClickGroups,
      ] = await Promise.all([
        prisma.pageView.count({ where }),
        prisma.pageView.groupBy({
          by: ['visitorId'],
          where: { ...where, visitorId: { not: null } },
        }),
        prisma.publicDiagnostic.count({ where: diagWhere }),
        // Misma fuente que /conversion-metrics/emails (tarjeta = detalle).
        // AND: no pisar el NOT del filtro Home (excluye Meta/ads).
        prisma.publicDiagnostic.findMany({
          where: {
            AND: [diagWhere, { email: { not: null } }, { NOT: { email: '' } }],
          },
          select: { id: true, email: true, refCode: true },
        }),
        prisma.shareEvent.groupBy({ by: ['channel'], where, _count: { _all: true } }),
        prisma.publicDiagnostic.findMany({
          where: { ...diagWhere, refCode: { not: null } },
          select: { refCode: true, sourceChannel: true, email: true, utmMedium: true },
        }),
        // "Compraron" = pagos aprobados en MP (Plan Conquistar one-shot + cargos Premium),
        // no suscripciones pendientes/createdAt. Antes solo contaba Subscription authorized
        // por createdAt → quedaba en 0 con pagos aprobados visibles en /pagos.
        prisma.payment.findMany({
          where: {
            status: 'approved',
            OR: [
              { paidAt: { gte: from, lte: to } },
              { paidAt: null, createdAt: { gte: from, lte: to } },
            ],
          },
          select: {
            amountUsd: true,
            rawPayload: true,
            subscription: {
              select: {
                utmSource: true,
                utmMedium: true,
                utmCampaign: true,
                refCode: true,
                sourceChannel: true,
              },
            },
          },
        }),
        prisma.payment.count({
          where: {
            createdAt: { gte: from, lte: to },
            status: 'pending',
          },
        }),
        prisma.leadEmail.findMany({
          where: { status: 'sent', sentAt: { gte: from, lte: to } },
          select: { leadSource: { select: { competitorDomain: true } } },
        }),
        prisma.unlockClickEvent.groupBy({
          by: ['unlockKey'],
          where,
          _count: { _all: true },
        }),
      ]);

      const emailLeft = emailLeadRows.length;

      // Visitantes:
      // - all  → unión de paths home + landings conocidas (únicos)
      // - home / meta-v1 → paths de esa landing
      // Legacy (antes del beacon home): total de pageviews si el rango es viejo.
      const HOME_TRACKING_START = '2026-08-18';
      const rangeOnHomeTracking = fromDay >= HOME_TRACKING_START;
      const landingPaths = pathsForLanding(landing);
      const visitorPathList: string[] = landingPaths
        ? [...landingPaths]
        : allMarketingPaths();
      const homePathGroups = await prisma.pageView.groupBy({
        by: ['visitorId'],
        where: {
          ...where,
          visitorId: { not: null },
          path: { in: visitorPathList },
        },
      });
      const homePathViews = await prisma.pageView.count({
        where: { ...where, path: { in: visitorPathList } },
      });
      const legacyVisitors = visitorGroups.length > 0 ? visitorGroups.length : pageViewsTotal;
      let homeVisitors: number;
      let homePageViews: number;
      let visitorsSource: string;
      if (landing === 'all') {
        homeVisitors =
          rangeOnHomeTracking && homePathGroups.length > 0
            ? homePathGroups.length
            : legacyVisitors;
        homePageViews =
          rangeOnHomeTracking && homePathViews > 0 ? homePathViews : pageViewsTotal;
        visitorsSource =
          rangeOnHomeTracking && homePathGroups.length > 0 ? 'all_landings' : 'legacy_all_paths';
      } else {
        homeVisitors = homePathGroups.length;
        homePageViews = homePathViews;
        visitorsSource = landing;
      }

      // Share / unlock: en "all" usamos groupBy global; con filtro, solo eventos
      // cuyo diagnosticId pertenece a la landing (utm_campaign).
      let shareByChannel: Array<{ channel: string; count: number }>;
      let sharedTotal: number;
      let unlockClickTotal: number;
      if (landing === 'all') {
        shareByChannel = shareGroups
          .map((g) => ({ channel: g.channel, count: g._count._all }))
          .sort((a, b) => b.count - a.count);
        sharedTotal = shareByChannel.reduce((acc, r) => acc + r.count, 0);
        unlockClickTotal = unlockClickGroups
          .filter((g) => isPlanConquistarUnlockKey(g.unlockKey))
          .reduce((acc, g) => acc + g._count._all, 0);
      } else {
        const [shareRows, unlockRows] = await Promise.all([
          prisma.shareEvent.findMany({
            where,
            select: { channel: true, diagnosticId: true },
          }),
          prisma.unlockClickEvent.findMany({
            where,
            select: { unlockKey: true, diagnosticId: true },
          }),
        ]);
        const relatedIds = [
          ...new Set(
            [...shareRows, ...unlockRows]
              .map((r) => r.diagnosticId)
              .filter((id): id is string => Boolean(id))
          ),
        ];
        const allowedIds = new Set(
          relatedIds.length === 0
            ? []
            : (
                await prisma.publicDiagnostic.findMany({
                  where: { id: { in: relatedIds }, ...landingDiagWhere },
                  select: { id: true },
                })
              ).map((d) => d.id)
        );
        const shareMap = new Map<string, number>();
        for (const s of shareRows) {
          if (!s.diagnosticId || !allowedIds.has(s.diagnosticId)) continue;
          shareMap.set(s.channel, (shareMap.get(s.channel) || 0) + 1);
        }
        shareByChannel = Array.from(shareMap.entries())
          .map(([channel, count]) => ({ channel, count }))
          .sort((a, b) => b.count - a.count);
        sharedTotal = shareByChannel.reduce((acc, r) => acc + r.count, 0);
        unlockClickTotal = unlockRows.filter(
          (u) =>
            isPlanConquistarUnlockKey(u.unlockKey) &&
            u.diagnosticId &&
            allowedIds.has(u.diagnosticId)
        ).length;
      }

      const [emailAggRows, campaignMap] = await Promise.all([
        landing === 'all'
          ? aggregateDiagnosticsByRefCode({ from, to })
          : Promise.resolve(
              (() => {
                // Ranking desde los mismos leads filtrados (tarjeta = detalle).
                const byRef = new Map<
                  string,
                  { emails: Set<string>; withEmail: number }
                >();
                for (const row of emailLeadRows) {
                  const ref = normalizeReferralRefCode(row.refCode);
                  const email = (row.email || '').trim().toLowerCase();
                  if (!email || isPlaceholderDiagnosticEmail(email)) continue;
                  const bucket = byRef.get(ref) || {
                    emails: new Set<string>(),
                    withEmail: 0,
                  };
                  bucket.emails.add(email);
                  bucket.withEmail += 1;
                  byRef.set(ref, bucket);
                }
                return Array.from(byRef.entries()).map(([ref_code, v]) => ({
                  ref_code: ref_code === SIN_REFERIDOR_SLUG ? null : ref_code,
                  diagnostics: v.withEmail,
                  with_email: v.withEmail,
                  unique_emails: v.emails.size,
                  completed: 0,
                  latest_at: null as Date | null,
                }));
              })()
            ),
        loadReferrerCampaignMap(),
      ]);
      const referrerNameByRef = new Map(
        Array.from(campaignMap.entries()).map(([ref, meta]) => [ref, meta.name] as const)
      );

      // Referidos por refCode
      const refMap = new Map<string, number>();
      for (const r of referredRows) {
        const key = (r.refCode || '').trim().toLowerCase() || '—';
        refMap.set(key, (refMap.get(key) || 0) + 1);
      }
      const referredByCode = enrichAndSortReferrerMetrics(
        Array.from(refMap.entries()).map(([refCode, count]) => ({
          refCode,
          visits: count,
          count,
        })),
        campaignMap,
        { limit: 20 }
      ).map((row) => ({
        refCode: row.refCode,
        name: row.name,
        count: row.count,
        isSponsor: row.isSponsor,
        registered: row.registered,
      }));
      const referredTotal = referredRows.length;
      const sponsorBreakdown = buildSponsorChannelBreakdown(referredRows);

      const purchasesFiltered =
        landing === 'all'
          ? purchases
          : purchases.filter((p) =>
              paymentMatchesLanding(
                landing,
                extractPaymentUtmCampaign({
                  subscriptionCampaign: p.subscription?.utmCampaign,
                  rawPayload: p.rawPayload,
                }),
                extractPaymentUtmSource({
                  subscriptionSource: p.subscription?.utmSource,
                  rawPayload: p.rawPayload,
                }),
                extractPaymentUtmMedium({
                  subscriptionMedium: p.subscription?.utmMedium,
                  rawPayload: p.rawPayload,
                })
              )
            );

      // Compras por source (utm_source || ref_code || source_channel || 'directo')
      const purchaseMap = new Map<string, { count: number; usd: number }>();
      for (const p of purchasesFiltered) {
        const raw = (p.rawPayload && typeof p.rawPayload === 'object'
          ? (p.rawPayload as Record<string, unknown>)
          : {}) as Record<string, unknown>;
        const attr = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
        const key =
          attr(p.subscription?.utmSource) ||
          attr(raw.utmSource) ||
          attr(p.subscription?.refCode) ||
          attr(raw.refCode) ||
          attr(p.subscription?.sourceChannel) ||
          attr(raw.sourceChannel) ||
          'directo';
        const prev = purchaseMap.get(key) || { count: 0, usd: 0 };
        prev.count += 1;
        prev.usd += p.amountUsd ? Number(p.amountUsd) : 0;
        purchaseMap.set(key, prev);
      }
      const purchasesBySource = Array.from(purchaseMap.entries())
        .map(([source, v]) => ({ source, count: v.count, usd: Math.round(v.usd) }))
        .sort((a, b) => b.count - a.count);
      const purchasedTotal = purchasesFiltered.length;

      const emailsByReferrer = emailAggRows
        .filter((row) => row.unique_emails > 0)
        .map((row) => {
          const refCode = normalizeReferralRefCode(row.ref_code);
          return {
            refCode,
            name:
              refCode === SIN_REFERIDOR_SLUG
                ? SIN_REFERIDOR_LABEL
                : resolveReferrerDisplayName(refCode, referrerNameByRef.get(refCode), referrerNameByRef),
            uniqueEmails: row.unique_emails,
            diagnosticsWithEmail: row.with_email,
            registered: refCode !== SIN_REFERIDOR_SLUG && campaignMap.has(refCode),
            isSponsor: refCode !== SIN_REFERIDOR_SLUG && isSponsorRef(refCode),
          };
        })
        .sort((a, b) => {
          if (a.refCode === SIN_REFERIDOR_SLUG) return 1;
          if (b.refCode === SIN_REFERIDOR_SLUG) return -1;
          return b.uniqueEmails - a.uniqueEmails;
        });

      // Cold outreach: dominios contactados (email enviado) que luego entraron al diagnóstico.
      // Se mantiene global (no es atribución por landing de ads).
      const contactedDomains = new Set<string>();
      for (const e of sentEmails) {
        const dom = (e.leadSource?.competitorDomain || '').trim().toLowerCase();
        if (dom) contactedDomains.add(dom);
      }
      let returnedDomains = 0;
      if (contactedDomains.size > 0) {
        const matches = await prisma.publicDiagnostic.findMany({
          where: { domain: { in: Array.from(contactedDomains) } },
          select: { domain: true },
          distinct: ['domain'],
        });
        const matchedSet = new Set(matches.map((m) => (m.domain || '').trim().toLowerCase()));
        for (const d of contactedDomains) if (matchedSet.has(d)) returnedDomains += 1;
      }

      return {
        ok: true,
        range: { from: fromDay, to: toDay, timezone: 'America/Argentina/Buenos_Aires' },
        landing: {
          key: landing,
          label: landingInfo.label,
          sub: landingInfo.sub,
          ...(landing === 'meta-v1'
            ? { metricsSince: META_V1_METRICS_SINCE.toISOString() }
            : {}),
        },
        funnel: {
          homeVisitors: {
            count: homeVisitors,
            pageViews: homePageViews,
            source: visitorsSource,
          },
          urlSubmitted: { count: urlSubmitted, pct: pct(urlSubmitted, homeVisitors) },
          emailLeft: {
            count: emailLeft,
            pct: pct(emailLeft, urlSubmitted),
            pctOfVisitors: pct(emailLeft, homeVisitors),
          },
          shared: {
            count: sharedTotal,
            pct: pct(sharedTotal, urlSubmitted),
            byChannel: shareByChannel,
          },
          referred: {
            count: referredTotal,
            pct: pct(referredTotal, urlSubmitted),
            byCode: referredByCode,
          },
          unlockClicks: {
            count: unlockClickTotal,
            pct: pct(unlockClickTotal, emailLeft),
          },
          purchased: {
            count: purchasedTotal,
            pct: pct(purchasedTotal, urlSubmitted),
            checkoutAttempts,
            bySource: purchasesBySource,
          },
        },
        outreach: {
          emailsSent: sentEmails.length,
          domainsContacted: contactedDomains.size,
          domainsReturned: returnedDomains,
          returnPct: pct(returnedDomains, contactedDomains.size),
        },
        emailsByReferrer,
        sponsorBreakdown,
      };
    }
  );

  // Detalle Plan Conquistar: clics por CTA, únicos y dominios interesados.
  fastify.get<{ Querystring: { from?: string; to?: string; landing?: string } }>(
    '/internal/conversion-metrics/unlock-clicks',
    async (request) => {
      const resolved = resolveConversionRange(request.query);
      const landing = parseConversionLanding(request.query.landing);
      const landingDiagWhere = diagnosticWhereForLanding(landing);
      const { from, to, empty: metaRangeEmpty } = effectiveRangeForLanding(
        landing,
        resolved.from,
        resolved.to
      );
      const { fromDay, toDay } = resolved;

      if (metaRangeEmpty) {
        return {
          ok: true,
          range: { from: fromDay, to: toDay, timezone: 'America/Argentina/Buenos_Aires' },
          total: 0,
          totalClicks: 0,
          uniqueVisitors: 0,
          uniqueDomains: 0,
          links: [],
          domains: [],
          clientClicks: [],
          items: [],
        };
      }

      const rows = await prisma.unlockClickEvent.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: {
          unlockKey: true,
          label: true,
          visitorId: true,
          diagnosticId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      let planRows = rows.filter((r) => {
        if (!isPlanConquistarUnlockKey(r.unlockKey)) return false;
        const did = (r.diagnosticId || '').trim();
        if (did.startsWith('probe-')) return false;
        return true;
      });

      if (landing !== 'all') {
        const ids = [
          ...new Set(
            planRows
              .map((r) => (r.diagnosticId || '').trim())
              .filter((id) => Boolean(id))
          ),
        ];
        const allowed = new Set(
          ids.length === 0
            ? []
            : (
                await prisma.publicDiagnostic.findMany({
                  where: { id: { in: ids }, ...landingDiagWhere },
                  select: { id: true },
                })
              ).map((d) => d.id)
        );
        planRows = planRows.filter((r) => {
          const did = (r.diagnosticId || '').trim();
          return did && allowed.has(did);
        });
      }

      const countByKey = new Map<string, number>();
      for (const row of planRows) {
        countByKey.set(row.unlockKey, (countByKey.get(row.unlockKey) || 0) + 1);
      }

      const labelByKey = new Map<string, string>();
      for (const row of planRows) {
        if (!labelByKey.has(row.unlockKey)) {
          labelByKey.set(row.unlockKey, planConquistarUnlockLabel(row.unlockKey, row.label));
        }
      }

      const primaryLinks = PLAN_CONQUISTAR_UNLOCK_LINKS.map((link) => ({
        unlockKey: link.key,
        label: link.label,
        count: countByKey.get(link.key) || 0,
        order: link.order,
      }));

      const extraLinks = Array.from(countByKey.entries())
        .filter(([key]) => !PLAN_CONQUISTAR_UNLOCK_LINKS.some((l) => l.key === key))
        .map(([unlockKey, count]) => ({
          unlockKey,
          label: labelByKey.get(unlockKey) || unlockKey,
          count,
          order: 99,
        }))
        .sort((a, b) => b.count - a.count || a.unlockKey.localeCompare(b.unlockKey));

      const links = [...primaryLinks, ...extraLinks];

      const diagnosticIds = new Set<string>();
      for (const row of planRows) {
        const did = (row.diagnosticId || '').trim();
        if (did) diagnosticIds.add(did);
      }

      const diagnosticMeta =
        diagnosticIds.size > 0
          ? await prisma.publicDiagnostic.findMany({
              where: { id: { in: Array.from(diagnosticIds) } },
              select: { id: true, domain: true, brandName: true, email: true },
            })
          : [];
      const diagnosticById = new Map(diagnosticMeta.map((d) => [d.id, d]));

      // Personas únicas = clientes distintos (diagnóstico), no un browser por cada clic.
      const uniqueClientKeys = new Set<string>();
      for (const row of planRows) {
        const did = (row.diagnosticId || '').trim();
        if (did) {
          uniqueClientKeys.add(`diag:${did}`);
          continue;
        }
        const vid = (row.visitorId || '').trim();
        if (vid) uniqueClientKeys.add(`vid:${vid}`);
      }
      const uniqueVisitors = uniqueClientKeys.size;

      const clientClicks = planRows.map((row) => {
        const did = (row.diagnosticId || '').trim();
        const diag = did ? diagnosticById.get(did) : undefined;
        return {
          diagnosticId: did || null,
          brandName: diag?.brandName?.trim() || null,
          domain: diag?.domain?.trim().toLowerCase() || null,
          email: diag?.email?.trim() || null,
          unlockKey: row.unlockKey,
          ctaLabel: planConquistarUnlockLabel(row.unlockKey, row.label),
          clickedAt: row.createdAt.toISOString(),
        };
      });

      type DomainAgg = {
        domain: string;
        brandName: string | null;
        clicks: number;
        lastClickAt: string;
      };
      const domainAgg = new Map<string, DomainAgg>();

      const siteKeys = new Set<string>();

      for (const row of planRows) {
        const did = (row.diagnosticId || '').trim();
        if (!did) continue;
        const diag = diagnosticById.get(did);
        const domain = (diag?.domain || '').trim().toLowerCase();
        const brandName = diag?.brandName?.trim() || null;
        if (domain) {
          siteKeys.add(domain);
          const prev = domainAgg.get(domain);
          const at = row.createdAt.toISOString();
          if (!prev) {
            domainAgg.set(domain, {
              domain,
              brandName,
              clicks: 1,
              lastClickAt: at,
            });
          } else {
            prev.clicks += 1;
            if (at > prev.lastClickAt) prev.lastClickAt = at;
            if (!prev.brandName && brandName) prev.brandName = brandName;
          }
        } else if (brandName) {
          const brandKey = `__brand__:${brandName.toLowerCase()}`;
          siteKeys.add(brandKey);
          const prev = domainAgg.get(brandKey);
          const at = row.createdAt.toISOString();
          if (!prev) {
            domainAgg.set(brandKey, {
              domain: brandName,
              brandName,
              clicks: 1,
              lastClickAt: at,
            });
          } else {
            prev.clicks += 1;
            if (at > prev.lastClickAt) prev.lastClickAt = at;
          }
        } else {
          siteKeys.add(`diag:${did}`);
        }
      }

      const domains = Array.from(domainAgg.values()).sort((a, b) => {
        if (b.clicks !== a.clicks) return b.clicks - a.clicks;
        return a.domain.localeCompare(b.domain);
      });

      const totalClicks = planRows.length;

      return {
        ok: true,
        range: { from: fromDay, to: toDay, timezone: 'America/Argentina/Buenos_Aires' },
        total: totalClicks,
        totalClicks,
        uniqueVisitors,
        uniqueDomains: siteKeys.size,
        links,
        domains,
        clientClicks,
        // Compat modal viejo
        items: links.map(({ unlockKey, label, count }) => ({ unlockKey, label, count })),
      };
    }
  );

  // Detalle de leads que dejaron email (para el drilldown de "Dejaron email").
  fastify.get<{ Querystring: { from?: string; to?: string; landing?: string } }>(
    '/internal/conversion-metrics/emails',
    async (request) => {
      const resolved = resolveConversionRange(request.query);
      const landing = parseConversionLanding(request.query.landing);
      const landingDiagWhere = diagnosticWhereForLanding(landing);
      const { from, to, empty: metaRangeEmpty } = effectiveRangeForLanding(
        landing,
        resolved.from,
        resolved.to
      );
      const { fromDay, toDay } = resolved;

      if (metaRangeEmpty) {
        return {
          ok: true,
          range: { from: fromDay, to: toDay, timezone: 'America/Argentina/Buenos_Aires' },
          landing: { key: landing },
          total: 0,
          items: [],
        };
      }

      const rows = await prisma.publicDiagnostic.findMany({
        where: {
          AND: [
            { createdAt: { gte: from, lte: to } },
            landingDiagWhere,
            { email: { not: null } },
            { NOT: { email: '' } },
          ],
        },
        select: {
          id: true,
          email: true,
          brandName: true,
          domain: true,
          industry: true,
          sourceChannel: true,
          refCode: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          tier: true,
          status: true,
          shareSlug: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      return {
        ok: true,
        range: { from: fromDay, to: toDay, timezone: 'America/Argentina/Buenos_Aires' },
        landing: { key: landing },
        total: rows.length,
        items: rows,
      };
    }
  );

  /**
   * Embudo de negocio (admin Funnel).
   * Cohortes de compra: diagnostic.createdAt → Payment Plan Conquistar approved por email.
   * CAC / LTV / Payback: adSpend vía query (Meta manual); sin dato → 0.
   */
  fastify.get<{ Querystring: { from?: string; to?: string; adSpendUsd?: string } }>(
    '/internal/funnel-metrics',
    async (request) => {
      const { from, to, fromDay, toDay } = resolveConversionRange(request.query);
      const where = { createdAt: { gte: from, lte: to } };
      const pct = (num: number, den: number): number | null =>
        den > 0 ? Math.round((num / den) * 1000) / 10 : null;

      const adSpendRaw = Number(request.query.adSpendUsd);
      const adSpendUsd =
        Number.isFinite(adSpendRaw) && adSpendRaw >= 0 ? adSpendRaw : 0;

      const MS_DAY = 24 * 60 * 60 * 1000;
      const WINDOWS = [
        { key: 'h24' as const, label: 'Compra 24 h', ms: MS_DAY },
        { key: 'd30' as const, label: 'Compra 30 días', ms: 30 * MS_DAY },
        { key: 'd60' as const, label: 'Compra 60 días', ms: 60 * MS_DAY },
        { key: 'd90' as const, label: 'Compra 90 días', ms: 90 * MS_DAY },
      ];

      const isPlanConquistarRaw = (raw: unknown): boolean => {
        if (!raw || typeof raw !== 'object') return false;
        const obj = raw as Record<string, unknown>;
        if (obj.product === 'plan_conquistar_90d') return true;
        const meta = obj.metadata;
        if (meta && typeof meta === 'object' && (meta as { product?: string }).product === 'plan_conquistar_90d') {
          return true;
        }
        const payment = obj.payment;
        if (payment && typeof payment === 'object') {
          const p = payment as { metadata?: { product?: string } };
          if (p.metadata?.product === 'plan_conquistar_90d') return true;
        }
        return false;
      };

      const [
        pageViewsTotal,
        visitorGroups,
        diagnosticsStarted,
        diagnosticsCompleted,
        emailDiagRows,
        shareGroups,
        allPayments,
        emailAggRows,
        campaignMap,
      ] = await Promise.all([
        prisma.pageView.count({ where }),
        prisma.pageView.groupBy({
          by: ['visitorId'],
          where: { ...where, visitorId: { not: null } },
        }),
        prisma.publicDiagnostic.count({ where }),
        prisma.publicDiagnostic.count({ where: { ...where, status: 'completed' } }),
        prisma.publicDiagnostic.findMany({
          where: {
            ...where,
            email: { not: null },
            NOT: { email: '' },
          },
          select: {
            id: true,
            email: true,
            createdAt: true,
            refCode: true,
            utmSource: true,
            utmCampaign: true,
            status: true,
          },
        }),
        prisma.shareEvent.groupBy({ by: ['channel'], where, _count: { _all: true } }),
        prisma.payment.findMany({
          where: {
            status: 'approved',
            OR: [{ paidAt: { gte: from } }, { paidAt: null, createdAt: { gte: from } }],
          },
          select: {
            id: true,
            payerEmail: true,
            paidAt: true,
            createdAt: true,
            amountUsd: true,
            amountArs: true,
            rawPayload: true,
          },
          take: 8000,
          orderBy: { createdAt: 'desc' },
        }),
        aggregateDiagnosticsByRefCode({ from, to }),
        loadReferrerCampaignMap(),
      ]);

      const visitorsFromHome = await prisma.pageView.groupBy({
        by: ['visitorId'],
        where: {
          ...where,
          visitorId: { not: null },
          path: { in: ['/', '/home', '/inicio'] },
        },
      });
      const visitors =
        visitorsFromHome.length > 0
          ? visitorsFromHome.length
          : visitorGroups.length > 0
            ? visitorGroups.length
            : pageViewsTotal;

      const emailRows = emailDiagRows.filter((r) => !isPlaceholderDiagnosticEmail(r.email));
      const emailsCaptured = emailRows.length;

      const shareByChannel = shareGroups
        .map((g) => ({ channel: g.channel, count: g._count._all }))
        .sort((a, b) => b.count - a.count);
      const shares = shareByChannel.reduce((acc, r) => acc + r.count, 0);

      const pcPayments = allPayments
        .filter((p) => isPlanConquistarRaw(p.rawPayload))
        .map((p) => ({
          email: (p.payerEmail || '').trim().toLowerCase(),
          paidAt: (p.paidAt ?? p.createdAt).getTime(),
          amountUsd: p.amountUsd != null ? Number(p.amountUsd) : null,
        }))
        .filter((p) => Boolean(p.email));

      // Una fila por email: el diagnóstico más reciente del rango (para cohorte).
      const byEmail = new Map<string, { createdAt: number; refCode: string | null }>();
      for (const row of emailRows) {
        const email = (row.email || '').trim().toLowerCase();
        if (!email) continue;
        const ts = row.createdAt.getTime();
        const prev = byEmail.get(email);
        if (!prev || ts > prev.createdAt) {
          byEmail.set(email, {
            createdAt: ts,
            refCode: row.refCode?.trim().toLowerCase() || null,
          });
        }
      }
      const eligible = byEmail.size;

      const cohortCounts: Record<(typeof WINDOWS)[number]['key'], number> = {
        h24: 0,
        d30: 0,
        d60: 0,
        d90: 0,
      };
      let revenueUsd = 0;
      let payingCustomers = 0;

      for (const [email, diag] of byEmail) {
        const purchases = pcPayments
          .filter((p) => p.email === email && p.paidAt >= diag.createdAt)
          .sort((a, b) => a.paidAt - b.paidAt);
        if (purchases.length === 0) continue;
        const first = purchases[0]!;
        const delta = first.paidAt - diag.createdAt;
        for (const w of WINDOWS) {
          if (delta <= w.ms) cohortCounts[w.key] += 1;
        }
        payingCustomers += 1;
        if (first.amountUsd != null && Number.isFinite(first.amountUsd)) {
          revenueUsd += first.amountUsd;
        }
      }

      const ltvUsd =
        payingCustomers > 0 ? Math.round((revenueUsd / payingCustomers) * 100) / 100 : 0;
      const cacUsd =
        payingCustomers > 0 && adSpendUsd > 0
          ? Math.round((adSpendUsd / payingCustomers) * 100) / 100
          : 0;
      // Payback simplificado: días para recuperar CAC con LTV del plan (asumiendo ingreso único PC).
      // Si LTV ≈ precio one-shot, payback ≈ 0 días post-compra; mostramos CAC/LTV * 30 como proxy mensual o 0.
      const paybackDays =
        cacUsd > 0 && ltvUsd > 0 ? Math.round((cacUsd / ltvUsd) * 30) : 0;

      const byReferrer = enrichAndSortReferrerMetrics(
        emailAggRows.map((r) => {
          const ref = normalizeReferralRefCode(r.ref_code);
          return {
            refCode: ref === SIN_REFERIDOR_SLUG ? SIN_REFERIDOR_SLUG : ref,
            visits: r.diagnostics,
            diagnostics: r.diagnostics,
            withEmail: r.with_email,
            uniqueEmails: r.unique_emails,
            completed: r.completed,
          };
        }),
        campaignMap,
        { limit: 25 }
      ).map((row) => ({
        refCode: row.refCode,
        name: row.refCode === SIN_REFERIDOR_SLUG ? SIN_REFERIDOR_LABEL : row.name,
        diagnostics: row.diagnostics,
        withEmail: row.withEmail,
        uniqueEmails: row.uniqueEmails,
        completed: row.completed,
        isSponsor: row.isSponsor,
        registered: row.registered,
      }));

      const step = (count: number, den: number) => ({
        count,
        pct: pct(count, den),
      });

      return {
        ok: true,
        range: { from: fromDay, to: toDay, timezone: 'America/Argentina/Buenos_Aires' },
        notes: {
          purchaseLinkage: 'email_proxy',
          purchaseLinkageDetail:
            'Compra↔diagnóstico se une por email (Payment.payerEmail = PublicDiagnostic.email). No hay FK durable aún.',
          cacSource: adSpendUsd > 0 ? 'manual_ad_spend' : 'pending_meta_ads',
          ltvSource: payingCustomers > 0 ? 'avg_plan_conquistar_revenue' : 'pending_renewals',
          paybackSource: cacUsd > 0 && ltvUsd > 0 ? 'cac_over_ltv_x30' : 'pending',
        },
        funnel: {
          visitors: { count: visitors, pageViews: pageViewsTotal },
          diagnosticsStarted: step(diagnosticsStarted, visitors),
          diagnosticsCompleted: step(diagnosticsCompleted, diagnosticsStarted || visitors),
          emailsCaptured: step(emailsCaptured, diagnosticsCompleted || diagnosticsStarted || visitors),
          shares: {
            ...step(shares, emailsCaptured || diagnosticsCompleted || visitors),
            byChannel: shareByChannel,
          },
          purchaseH24: step(cohortCounts.h24, eligible || emailsCaptured),
          purchaseD30: step(cohortCounts.d30, eligible || emailsCaptured),
          purchaseD60: step(cohortCounts.d60, eligible || emailsCaptured),
          purchaseD90: step(cohortCounts.d90, eligible || emailsCaptured),
        },
        cohorts: {
          eligible,
          linkage: 'email_proxy' as const,
          windows: Object.fromEntries(
            WINDOWS.map((w) => [
              w.key,
              {
                label: w.label,
                eligible,
                converted: cohortCounts[w.key],
                rate: pct(cohortCounts[w.key], eligible),
              },
            ])
          ),
        },
        economics: {
          adSpendUsd,
          payingCustomers,
          revenueUsd: Math.round(revenueUsd * 100) / 100,
          cacUsd,
          ltvUsd,
          paybackDays,
        },
        byReferrer,
      };
    }
  );

  // ----------------------------------------------------------------
  // Plan Conquistar (AI Visibility Accelerator) — generado desde admin
  // ----------------------------------------------------------------

  // Lista de corridas para elegir el cliente desde el panel admin.
  fastify.get<{ Querystring: { q?: string; limit?: string } }>(
    '/internal/plan-conquistar/runs',
    async (request) => {
      const q = (request.query.q || '').trim();
      const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);

      const and: Prisma.RunWhereInput[] = [
        { promptResults: { some: {} } },
        primaryRunWhere(),
      ];
      if (q) {
        and.push({
          brand: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { domain: { contains: q, mode: 'insensitive' } },
            ],
          },
        });
      }
      const where: Prisma.RunWhereInput = { AND: and };

      const runs = await prisma.run.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          status: true,
          runType: true,
          createdAt: true,
          brand: { select: { name: true, domain: true } },
          _count: { select: { promptResults: true } },
        },
      });

      return {
        ok: true,
        items: runs.map((r) => ({
          id: r.id,
          status: r.status,
          runType: r.runType,
          createdAt: r.createdAt,
          brandName: r.brand?.name ?? 'Sin marca',
          domain: r.brand?.domain ?? null,
          prompts: r._count.promptResults,
        })),
      };
    }
  );

  // Detalle de una corrida (misma forma que el endpoint del portal, sin chequeo de tenant).
  fastify.get<{ Params: { id: string } }>(
    '/internal/plan-conquistar/runs/:id',
    async (request, reply) => {
      const idParsed = z.object({ id: z.string().uuid() }).safeParse({ id: request.params.id });
      if (!idParsed.success) return reply.code(400).send({ error: 'ID inválido.' });

      const run = await prisma.run.findUnique({
        where: { id: idParsed.data.id },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              domain: true,
              tenantId: true,
              industry: true,
              productType: true,
              competitors: { select: { id: true, name: true, domain: true } },
              aliases: { select: { id: true, alias: true } },
            },
          },
          promptResults: { include: { prompt: { include: { category: true } } }, orderBy: { createdAt: 'asc' } },
          priaReports: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!run) return reply.code(404).send({ error: 'Reporte no encontrado.' });
      return run;
    }
  );

  // Estado + score por motor de la corrida (ChatGPT del run padre + auxiliares).
  fastify.get<{ Params: { id: string } }>(
    '/internal/plan-conquistar/runs/:id/engines',
    async (request, reply) => {
      const idParsed = z.object({ id: z.string().uuid() }).safeParse({ id: request.params.id });
      if (!idParsed.success) return reply.code(400).send({ error: 'ID inválido.' });

      const parent = await prisma.run.findUnique({
        where: { id: idParsed.data.id },
        select: {
          id: true,
          status: true,
          modelMeta: true,
          priaReports: { orderBy: { createdAt: 'desc' }, take: 1, select: { priaTotal: true } },
        },
      });
      if (!parent) return reply.code(404).send({ error: 'Reporte no encontrado.' });

      const scoreOf = (priaReports: Array<{ priaTotal: number }>) =>
        priaReports[0] ? Math.round(priaReports[0].priaTotal) : null;

      const engineRuns = planConquistarReadEngineRuns(parent.modelMeta);
      const engineEntries = await Promise.all(
        planConquistarAvailableEngines().map(async (engine) => {
          const subRunId = engineRuns[engine];
          if (!subRunId) return { engine, status: 'not_started' as const, score: null };
          const subRun = await prisma.run.findUnique({
            where: { id: subRunId },
            select: {
              status: true,
              priaReports: { orderBy: { createdAt: 'desc' }, take: 1, select: { priaTotal: true } },
            },
          });
          if (!subRun) return { engine, status: 'not_started' as const, score: null };
          return { engine, status: subRun.status, score: scoreOf(subRun.priaReports) };
        })
      );

      return {
        ok: true,
        chatgpt: { status: parent.status, score: scoreOf(parent.priaReports) },
        engines: engineEntries,
        configured: { gemini: planConquistarGeminiConfigured(), openrouter: isOpenRouterConfigured() },
      };
    }
  );

  // Genera el score real por motor (Gemini / Perplexity / Claude) en background.
  fastify.post<{ Params: { id: string }; Body: { engines?: string[] } }>(
    '/internal/plan-conquistar/runs/:id/engines',
    async (request, reply) => {
      const idParsed = z.object({ id: z.string().uuid() }).safeParse({ id: request.params.id });
      if (!idParsed.success) return reply.code(400).send({ error: 'ID inválido.' });

      const parent = await prisma.run.findUnique({
        where: { id: idParsed.data.id },
        select: { id: true, tenantId: true, brandId: true, periodStart: true, periodEnd: true, modelMeta: true },
      });
      if (!parent) return reply.code(404).send({ error: 'Reporte no encontrado.' });

      const available = planConquistarAvailableEngines();
      if (available.length === 0) {
        return reply.code(503).send({
          ok: false,
          error: 'No hay motores extra configurados en el servidor (Gemini / OpenRouter).',
        });
      }

      const requested = Array.isArray(request.body?.engines) ? request.body.engines : null;
      const engines = requested ? available.filter((e) => requested.includes(e)) : available;
      if (engines.length === 0) {
        return reply.code(400).send({ ok: false, error: 'Ninguno de los motores solicitados está disponible.' });
      }

      const promptVersionId = planConquistarReadPromptVersionId(parent.modelMeta);
      const existingMap = planConquistarReadEngineRuns(parent.modelMeta);
      const engineRuns: Partial<Record<PlanConquistarEngineKey, string>> = { ...existingMap };
      const started: PlanConquistarEngineKey[] = [];

      for (const engine of engines) {
        const existingId = existingMap[engine];
        if (existingId) {
          const existingRun = await prisma.run.findUnique({
            where: { id: existingId },
            select: { status: true },
          });
          if (existingRun && existingRun.status !== 'failed') continue;
        }

        const subRun = await prisma.run.create({
          data: {
            tenantId: parent.tenantId,
            brandId: parent.brandId,
            periodStart: parent.periodStart,
            periodEnd: parent.periodEnd,
            runType: `engine_${engine}`,
            status: 'pending',
          },
        });
        engineRuns[engine] = subRun.id;
        started.push(engine);

        const executor = planConquistarExecutorForEngine(engine);
        setImmediate(async () => {
          try {
            await executor(subRun.id, promptVersionId ? { promptVersionId } : {});
          } catch (err) {
            request.log.error({ err, subRunId: subRun.id, engine }, 'plan-conquistar engine sub-run failed');
            await prisma.run.update({ where: { id: subRun.id }, data: { status: 'failed' } }).catch(() => {});
          }
        });
      }

      const baseMeta =
        parent.modelMeta && typeof parent.modelMeta === 'object' && !Array.isArray(parent.modelMeta)
          ? (parent.modelMeta as Record<string, unknown>)
          : {};
      await prisma.run.update({
        where: { id: parent.id },
        data: { modelMeta: { ...baseMeta, engineRuns } as unknown as Prisma.InputJsonValue },
      });

      return { ok: true, started, engines: Object.keys(engineRuns) };
    }
  );

  // Contexto del diagnóstico público vinculado (AEO satélite + tendencia + DR Ahrefs), si existe.
  fastify.get<{ Params: { id: string } }>(
    '/internal/plan-conquistar/runs/:id/context',
    async (request, reply) => {
      const idParsed = z.object({ id: z.string().uuid() }).safeParse({ id: request.params.id });
      if (!idParsed.success) return reply.code(400).send({ error: 'ID inválido.' });

      const runId = idParsed.data.id;

      const run = await prisma.run.findUnique({
        where: { id: runId },
        select: {
          brand: {
            select: {
              name: true,
              domain: true,
              competitors: { select: { name: true, domain: true } },
            },
          },
        },
      });

      let diagnostic = await prisma.publicDiagnostic.findFirst({
        where: {
          OR: [
            { runId },
            { runGeminiId: runId },
            { runPerplexityId: runId },
            { runClaudeId: runId },
          ],
        },
        select: {
          id: true,
          domain: true,
          brandName: true,
          status: true,
          runId: true,
        },
      });

      const brandDomain = diagnostic?.domain ?? run?.brand?.domain ?? '';
      if (!diagnostic && brandDomain) {
        diagnostic = await prisma.publicDiagnostic.findFirst({
          where: { domain: brandDomain, status: 'completed' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            domain: true,
            brandName: true,
            status: true,
            runId: true,
          },
        });
      }

      if (!diagnostic && !run) {
        return { ok: true, diagnostic: null, satelliteModule: null, trendData: [], domainRating: null };
      }

      let analysisJson: unknown = null;
      if (diagnostic?.status === 'completed') {
        const jsonRow = await prisma.publicDiagnostic.findUnique({
          where: { id: diagnostic.id },
          select: { analysisJson: true },
        });
        analysisJson = jsonRow?.analysisJson ?? null;
      }

      const satelliteModule = analysisJson
        ? planConquistarExtractSatelliteModule(analysisJson)
        : null;

      let trendData: Array<{ label: string; score: number; date: string }> = [];
      if (diagnostic?.status === 'completed' && diagnostic.domain) {
        const lastDiagnostics = await prisma.publicDiagnostic.findMany({
          where: { domain: diagnostic.domain, status: 'completed', runId: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { id: true, runId: true, createdAt: true },
        });
        const runIds = lastDiagnostics.map((d) => d.runId).filter(Boolean) as string[];
        if (runIds.length > 0) {
          const runs = await prisma.run.findMany({
            where: { id: { in: runIds }, ...primaryRunWhere() },
            include: { priaReports: { take: 1, orderBy: { createdAt: 'desc' } } },
          });
          const scoreByRunId = new Map<string, number>();
          for (const r of runs) {
            const score = r.priaReports[0]?.priaTotal;
            if (score != null) scoreByRunId.set(r.id, score);
          }
          const chronological = [...lastDiagnostics].reverse();
          trendData = chronological
            .filter((d) => d.runId && scoreByRunId.has(d.runId))
            .map((d, idx) => ({
              label: `Corrida ${idx + 1}`,
              score: scoreByRunId.get(d.runId!) ?? 0,
              date: d.createdAt.toISOString(),
            }));
        }
      }

      const brandName = diagnostic?.brandName ?? run?.brand?.name ?? 'Marca';
      const competitorsForDr =
        run?.brand?.competitors?.map((c) => ({ name: c.name, domain: c.domain ?? null })) ?? [];

      let domainRating = null;
      if (brandDomain && !brandDomain.startsWith('brand-')) {
        try {
          domainRating = await buildDomainRatingSnapshot({
            brandName,
            brandDomain,
            competitors: competitorsForDr,
            includeCompetitors: true,
          });
        } catch {
          domainRating = null;
        }
      }

      return {
        ok: true,
        diagnostic: diagnostic
          ? {
              id: diagnostic.id,
              domain: diagnostic.domain,
              brandName: diagnostic.brandName,
              primaryRunId: diagnostic.runId,
            }
          : null,
        satelliteModule,
        trendData,
        domainRating,
      };
    }
  );
};

export default adminReportsRoutes;
