import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { Prisma, type RunSchedule } from '@prisma/client';
import { prisma } from '../lib/prisma';

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
}

type AnalysisOpenAI = {
  resumenEjecutivo?: string;
  sugerencias?: string[];
  fortalezas?: string[];
  debilidades?: string[];
  comentariosPorIntencion?: Array<{
    intencion?: string;
    comentario?: string;
    score?: number;
    interpretacion?: string;
  }>;
};

type AnalysisRoot = {
  metrics?: {
    cleexsScore?: number;
    comparisonSummary?: Array<{
      name?: string;
      type?: string;
      share?: number;
      appearances?: number;
    }>;
  };
  analisisOpenAI?: AnalysisOpenAI;
  cleexsScore?: number;
};

export type PortalSettings = {
  modules: {
    dashboard: boolean;
    sov: boolean;
    oportunidades: boolean;
    contenido: boolean;
    outreach: boolean;
    auditoria: boolean;
    email: boolean;
    funnelEcommerce: boolean;
  };
  alerts: {
    contactEmail: string;
    contactName: string;
    scoreDrop: boolean;
    weeklyDigest: boolean;
    newOpportunity: boolean;
  };
  integrations: {
    wordpress: { enabled: boolean; url: string };
    ga4: { enabled: boolean };
    gsc: { enabled: boolean };
    shopify: { enabled: boolean };
    resend: { enabled: boolean };
  };
  notes: string;
};

const RUN_SCHEDULES = new Set<RunSchedule>(['semanal', 'quincenal', 'mensual']);

export function defaultPortalSettings(partial?: Partial<PortalSettings> | null): PortalSettings {
  const p = partial || {};
  return {
    modules: {
      dashboard: p.modules?.dashboard ?? true,
      sov: p.modules?.sov ?? true,
      oportunidades: p.modules?.oportunidades ?? true,
      contenido: p.modules?.contenido ?? true,
      outreach: p.modules?.outreach ?? true,
      auditoria: p.modules?.auditoria ?? true,
      email: p.modules?.email ?? false,
      funnelEcommerce: p.modules?.funnelEcommerce ?? false,
    },
    alerts: {
      contactEmail: p.alerts?.contactEmail ?? '',
      contactName: p.alerts?.contactName ?? '',
      scoreDrop: p.alerts?.scoreDrop ?? true,
      weeklyDigest: p.alerts?.weeklyDigest ?? true,
      newOpportunity: p.alerts?.newOpportunity ?? true,
    },
    integrations: {
      wordpress: {
        enabled: p.integrations?.wordpress?.enabled ?? false,
        url: p.integrations?.wordpress?.url ?? '',
      },
      ga4: { enabled: p.integrations?.ga4?.enabled ?? false },
      gsc: { enabled: p.integrations?.gsc?.enabled ?? false },
      shopify: { enabled: p.integrations?.shopify?.enabled ?? false },
      resend: { enabled: p.integrations?.resend?.enabled ?? false },
    },
    notes: p.notes ?? '',
  };
}

function parseSettings(raw: unknown): PortalSettings {
  if (!raw || typeof raw !== 'object') return defaultPortalSettings();
  return defaultPortalSettings(raw as Partial<PortalSettings>);
}

async function loadBrandByDomain(domain: string) {
  return prisma.brand.findFirst({
    where: { domain },
    select: {
      id: true,
      name: true,
      domain: true,
      industry: true,
      country: true,
      description: true,
      objective: true,
      runSchedule: true,
      portalSettings: true,
      tenantId: true,
      competitors: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, domain: true, validated: true, autoDetected: true },
      },
      aliases: {
        orderBy: { alias: 'asc' },
        select: { id: true, alias: true },
      },
    },
  });
}

/**
 * Snapshot + config para portal de marca.
 * GET  /api/admin/brand-portal/:domain
 * PATCH /api/admin/brand-portal/:domain
 */
const adminBrandPortalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { domain: string } }>('/brand-portal/:domain', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const domain = normalizeDomain(request.params.domain || '');
    if (!domain || domain.length < 3) {
      return reply.code(400).send({ error: 'Dominio inválido' });
    }

    const brand = await loadBrandByDomain(domain);

    const diagnostic = await prisma.publicDiagnostic.findFirst({
      where: {
        domain,
        status: 'completed',
        analysisJson: { not: null as unknown as object },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        brandName: true,
        domain: true,
        status: true,
        tier: true,
        updatedAt: true,
        shareSlug: true,
        analysisJson: true,
        runId: true,
      },
    });

    const pria = brand
      ? await prisma.pRIAReport.findFirst({
          where: { brandId: brand.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, priaTotal: true, createdAt: true, runId: true },
        })
      : null;

    const analysis = (diagnostic?.analysisJson || null) as AnalysisRoot | null;
    const openai = analysis?.analisisOpenAI;
    const comparison = analysis?.metrics?.comparisonSummary ?? [];
    const scoreRaw =
      analysis?.metrics?.cleexsScore ?? analysis?.cleexsScore ?? pria?.priaTotal ?? null;
    const score = typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? Math.round(scoreRaw) : null;

    const brandRow = comparison.find(
      (c) => c.type === 'brand' || c.name?.toLowerCase() === brand?.name.toLowerCase(),
    );

    const totalAppearances = comparison.reduce((acc, c) => acc + (c.appearances ?? 0), 0);
    const brandAppearances = brandRow?.appearances ?? 0;
    const sovPct =
      totalAppearances > 0
        ? Math.round((brandAppearances / totalAppearances) * 1000) / 10
        : brandRow?.share != null
          ? Math.round(brandRow.share * 10) / 10
          : null;

    const settings = parseSettings(brand?.portalSettings);

    return {
      ok: true,
      domain,
      brand: brand
        ? {
            id: brand.id,
            name: brand.name,
            domain: brand.domain,
            industry: brand.industry,
            country: brand.country,
            description: brand.description,
            objective: brand.objective,
            runSchedule: brand.runSchedule,
          }
        : diagnostic
          ? {
              id: null,
              name: diagnostic.brandName,
              domain: diagnostic.domain,
              industry: null,
              country: null,
              description: null,
              objective: null,
              runSchedule: null,
            }
          : null,
      competitors: brand?.competitors ?? [],
      aliases: brand?.aliases ?? [],
      settings,
      score: {
        cleexsScore: score,
        priaTotal: pria?.priaTotal != null ? Math.round(pria.priaTotal) : null,
        source: diagnostic ? 'public_diagnostic' : pria ? 'pria_report' : null,
        updatedAt: diagnostic?.updatedAt?.toISOString() ?? pria?.createdAt?.toISOString() ?? null,
        diagnosticId: diagnostic?.id ?? null,
        shareSlug: diagnostic?.shareSlug ?? null,
        runId: diagnostic?.runId ?? pria?.runId ?? null,
      },
      shareOfVoice: {
        percent: sovPct,
        brandShare: brandRow?.share ?? null,
        brandAppearances,
        totalAppearances,
        comparison: comparison.map((c) => ({
          name: c.name ?? '—',
          type: c.type ?? 'unknown',
          share: c.share != null ? Math.round(c.share * 10) / 10 : null,
          appearances: c.appearances ?? null,
        })),
      },
      insights: {
        resumenEjecutivo: openai?.resumenEjecutivo?.trim() || null,
        fortalezas: openai?.fortalezas ?? [],
        debilidades: openai?.debilidades ?? [],
        sugerencias: openai?.sugerencias ?? [],
        intenciones: (openai?.comentariosPorIntencion ?? []).map((i) => ({
          intencion: i.intencion ?? '—',
          score: i.score ?? null,
          comentario: i.comentario ?? null,
        })),
      },
      modules: {
        ...settings.modules,
        score: Boolean(score != null),
        shareOfVoice: comparison.length > 0,
        insights: Boolean(openai?.resumenEjecutivo || (openai?.sugerencias?.length ?? 0) > 0),
        shopify: settings.integrations.shopify.enabled,
        emailSequenceBrand: settings.modules.email,
        referralsBrand: false,
      },
    };
  });

  fastify.patch<{
    Params: { domain: string };
    Body: {
      brand?: {
        name?: string;
        industry?: string | null;
        country?: string | null;
        description?: string | null;
        objective?: string | null;
        runSchedule?: RunSchedule | null;
      };
      competitors?: Array<{ name: string; domain?: string | null }>;
      settings?: Partial<PortalSettings>;
    };
  }>('/brand-portal/:domain', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const domain = normalizeDomain(request.params.domain || '');
    if (!domain || domain.length < 3) {
      return reply.code(400).send({ error: 'Dominio inválido' });
    }

    const existing = await loadBrandByDomain(domain);
    if (!existing) {
      return reply.code(404).send({
        error: 'No hay Brand con ese dominio. Primero debe existir en Cleexs.',
      });
    }

    const body = request.body || {};
    const brandPatch = body.brand || {};
    const nextSettings = body.settings
      ? defaultPortalSettings({
          ...parseSettings(existing.portalSettings),
          ...body.settings,
          modules: { ...parseSettings(existing.portalSettings).modules, ...body.settings.modules },
          alerts: { ...parseSettings(existing.portalSettings).alerts, ...body.settings.alerts },
          integrations: {
            ...parseSettings(existing.portalSettings).integrations,
            ...body.settings.integrations,
            wordpress: {
              ...parseSettings(existing.portalSettings).integrations.wordpress,
              ...body.settings.integrations?.wordpress,
            },
            ga4: {
              ...parseSettings(existing.portalSettings).integrations.ga4,
              ...body.settings.integrations?.ga4,
            },
            gsc: {
              ...parseSettings(existing.portalSettings).integrations.gsc,
              ...body.settings.integrations?.gsc,
            },
            shopify: {
              ...parseSettings(existing.portalSettings).integrations.shopify,
              ...body.settings.integrations?.shopify,
            },
            resend: {
              ...parseSettings(existing.portalSettings).integrations.resend,
              ...body.settings.integrations?.resend,
            },
          },
        })
      : null;

    if (brandPatch.runSchedule != null && !RUN_SCHEDULES.has(brandPatch.runSchedule)) {
      return reply.code(400).send({ error: 'runSchedule inválido (semanal|quincenal|mensual)' });
    }

    const competitors = body.competitors;
    if (competitors) {
      if (!Array.isArray(competitors)) {
        return reply.code(400).send({ error: 'competitors debe ser un array' });
      }
      if (competitors.length > 20) {
        return reply.code(400).send({ error: 'Máximo 20 competidores' });
      }
      for (const c of competitors) {
        if (!c?.name || typeof c.name !== 'string' || c.name.trim().length < 2) {
          return reply.code(400).send({ error: 'Cada competidor necesita name (≥2 chars)' });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.brand.update({
        where: { id: existing.id },
        data: {
          ...(brandPatch.name != null ? { name: String(brandPatch.name).trim().slice(0, 120) } : {}),
          ...(brandPatch.industry !== undefined
            ? { industry: brandPatch.industry ? String(brandPatch.industry).trim().slice(0, 160) : null }
            : {}),
          ...(brandPatch.country !== undefined
            ? { country: brandPatch.country ? String(brandPatch.country).trim().slice(0, 80) : null }
            : {}),
          ...(brandPatch.description !== undefined
            ? {
                description: brandPatch.description
                  ? String(brandPatch.description).trim().slice(0, 4000)
                  : null,
              }
            : {}),
          ...(brandPatch.objective !== undefined
            ? {
                objective: brandPatch.objective
                  ? String(brandPatch.objective).trim().slice(0, 500)
                  : null,
              }
            : {}),
          ...(brandPatch.runSchedule !== undefined ? { runSchedule: brandPatch.runSchedule } : {}),
          ...(nextSettings
            ? { portalSettings: nextSettings as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });

      if (competitors) {
        await tx.competitor.deleteMany({ where: { brandId: existing.id } });
        const rows = competitors
          .map((c) => ({
            brandId: existing.id,
            name: c.name.trim().slice(0, 120),
            domain: c.domain ? normalizeDomain(c.domain).slice(0, 180) : null,
            validated: true,
            autoDetected: false,
          }))
          .filter((c, idx, arr) => arr.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()) === idx);
        if (rows.length) {
          await tx.competitor.createMany({ data: rows });
        }
      }
    });

    const refreshed = await loadBrandByDomain(domain);
    return {
      ok: true,
      domain,
      brand: refreshed
        ? {
            id: refreshed.id,
            name: refreshed.name,
            domain: refreshed.domain,
            industry: refreshed.industry,
            country: refreshed.country,
            description: refreshed.description,
            objective: refreshed.objective,
            runSchedule: refreshed.runSchedule,
          }
        : null,
      competitors: refreshed?.competitors ?? [],
      aliases: refreshed?.aliases ?? [],
      settings: parseSettings(refreshed?.portalSettings),
    };
  });
};

export default adminBrandPortalRoutes;
