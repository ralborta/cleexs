import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

interface ComparisonRow {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
  sampleReason?: string;
}

function buildComparisonSummary(
  promptResults: Array<{ top3Json: unknown }>
): ComparisonRow[] {
  const totals = new Map<
    string,
    { name: string; type: string; count: number; positionSum: number; sampleReason?: string }
  >();
  let totalEntries = 0;
  for (const result of promptResults) {
    const top3 = (result.top3Json as Array<{ position: number; name: string; type: string; reason?: string }>) || [];
    for (const entry of top3) {
      totalEntries += 1;
      const key = `${normalizeName(entry.name)}|${entry.type}`;
      const current = totals.get(key) || {
        name: entry.name,
        type: entry.type,
        count: 0,
        positionSum: 0,
      };
      totals.set(key, {
        ...current,
        count: current.count + 1,
        positionSum: current.positionSum + entry.position,
        sampleReason: current.sampleReason || entry.reason,
      });
    }
  }
  return Array.from(totals.values()).map((row) => ({
    name: row.name,
    type: row.type,
    appearances: row.count,
    averagePosition: row.count ? row.positionSum / row.count : 0,
    share: totalEntries ? (row.count / totalEntries) * 100 : 0,
    sampleReason: row.sampleReason,
  }));
}

const reportRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /reports/pria?brandId=...&versionId=...&startDate=...&endDate=...
  fastify.get<{
    Querystring: {
      brandId: string;
      versionId?: string;
      startDate?: string;
      endDate?: string;
    };
  }>('/pria', async (request, reply) => {
    const { brandId, versionId, startDate, endDate } = request.query;

    const where: any = {
      brandId,
    };

    if (startDate || endDate) {
      where.run = {
        periodStart: startDate ? { gte: new Date(startDate) } : undefined,
        periodEnd: endDate ? { lte: new Date(endDate) } : undefined,
      };
    }

    if (versionId) {
      // Filtrar por prompts de esa versión
      where.run = {
        ...where.run,
        promptResults: {
          some: {
            prompt: {
              promptVersionId: versionId,
            },
          },
        },
      };
    }

    const reports = await prisma.pRIAReport.findMany({
      where,
      include: {
        run: {
          include: {
            brand: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reports;
  });

  // GET /reports/compare?brandId=...&v1=...&v2=...
  fastify.get<{
    Querystring: {
      brandId: string;
      v1: string; // versionId 1
      v2: string; // versionId 2
    };
  }>('/compare', async (request, reply) => {
    const { brandId, v1, v2 } = request.query;

    // Obtener reports de ambas versiones
    const [reportsV1, reportsV2] = await Promise.all([
      prisma.pRIAReport.findMany({
        where: {
          brandId,
          run: {
            promptResults: {
              some: {
                prompt: {
                  promptVersionId: v1,
                },
              },
            },
          },
        },
        include: {
          run: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pRIAReport.findMany({
        where: {
          brandId,
          run: {
            promptResults: {
              some: {
                prompt: {
                  promptVersionId: v2,
                },
              },
            },
          },
        },
        include: {
          run: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      v1: {
        versionId: v1,
        reports: reportsV1,
        averagePRIA:
          reportsV1.length > 0
            ? reportsV1.reduce((sum, r) => sum + r.priaTotal, 0) / reportsV1.length
            : 0,
      },
      v2: {
        versionId: v2,
        reports: reportsV2,
        averagePRIA:
          reportsV2.length > 0
            ? reportsV2.reduce((sum, r) => sum + r.priaTotal, 0) / reportsV2.length
            : 0,
      },
    };
  });

  // GET /reports/ranking?tenantId=...&versionId=...&periodStart=...&periodEnd=...
  fastify.get<{
    Querystring: {
      tenantId: string;
      versionId?: string;
      periodStart?: string;
      periodEnd?: string;
    };
  }>('/ranking', async (request) => {
    const { tenantId, versionId, periodStart, periodEnd } = request.query;

    const where: any = {
      brand: {
        tenantId,
      },
    };

    if (periodStart || periodEnd) {
      where.periodStart = periodStart ? { gte: new Date(periodStart) } : undefined;
      where.periodEnd = periodEnd ? { lte: new Date(periodEnd) } : undefined;
    }

    if (versionId) {
      where.promptResults = {
        some: {
          prompt: {
            promptVersionId: versionId,
          },
        },
      };
    }

    const runs = await prisma.run.findMany({
      where,
      include: {
        brand: {
          select: { id: true, name: true },
        },
        priaReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Agrupar por brand y obtener el PRIA más reciente
    const ranking = runs
      .map((run) => {
        const latestReport = run.priaReports[0];
        return {
          brandId: run.brand.id,
          brandName: run.brand.name,
          pria: latestReport?.priaTotal || 0,
          runId: run.id,
          periodStart: run.periodStart,
          periodEnd: run.periodEnd,
        };
      })
      .sort((a, b) => b.pria - a.pria);

    return ranking;
  });

  // GET /reports/platform-dashboard — métricas internas globales (piloto)
  fastify.get('/platform-dashboard', async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOf30Days = new Date(now);
    startOf30Days.setDate(startOf30Days.getDate() - 29);
    startOf30Days.setHours(0, 0, 0, 0);

    const [totalRuns, runsToday, statusGroups, avgPria, recentRuns] = await Promise.all([
      prisma.run.count(),
      prisma.run.count({
        where: {
          createdAt: {
            gte: startOfToday,
          },
        },
      }),
      prisma.run.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      prisma.pRIAReport.aggregate({
        _avg: {
          priaTotal: true,
        },
      }),
      prisma.run.findMany({
        include: {
          brand: {
            select: {
              name: true,
              industry: true,
            },
          },
          priaReports: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    ]);

    const statusCount = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };
    for (const group of statusGroups) {
      statusCount[group.status] = group._count._all;
    }

    const successRate = totalRuns > 0 ? (statusCount.completed / totalRuns) * 100 : 0;

    const dailyMap = new Map<string, { date: string; runs: number; scoreSum: number; scoreCount: number }>();
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(startOf30Days);
      d.setDate(startOf30Days.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, runs: 0, scoreSum: 0, scoreCount: 0 });
    }

    const industryMap = new Map<string, { industry: string; runs: number; scoreSum: number; scoreCount: number }>();
    for (const run of recentRuns) {
      const createdAtKey = run.createdAt.toISOString().slice(0, 10);
      const day = dailyMap.get(createdAtKey);
      const score = run.priaReports[0]?.priaTotal;

      if (day) {
        day.runs += 1;
        if (typeof score === 'number') {
          day.scoreSum += score;
          day.scoreCount += 1;
        }
      }

      const industryLabel = (run.brand.industry || 'Sin industria').trim() || 'Sin industria';
      const currentIndustry = industryMap.get(industryLabel) || {
        industry: industryLabel,
        runs: 0,
        scoreSum: 0,
        scoreCount: 0,
      };
      currentIndustry.runs += 1;
      if (typeof score === 'number') {
        currentIndustry.scoreSum += score;
        currentIndustry.scoreCount += 1;
      }
      industryMap.set(industryLabel, currentIndustry);
    }

    const dailyRuns = Array.from(dailyMap.values()).map((row) => ({
      date: row.date,
      runs: row.runs,
      avgScore: row.scoreCount > 0 ? row.scoreSum / row.scoreCount : 0,
    }));

    const industries = Array.from(industryMap.values())
      .map((row) => ({
        industry: row.industry,
        runs: row.runs,
        avgScore: row.scoreCount > 0 ? row.scoreSum / row.scoreCount : 0,
      }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 10);

    const latestRuns = recentRuns.slice(0, 12).map((run) => ({
      id: run.id,
      brandName: run.brand.name,
      industry: run.brand.industry || null,
      status: run.status,
      createdAt: run.createdAt,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      score: run.priaReports[0]?.priaTotal ?? null,
    }));

    return {
      summary: {
        totalRuns,
        runsToday,
        completedRuns: statusCount.completed,
        failedRuns: statusCount.failed,
        runningRuns: statusCount.running,
        pendingRuns: statusCount.pending,
        successRate,
        averageCleexsScore: avgPria._avg.priaTotal ?? 0,
      },
      dailyRuns,
      industries,
      latestRuns,
    };
  });

  // GET /reports/brand-dashboard?brandId=... — dashboard centrado en una marca
  fastify.get<{
    Querystring: { brandId: string };
  }>('/brand-dashboard', async (request, reply) => {
    const { brandId } = request.query;

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        aliases: true,
        competitors: true,
      },
    });

    if (!brand) {
      return reply.code(404).send({ error: 'Marca no encontrada' });
    }

    // Último run completado de esta marca
    const latestRun = await prisma.run.findFirst({
      where: { brandId, status: 'completed' },
      include: {
        promptResults: {
          include: { prompt: { include: { category: true } } },
          orderBy: { createdAt: 'asc' },
        },
        priaReports: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const cleexsScore = latestRun?.priaReports?.[0]?.priaTotal ?? 0;
    const comparison = latestRun
      ? buildComparisonSummary(latestRun.promptResults.map((pr) => ({ top3Json: pr.top3Json })))
      : [];

    // PRIA reports para tendencia (histórico)
    const priaReports = await prisma.pRIAReport.findMany({
      where: { brandId },
      include: {
        run: {
          include: { brand: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return {
      brand: {
        id: brand.id,
        name: brand.name,
        domain: brand.domain,
        industry: brand.industry,
        competitors: brand.competitors.map((c) => ({ id: c.id, name: c.name })),
      },
      cleexsScore,
      comparison,
      latestRun: latestRun
        ? {
            id: latestRun.id,
            periodStart: latestRun.periodStart,
            periodEnd: latestRun.periodEnd,
          }
        : null,
      trend: priaReports.reverse(), // orden cronológico para el gráfico
    };
  });
};

export default reportRoutes;
