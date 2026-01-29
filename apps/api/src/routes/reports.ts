import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

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
};

export default reportRoutes;
