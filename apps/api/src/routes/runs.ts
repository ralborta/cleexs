import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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
        priaReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
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
          orderBy: { createdAt: 'asc' },
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

    // Cargar cada prompt por su promptId y armar la respuesta sin mutar (evitar que todos muestren el mismo)
    const promptIds = [...new Set(run.promptResults.map((pr) => pr.promptId))];
    const promptsById = await prisma.prompt.findMany({
      where: { id: { in: promptIds } },
      include: { category: true },
    });
    const promptMap = new Map(promptsById.map((p) => [p.id, p]));

    // Ordenar resultados por orden del prompt en la versión (createdAt del prompt) y asignar prompt correcto a cada uno
    const promptResults = run.promptResults
      .map((pr) => {
        const prompt = promptMap.get(pr.promptId);
        return {
          ...pr,
          prompt: prompt ?? (pr as { prompt?: (typeof promptsById)[0] }).prompt,
        };
      })
      .sort((a, b) => {
        const pa = promptMap.get(a.promptId);
        const pb = promptMap.get(b.promptId);
        if (!pa || !pb) return 0;
        return new Date(pa.createdAt).getTime() - new Date(pb.createdAt).getTime();
      });

    return { ...run, promptResults };
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

      // Crear resultado (promptId debe ser el que el cliente envió)
      const result = await prisma.promptResult.create({
        data: {
          runId: run.id,
          promptId,
          responseText: finalResponseText,
          top3Json: top3 as unknown as Prisma.InputJsonValue,
          score,
          flags: flags as unknown as Prisma.InputJsonValue,
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
      if (result.promptId !== result.prompt.id) {
        fastify.log.warn(
          { runId: run.id, expectedPromptId: promptId, storedPromptId: result.promptId },
          'PromptResult (addResult) con promptId distinto al esperado'
        );
      }

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

  // POST /runs/:id/execute
  const executeSchema = z.object({
    promptVersionId: z.string().uuid().optional(),
    model: z.string().optional().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(1).optional().default(0.2),
    maxTokens: z.number().min(128).max(4096).optional().default(800),
    force: z.boolean().optional().default(false),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof executeSchema> }>(
    '/:id/execute',
    async (request, reply) => {
      const data = executeSchema.parse(request.body || {});

      if (!process.env.OPENAI_API_KEY) {
        return reply.code(500).send({ error: 'OPENAI_API_KEY no configurada' });
      }

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
            select: { id: true },
          },
        },
      });

      if (!run) {
        return reply.code(404).send({ error: 'Run no encontrado' });
      }

      if (run.promptResults.length > 0 && !data.force) {
        return reply.code(409).send({
          error: 'El run ya tiene resultados. Usá force=true para recalcular.',
        });
      }

      const promptVersion = data.promptVersionId
        ? await prisma.promptVersion.findUnique({ where: { id: data.promptVersionId } })
        : await prisma.promptVersion.findFirst({
            where: { tenantId: run.tenantId, active: true },
            orderBy: { createdAt: 'desc' },
          });

      if (!promptVersion) {
        return reply.code(400).send({ error: 'No hay versión de prompts activa' });
      }

      const prompts = await prisma.prompt.findMany({
        where: {
          promptVersionId: promptVersion.id,
          active: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (prompts.length === 0) {
        return reply.code(400).send({ error: 'No hay prompts activos en la versión seleccionada' });
      }

      if (data.force && run.promptResults.length > 0) {
        await prisma.promptResult.deleteMany({ where: { runId: run.id } });
      }

      await prisma.run.update({
        where: { id: run.id },
        data: {
          status: 'running',
          modelMeta: {
            model: data.model,
            temperature: data.temperature,
            maxTokens: data.maxTokens,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      const competitors = run.brand.competitors.map((c) => ({
        name: c.name,
        aliases: (c.aliases as string[]) || [],
      }));
      const competitorList = competitors.map((c) => c.name).join(', ');
      const brandAliases = run.brand.aliases.map((a) => a.alias);
      let totalTokens = 0;

      try {
        for (const prompt of prompts) {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: data.model,
              temperature: data.temperature,
              max_tokens: data.maxTokens,
              messages: [
                {
                  role: 'system',
                  content:
                    'Respondé con un ranking claro del Top 3 en formato numerado (1., 2., 3.). ' +
                    'Incluí marcas y luego un breve motivo por cada una.',
                },
                {
                  role: 'user',
                  content:
                    `${prompt.promptText}\n\n` +
                    `Marca a medir: ${run.brand.name}.\n` +
                    `Competidores: ${competitorList || 'no informados'}.`,
                },
              ],
            }),
          });

          const responseJson = (await response.json()) as any;
          if (!response.ok) {
            throw new Error(responseJson?.error?.message || 'Error en OpenAI');
          }

          totalTokens += responseJson?.usage?.total_tokens || 0;
          const responseText = responseJson?.choices?.[0]?.message?.content?.trim() || '';

          const { top3, flags } = parseTop3(responseText, run.brand.name, competitors);
          const brandPosition =
            top3.find(
              (e) =>
                e.name.toLowerCase() === run.brand.name.toLowerCase() ||
                brandAliases.some((a) => a.toLowerCase() === e.name.toLowerCase())
            )?.position || null;

          const score = calculateScore(brandPosition);
          const maxSize = 100 * 1024;
          const truncated = responseText.length > maxSize;
          const finalResponseText = truncated ? responseText.substring(0, maxSize) : responseText;

          const created = await prisma.promptResult.create({
            data: {
              runId: run.id,
              promptId: prompt.id,
              responseText: finalResponseText,
              top3Json: top3 as unknown as Prisma.InputJsonValue,
              score,
              flags: flags as unknown as Prisma.InputJsonValue,
              truncated,
            },
          });
          // Verificación: el resultado debe tener el prompt que acabamos de usar
          if (created.promptId !== prompt.id) {
            fastify.log.warn(
              { runId: run.id, expectedPromptId: prompt.id, storedPromptId: created.promptId },
              'PromptResult creado con promptId distinto al esperado'
            );
          }
        }

        await updatePRIAReport(run.id, run.brandId);

        await prisma.run.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            tokensUsed: totalTokens,
          },
        });

        return reply.code(200).send({
          runId: run.id,
          promptVersionId: promptVersion.id,
          promptsExecuted: prompts.length,
          tokensUsed: totalTokens,
        });
      } catch (error: any) {
        await prisma.run.update({
          where: { id: run.id },
          data: { status: 'failed' },
        });
        return reply.code(500).send({ error: error?.message || 'Error ejecutando prompts' });
      }
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
          overrideTop3Json: overrideTop3 as unknown as Prisma.InputJsonValue,
          manualOverride: true,
          score: newScore,
          flags: {
            ...(result.flags as any),
            manual_override: true,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      // Recalcular PRIA
      await updatePRIAReport(run.id, run.brandId);

      return updated;
    }
  );
};

export default runRoutes;
