import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';

/**
 * Snapshot de datos reales de Cleexs para Cleexs Marketing (producto en agente-cleexs).
 * Server-to-server: requiere header `x-cleexs-service-key` == env CLEEXS_MARKETING_SERVICE_KEY.
 * Sin la key configurada en el servidor, el endpoint responde 503 (no expone datos).
 *
 * Fuentes reales (sin mock):
 * - Brand + aliases + Competitor (diagnóstico de marca)
 * - Run + PRIAReport → Cleexs Score = priaTotal (misma definición que usa el resto del producto)
 * - PromptResult.top3Json → presencia en top3, posición 1 y menciones de competidores
 * - Prompt + PromptCategory → consultas por intención y puntos débiles
 */

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

type Top3Entry = { position?: number; name?: string; type?: string };

function parseTop3(value: unknown): Top3Entry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((e): e is Top3Entry => typeof e === 'object' && e !== null);
}

const marketingSnapshotRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: { domain?: string; brandId?: string; tenantId?: string };
  }>('/snapshot', async (request, reply) => {
    const expected = (process.env.CLEEXS_MARKETING_SERVICE_KEY || '').trim();
    if (!expected) {
      return reply.code(503).send({ error: 'Integración Cleexs Marketing no configurada (falta CLEEXS_MARKETING_SERVICE_KEY).' });
    }
    const got = request.headers['x-cleexs-service-key'];
    if (typeof got !== 'string' || got !== expected) {
      return reply.code(401).send({ error: 'Credencial de servicio inválida.' });
    }

    const { domain, brandId, tenantId } = request.query;
    let brand = null as Awaited<ReturnType<typeof findBrand>>;
    if (brandId) {
      brand = await findBrand({ id: brandId });
    } else if (domain) {
      const wanted = normalizeDomain(domain);
      const candidates = await prisma.brand.findMany({
        where: { domain: { not: null } },
        select: { id: true, domain: true },
        take: 500,
      });
      const match = candidates.find((b) => b.domain && normalizeDomain(b.domain) === wanted);
      if (match) brand = await findBrand({ id: match.id });
    } else if (tenantId) {
      const first = await prisma.brand.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (first) brand = await findBrand({ id: first.id });
    }
    if (!brand) {
      return reply.code(404).send({ error: 'Marca no encontrada en Cleexs para los parámetros enviados.' });
    }

    const runs = await prisma.run.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        priaReports: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { promptResults: true } },
      },
    });

    const history = runs.map((run) => ({
      runId: run.id,
      status: run.status,
      runType: run.runType,
      country: run.country,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      createdAt: run.createdAt,
      cleexsScore: run.priaReports[0]?.priaTotal ?? null,
      resultsCount: run._count.promptResults,
    }));

    const latestWithReport = runs.find((r) => r.priaReports.length > 0) ?? runs[0] ?? null;

    let latest: Record<string, unknown> | null = null;
    if (latestWithReport) {
      const results = await prisma.promptResult.findMany({
        where: { runId: latestWithReport.id },
        include: {
          prompt: { select: { promptText: true, name: true, category: { select: { id: true, name: true } } } },
        },
      });

      const brandNames = new Set(
        [brand.name, ...brand.aliases.map((a) => a.alias)].map((n) => n.trim().toLowerCase()),
      );
      let inTop3 = 0;
      let inPosition1 = 0;
      const competitorMentions = new Map<string, { name: string; appearances: number; positionSum: number }>();
      const weak: Array<{ prompt: string; intention: string | null; score: number; top: string[] }> = [];

      for (const result of results) {
        const top3 = parseTop3(result.manualOverride && result.overrideTop3Json ? result.overrideTop3Json : result.top3Json);
        const brandEntry = top3.find((e) => e.name && brandNames.has(e.name.trim().toLowerCase()));
        if (brandEntry) {
          inTop3 += 1;
          if (brandEntry.position === 1) inPosition1 += 1;
        } else {
          weak.push({
            prompt: result.prompt.promptText,
            intention: result.prompt.category?.name ?? result.prompt.name ?? null,
            score: result.score,
            top: top3.map((e) => e.name ?? '').filter(Boolean),
          });
        }
        for (const entry of top3) {
          if (!entry.name || (entry.type && entry.type !== 'competitor')) continue;
          if (brandNames.has(entry.name.trim().toLowerCase())) continue;
          const key = entry.name.trim().toLowerCase();
          const row = competitorMentions.get(key) ?? { name: entry.name, appearances: 0, positionSum: 0 };
          row.appearances += 1;
          row.positionSum += entry.position ?? 0;
          competitorMentions.set(key, row);
        }
      }
      weak.sort((a, b) => a.score - b.score);

      const pria = latestWithReport.priaReports[0] ?? null;
      let scoreByIntention: Array<{ intention: string; score: number }> = [];
      if (pria?.priaByCategoryJson && typeof pria.priaByCategoryJson === 'object') {
        const raw = pria.priaByCategoryJson as Record<string, unknown>;
        const categories = await prisma.promptCategory.findMany({
          where: { tenantId: brand.tenantId },
          select: { id: true, name: true },
        });
        const names = new Map(categories.map((c) => [c.id, c.name]));
        scoreByIntention = Object.entries(raw)
          .map(([id, value]) => ({ intention: names.get(id) ?? id, score: typeof value === 'number' ? value : Number(value) || 0 }))
          .sort((a, b) => a.score - b.score);
      }

      latest = {
        runId: latestWithReport.id,
        createdAt: latestWithReport.createdAt,
        cleexsScore: pria?.priaTotal ?? null,
        promptsAnalyzed: results.length,
        brandInTop3: inTop3,
        brandInTop3Pct: results.length ? Math.round((inTop3 / results.length) * 100) : 0,
        brandPosition1: inPosition1,
        competitorMentions: [...competitorMentions.values()]
          .map((c) => ({ ...c, averagePosition: c.appearances ? Number((c.positionSum / c.appearances).toFixed(2)) : 0 }))
          .sort((a, b) => b.appearances - a.appearances)
          .slice(0, 10),
        scoreByIntention,
        weakPrompts: weak.slice(0, 10),
      };
    }

    return {
      source: 'cleexs',
      generatedAt: new Date().toISOString(),
      brand: {
        id: brand.id,
        tenantId: brand.tenantId,
        name: brand.name,
        domain: brand.domain,
        industry: brand.industry,
        productType: brand.productType,
        country: brand.country,
        category: brand.category,
        objective: brand.objective,
        description: brand.description,
        aliases: brand.aliases.map((a) => a.alias),
        competitors: brand.competitors.map((c) => ({
          id: c.id,
          name: c.name,
          domain: c.domain,
          category: c.category,
          validated: c.validated,
        })),
      },
      cleexsScore: latest && typeof latest.cleexsScore === 'number' ? latest.cleexsScore : null,
      latest,
      history,
    };
  });
};

function findBrand(where: { id: string }) {
  return prisma.brand.findUnique({
    where,
    include: { aliases: true, competitors: true },
  });
}

export default marketingSnapshotRoutes;
