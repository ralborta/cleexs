import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
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

/**
 * Snapshot para portal de marca (borrador / cliente).
 * GET /api/admin/brand-portal/:domain
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

    const brand = await prisma.brand.findFirst({
      where: { domain },
      select: { id: true, name: true, domain: true, industry: true, tenantId: true },
    });

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

    const brandRow = comparison.find((c) => c.type === 'brand' || c.name?.toLowerCase() === brand?.name.toLowerCase());
    const rivals = comparison
      .filter((c) => c.type !== 'brand')
      .sort((a, b) => (b.share ?? 0) - (a.share ?? 0));

    const totalAppearances = comparison.reduce((acc, c) => acc + (c.appearances ?? 0), 0);
    const brandAppearances = brandRow?.appearances ?? 0;
    const sovPct =
      totalAppearances > 0
        ? Math.round((brandAppearances / totalAppearances) * 1000) / 10
        : brandRow?.share != null
          ? Math.round(brandRow.share * 10) / 10
          : null;

    return {
      ok: true,
      domain,
      brand: brand
        ? {
            id: brand.id,
            name: brand.name,
            domain: brand.domain,
            industry: brand.industry,
          }
        : diagnostic
          ? {
              id: null,
              name: diagnostic.brandName,
              domain: diagnostic.domain,
              industry: null,
            }
          : null,
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
        score: Boolean(score != null),
        shareOfVoice: comparison.length > 0,
        insights: Boolean(openai?.resumenEjecutivo || (openai?.sugerencias?.length ?? 0) > 0),
        funnelEcommerce: false,
        shopify: false,
        emailSequenceBrand: false,
        referralsBrand: false,
      },
    };
  });
};

export default adminBrandPortalRoutes;
