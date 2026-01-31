import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { canCreateRun } from '../lib/tenant';
import { parseTop3 } from '../lib/parsing';
import { calculateScore } from '@cleexs/shared';
import { updatePRIAReport } from '../lib/pria';

const runRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /runs?tenantId=...&brandId=...
  fastify.get<{ Querystring: { tenantId?: string; brandId?: string } }>('/', async (request) => {
    const where: any = {};
    if (request.query.tenantId) where.tenantId = request.query.tenantId;
    if (request.query.brandId) where.brandId = request.query.brandId;

    const runs = await prisma.run.findMany({
      where,
      include: {
        brand: {
          select: { id: true, name: true },
        },
        tenant: {
          select: { id: true, tenantCode: true },
        },
        _count: {
          select: {
            promptResults: true,
          },
        },
      },
      orderBy: { periodStart: 'desc' },
    });

    return runs;
  });

  // GET /runs/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const run = await prisma.run.findUnique({
      where: { id: request.params.id },
      include: {
        brand: {
          include: {
            aliases: true,
            competitors: true,
          },
        },
        promptResults: {
          include: {
            prompt: {
              include: {
                category: true,
              },
            },
          },
        },
        priaReports: true,
      },
    });

    if (!run) {
      return reply.code(404).send({ error: 'Run no encontrado' });
    }

    return run;
  });

  // POST /runs
  const createRunSchema = z.object({
    tenantId: z.string().uuid(),
    brandId: z.string().uuid(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    runType: z.string().optional().default('monthly'),
  });

  fastify.post<{ Body: z.infer<typeof createRunSchema> }>('/', async (request, reply) => {
    const data = createRunSchema.parse(request.body);

    // Validar límites
    const canCreate = await canCreateRun(data.tenantId);
    if (!canCreate.allowed) {
      return reply.code(403).send({ error: canCreate.reason });
    }

    const run = await prisma.run.create({
      data: {
        tenantId: data.tenantId,
        brandId: data.brandId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        runType: data.runType,
        status: 'pending',
      },
      include: {
        brand: true,
      },
    });

    return reply.code(201).send(run);
  });

  // POST /runs/:id/results
  const addResultSchema = z.object({
    promptId: z.string().uuid(),
    responseText: z.string().min(1),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof addResultSchema> }>(
    '/:id/results',
    async (request, reply) => {
      const run = await prisma.run.findUnique({
        where: { id: request.params.id },
        include: {
          brand: {
            include: {
              aliases: true,
              competitors: true,
            },
          },
        },
      });

      if (!run) {
        return reply.code(404).send({ error: 'Run no encontrado' });
      }

      const { promptId, responseText } = addResultSchema.parse(request.body);

      // Verificar que el prompt existe
      const prompt = await prisma.prompt.findUnique({
        where: { id: promptId },
      });

      if (!prompt) {
        return reply.code(404).send({ error: 'Prompt no encontrado' });
      }

      // Parsear Top 3
      const competitors = run.brand.competitors.map((c) => ({
        name: c.name,
        aliases: (c.aliases as string[]) || [],
      }));

      const { top3, flags } = parseTop3(responseText, run.brand.name, competitors);

      // Calcular score
      const brandAliases = run.brand.aliases.map((a) => a.alias);
      const brandPosition = top3.find(
        (e) =>
          e.name.toLowerCase() === run.brand.name.toLowerCase() ||
          brandAliases.some((a) => a.toLowerCase() === e.name.toLowerCase())
      )?.position || null;

      const score = calculateScore(brandPosition);

      // Verificar límite de tamaño
      const maxSize = 100 * 1024; // 100KB
      const truncated = responseText.length > maxSize;
      const finalResponseText = truncated ? responseText.substring(0, maxSize) : responseText;

      // Crear resultado
      const result = await prisma.promptResult.create({
        data: {
          runId: run.id,
          promptId,
          responseText: finalResponseText,
          top3Json: top3,
          score,
          flags,
          truncated,
        },
        include: {
          prompt: {
            include: {
              category: true,
            },
          },
        },
      });

      // Actualizar PRIA report
      await updatePRIAReport(run.id, run.brandId);

      // Actualizar status del run si es necesario
      const allResults = await prisma.promptResult.count({
        where: { runId: run.id },
      });

      // Asumimos que un run está completo cuando tiene todos los prompts activos
      // (esto se puede mejorar con validación más específica)
      await prisma.run.update({
        where: { id: run.id },
        data: {
          status: allResults > 0 ? 'completed' : 'pending',
        },
      });

      return reply.code(201).send(result);
    }
  );

  // POST /runs/:id/override
  const overrideSchema = z.object({
    promptResultId: z.string().uuid(),
    overrideTop3: z.array(
      z.object({
        position: z.number().min(1).max(3),
        name: z.string(),
        type: z.enum(['brand', 'competitor']),
      })
    ),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof overrideSchema> }>(
    '/:id/override',
    async (request, reply) => {
      const run = await prisma.run.findUnique({
        where: { id: request.params.id },
        include: {
          brand: {
            include: {
              aliases: true,
            },
          },
        },
      });

      if (!run) {
        return reply.code(404).send({ error: 'Run no encontrado' });
      }

      const { promptResultId, overrideTop3 } = overrideSchema.parse(request.body);

      const result = await prisma.promptResult.findUnique({
        where: { id: promptResultId },
      });

      if (!result || result.runId !== run.id) {
        return reply.code(404).send({ error: 'Resultado no encontrado' });
      }

      // Guardar el original en overrideTop3Json
      const originalTop3 = result.top3Json;

      // Calcular nuevo score
      const brandAliases = run.brand.aliases.map((a) => a.alias);
      const brandPosition =
        overrideTop3.find(
          (e) =>
            e.name.toLowerCase() === run.brand.name.toLowerCase() ||
            brandAliases.some((a) => a.toLowerCase() === e.name.toLowerCase())
        )?.position || null;

      const newScore = calculateScore(brandPosition);

      // Actualizar resultado
      const updated = await prisma.promptResult.update({
        where: { id: promptResultId },
        data: {
          overrideTop3Json: overrideTop3,
          manualOverride: true,
          score: newScore,
          flags: {
            ...(result.flags as any),
            manual_override: true,
          },
        },
      });

      // Recalcular PRIA
      await updatePRIAReport(run.id, run.brandId);

      return updated;
    }
  );
};

export default runRoutes;
