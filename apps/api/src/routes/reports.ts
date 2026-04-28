import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { EntitlementAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';
import { checkEntitlement, consumeEntitlement } from '../lib/entitlements';
import { executeRun } from '../lib/run-executor';

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
  fastify.get<{
    Querystring: {
      tenantId: string;
      userId?: string;
      status?: 'pending' | 'running' | 'completed' | 'failed';
    };
  }>('/app/reports', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    let tenantId: string;
    if (portalUser) tenantId = portalUser.tenantId;
    else if (process.env.ALLOW_USAGE_ACTOR_QUERY === 'true') {
      const querySchema = z.object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid().optional(),
        status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
      });
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: 'Parámetros inválidos.' });
      tenantId = parsed.data.tenantId;
    } else {
      return reply.code(401).send({
        error: 'Autenticación requerida: Authorization: Bearer <token>.',
      });
    }

    const statusSchema = z.enum(['pending', 'running', 'completed', 'failed']).optional();
    const statusOnly = z.object({ status: statusSchema }).safeParse(request.query);
    const status = statusOnly.success ? statusOnly.data.status : undefined;

    const where: any = {
      tenantId,
      runType: { in: ['deep_report', 'monthly'] },
    };
    if (status) where.status = status;

    const runs = await prisma.run.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, domain: true } },
        priaReports: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return runs.map((run) => ({
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      reportType: run.runType,
      score: run.priaReports[0]?.priaTotal ?? null,
      brand: run.brand,
    }));
  });

  fastify.get<{
    Params: { id: string };
    Querystring: { tenantId: string; userId?: string };
  }>('/app/reports/:id', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    let tenantId: string;
    let userId: string | undefined;
    if (portalUser) {
      tenantId = portalUser.tenantId;
      userId = portalUser.userId;
    } else if (process.env.ALLOW_USAGE_ACTOR_QUERY === 'true') {
      const parsed = z
        .object({
          id: z.string().uuid(),
          tenantId: z.string().uuid(),
          userId: z.string().uuid().optional(),
        })
        .safeParse({
          id: request.params.id,
          tenantId: request.query.tenantId,
          userId: request.query.userId,
        });
      if (!parsed.success) return reply.code(400).send({ error: 'Parámetros inválidos.' });
      tenantId = parsed.data.tenantId;
      userId = parsed.data.userId;
    } else {
      return reply.code(401).send({ error: 'Autenticación requerida: Authorization: Bearer <token>.' });
    }

    const idParsed = z.object({ id: z.string().uuid() }).safeParse({ id: request.params.id });
    if (!idParsed.success) return reply.code(400).send({ error: 'Parámetros inválidos.' });

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
            competitors: { select: { id: true, name: true } },
            aliases: { select: { id: true, alias: true } },
          },
        },
        promptResults: { include: { prompt: { include: { category: true } } }, orderBy: { createdAt: 'asc' } },
        priaReports: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!run) return reply.code(404).send({ error: 'Reporte no encontrado.' });
    if (run.tenantId !== tenantId) {
      return reply.code(403).send({ error: 'Este reporte no pertenece a tu cuenta.' });
    }

    if (run.runType === 'deep_report') {
      const entitlement = await checkEntitlement(prisma, {
        actor: { tenantId, userId },
        action: EntitlementAction.report_deep_view,
        brandId: run.brandId,
      });
      if (!entitlement.allowed) return reply.code(403).send({ ok: false, ...entitlement });
    }

    return run;
  });

  fastify.post<{
    Params: { brandId: string };
    Body: { tenantId: string; userId: string; periodStart?: string; periodEnd?: string };
  }>('/:brandId/deep-generate', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    let tenantId: string;
    let userId: string;
    let periodStartRaw: string | undefined;
    let periodEndRaw: string | undefined;

    if (portalUser) {
      tenantId = portalUser.tenantId;
      userId = portalUser.userId;
      periodStartRaw = typeof body.periodStart === 'string' ? body.periodStart : undefined;
      periodEndRaw = typeof body.periodEnd === 'string' ? body.periodEnd : undefined;
    } else if (process.env.ALLOW_USAGE_ACTOR_QUERY === 'true') {
      const payload = z
        .object({
          brandId: z.string().uuid(),
          tenantId: z.string().uuid(),
          userId: z.string().uuid(),
          periodStart: z.string().datetime().optional(),
          periodEnd: z.string().datetime().optional(),
        })
        .safeParse({
          brandId: request.params.brandId,
          ...body,
        });
      if (!payload.success) return reply.code(400).send({ error: 'Payload inválido.' });
      tenantId = payload.data.tenantId;
      userId = payload.data.userId;
      periodStartRaw = payload.data.periodStart;
      periodEndRaw = payload.data.periodEnd;
    } else {
      return reply.code(401).send({ error: 'Autenticación requerida: Authorization: Bearer <token>.' });
    }

    const brandId = request.params.brandId;
    const idCheck = z.string().uuid().safeParse(brandId);
    if (!idCheck.success) return reply.code(400).send({ error: 'Payload inválido.' });

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, tenantId: true },
    });
    if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });
    if (brand.tenantId !== tenantId) {
      return reply.code(403).send({ error: 'La marca no pertenece a tu cuenta.' });
    }

    const entitlement = await checkEntitlement(prisma, {
      actor: { tenantId, userId },
      action: EntitlementAction.report_deep_generate,
      brandId,
    });
    if (!entitlement.allowed) return reply.code(403).send({ ok: false, ...entitlement });

    const now = new Date();
    const periodStart = periodStartRaw ? new Date(periodStartRaw) : now;
    const periodEnd = periodEndRaw ? new Date(periodEndRaw) : now;

    const run = await prisma.run.create({
      data: {
        tenantId,
        brandId,
        status: 'pending',
        runType: 'deep_report',
        periodStart,
        periodEnd,
      },
    });

    await prisma.tenantBrandAccess.upsert({
      where: {
        tenantId_brandId: {
          tenantId,
          brandId,
        },
      },
      create: {
        tenantId,
        brandId,
        source: 'deep_report_generation',
      },
      update: {},
    });

    try {
      await consumeEntitlement(prisma, {
        actor: { tenantId, userId },
        action: EntitlementAction.report_deep_generate,
        brandId,
        dedupeKey: `deep-generate:${tenantId}:${brandId}:${run.id}`,
        metaJson: { runId: run.id },
      });
    } catch (err) {
      await prisma.run.delete({ where: { id: run.id } }).catch(() => {});
      fastify.log.error({ err }, 'consumeEntitlement fallo');
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
        return reply.code(503).send({
          error: 'usage_ledger_requerido',
          message:
            'Falta la tabla usage_ledger (u objetos relacionados). En el servicio API ejecutá: npx prisma migrate deploy',
        });
      }
      throw err;
    }

    setImmediate(async () => {
      try {
        await executeRun(run.id);
      } catch (err) {
        fastify.log.error({ err, runId: run.id }, 'Error ejecutando deep report');
        await prisma.run.update({ where: { id: run.id }, data: { status: 'failed' } }).catch(() => {});
      }
    });

    return reply.code(202).send({
      ok: true,
      runId: run.id,
      status: run.status,
      entitlement: {
        plan: entitlement.plan,
        usage: entitlement.usage + 1,
        limit: entitlement.limit,
      },
    });
  });

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

    const [totalRuns, runsToday, statusGroups, avgPria, recentRuns, trackedDiagnostics] = await Promise.all([
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
      prisma.publicDiagnostic.findMany({
        where: {
          OR: [{ refCode: { not: null } }, { utmSource: { not: null } }],
        },
        select: {
          refCode: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          status: true,
          email: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
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

    const refMap = new Map<
      string,
      {
        refCode: string;
        visits: number;
        completedDiagnostics: number;
        capturedEmails: number;
        latestAt: Date;
        topSource: string;
      }
    >();
    const sourceMap = new Map<string, number>();
    for (const row of trackedDiagnostics) {
      const source = (row.utmSource || 'directo').trim() || 'directo';
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

      if (!row.refCode) continue;
      const ref = row.refCode.trim().toLowerCase();
      if (!ref) continue;
      const current = refMap.get(ref) || {
        refCode: ref,
        visits: 0,
        completedDiagnostics: 0,
        capturedEmails: 0,
        latestAt: row.createdAt,
        topSource: source,
      };
      current.visits += 1;
      if (row.status === 'completed') current.completedDiagnostics += 1;
      if (row.email) current.capturedEmails += 1;
      if (row.createdAt > current.latestAt) current.latestAt = row.createdAt;
      current.topSource = source;
      refMap.set(ref, current);
    }

    const topReferrers = Array.from(refMap.values())
      .map((row) => ({
        refCode: row.refCode,
        visits: row.visits,
        completedDiagnostics: row.completedDiagnostics,
        capturedEmails: row.capturedEmails,
        completionRate: row.visits > 0 ? (row.completedDiagnostics / row.visits) * 100 : 0,
        latestAt: row.latestAt,
        topSource: row.topSource,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 15);

    const topSources = Array.from(sourceMap.entries())
      .map(([source, visits]) => ({ source, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

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
      referrals: {
        totalTrackedDiagnostics: trackedDiagnostics.length,
        topReferrers,
        topSources,
      },
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
