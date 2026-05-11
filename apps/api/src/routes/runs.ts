import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { EntitlementAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { canCreateRun } from '../lib/tenant';
import { parseTop3 } from '../lib/parsing';
import { calculateScore } from '@cleexs/shared';
import { updatePRIAReport } from '../lib/pria';
import { resolvePortalUserFromRequest } from '../lib/portal-user';
import { checkEntitlement, consumeEntitlement } from '../lib/entitlements';
import { persistSavedPromptExecutionSnapshot } from '../lib/portal-saved-prompt-history';
import {
  analyzePortalCustomPromptResponse,
  buildPortalBrandFreeformContextBlock,
  executeRun,
  loadPromptsForRunExecution,
  resolveActivePromptVersion,
} from '../lib/run-executor';

async function buildSavedPromptExecutionAnalysis(
  brand: {
    name: string;
    domain: string | null;
    industry: string | null;
    country: string | null;
    productType: string | null;
    objective: string | null;
    description: string | null;
    businessType: string | null;
    category: string | null;
    subcategory: string | null;
    geoMarket: string | null;
    competitors: Array<{ name: string }>;
  },
  promptText: string,
  responseText: string
) {
  const brandContextBlock = buildPortalBrandFreeformContextBlock({
    name: brand.name,
    domain: brand.domain,
    industry: brand.industry,
    country: brand.country,
    productType: brand.productType,
    objective: brand.objective,
    description: brand.description,
    businessType: brand.businessType,
    category: brand.category,
    subcategory: brand.subcategory,
    geoMarket: brand.geoMarket,
  });

  return analyzePortalCustomPromptResponse({
    userPrompt: promptText.trim(),
    responseText,
    brandName: brand.name,
    brandContextBlock,
  });
}

const runRoutes: FastifyPluginAsync = async (fastify) => {
  /** Portal cliente: crea run mensual y ejecuta análisis (mismos prompts que el dashboard). */
  fastify.post<{ Body: { brandId: string } }>('/portal/mes', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    if (!portalUser) {
      return reply.code(401).send({ error: 'Autenticación requerida: Bearer <token> del portal.' });
    }

    const parsed = z.object({ brandId: z.string().uuid() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'brandId inválido.' });

    const { tenantId, userId } = portalUser;
    const { brandId } = parsed.data;

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, tenantId: true },
    });
    if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });
    if (brand.tenantId !== tenantId) {
      return reply.code(403).send({ error: 'La marca no pertenece a tu cuenta.' });
    }

    const canCreate = await canCreateRun(tenantId);
    if (!canCreate.allowed) {
      return reply.code(403).send({ error: canCreate.reason || 'No podés crear una corrida ahora.' });
    }

    const genCheck = await checkEntitlement(prisma, {
      actor: { tenantId, userId },
      action: EntitlementAction.score_generate,
    });
    if (!genCheck.allowed) {
      return reply.code(403).send({
        error: genCheck.reason || 'Límite de análisis alcanzado.',
        code: genCheck.code,
        usage: genCheck.usage,
        limit: genCheck.limit,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return reply.code(503).send({ error: 'OPENAI_API_KEY no configurada en el servidor.' });
    }

    const now = new Date();
    const run = await prisma.run.create({
      data: {
        tenantId,
        brandId,
        status: 'pending',
        runType: 'monthly',
        periodStart: now,
        periodEnd: now,
      },
    });

    try {
      await consumeEntitlement(prisma, {
        actor: { tenantId, userId },
        action: EntitlementAction.score_generate,
        brandId,
        dedupeKey: `portal-mes:${run.id}`,
        metaJson: { runId: run.id, runType: 'monthly' },
      });
    } catch (err) {
      await prisma.run.delete({ where: { id: run.id } }).catch(() => {});
      fastify.log.error({ err }, 'consumeEntitlement score_generate portal/mes');
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
        return reply.code(503).send({
          error: 'usage_ledger_requerido',
          message: 'Falta la tabla usage_ledger. Ejecutá migraciones en la API.',
        });
      }
      throw err;
    }

    setImmediate(() => {
      void executeRun(run.id).catch(async (err) => {
        fastify.log.error({ err, runId: run.id }, 'executeRun portal/mes falló');
        await prisma.run.update({ where: { id: run.id }, data: { status: 'failed' } }).catch(() => {});
      });
    });

    return reply.code(202).send({
      ok: true,
      runId: run.id,
      status: run.status,
      runType: run.runType,
      hint: 'La corrida se ejecuta en segundo plano. Actualizá el historial del portal en 1–3 minutos.',
    });
  });

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

  // GET /runs/:runId/debug — qué hay en DB para este run y qué prompts tiene la versión
  fastify.get<{ Params: { runId: string } }>('/:runId/debug', async (request, reply) => {
    const runId = request.params.runId;
    const run = await prisma.run.findUnique({
      where: { id: runId },
      select: { id: true, brandId: true },
    });
    if (!run) return reply.code(404).send({ error: 'Run no encontrado' });

    const results = await prisma.promptResult.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, promptId: true, createdAt: true },
    });

    const promptIds = [...new Set(results.map((r) => r.promptId))];
    const promptsUsed = await prisma.prompt.findMany({
      where: { id: { in: promptIds } },
      select: { id: true, promptText: true, promptVersionId: true, createdAt: true },
    });

    let allPromptsInVersion: { id: string; promptTextPreview: string; createdAt: string }[] = [];
    const versionId = promptsUsed[0]?.promptVersionId;
    let versionName: string | null = null;
    if (versionId) {
      const versionRow = await prisma.promptVersion.findUnique({
        where: { id: versionId },
        select: { name: true },
      });
      versionName = versionRow?.name ?? null;
      const allInVersion = await prisma.prompt.findMany({
        where: { promptVersionId: versionId, active: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, promptText: true, createdAt: true },
      });
      allPromptsInVersion = allInVersion.map((p) => ({
        id: p.id,
        promptTextPreview: p.promptText.slice(0, 80) + (p.promptText.length > 80 ? '…' : ''),
        createdAt: String(p.createdAt),
      }));
    }

    return {
      runId,
      promptVersionUsed: versionId ? { id: versionId, name: versionName } : null,
      resultsCount: results.length,
      distinctPromptIdsInResults: promptIds,
      results: results.map((r) => ({
        resultId: r.id,
        promptId: r.promptId,
        createdAt: String(r.createdAt),
      })),
      promptsUsedInRun: promptsUsed.map((p) => ({
        id: p.id,
        promptTextPreview: p.promptText.slice(0, 80) + (p.promptText.length > 80 ? '…' : ''),
      })),
      allPromptsInVersionCount: allPromptsInVersion.length,
      allPromptsInVersion,
    };
  });

  // GET /runs/:runId/results/:resultId — diagnóstico: devuelve el resultado con su promptId y prompt (lo que está en DB)
  fastify.get<{ Params: { runId: string; resultId: string } }>('/:runId/results/:resultId', async (request, reply) => {
    const { runId, resultId } = request.params;
    const result = await prisma.promptResult.findFirst({
      where: { id: resultId, runId },
      include: {
        prompt: { include: { category: true } },
      },
    });
    if (!result) {
      return reply.code(404).send({ error: 'Resultado no encontrado' });
    }
    return {
      resultId: result.id,
      promptId: result.promptId,
      prompt: result.prompt
        ? {
            id: result.prompt.id,
            promptText: result.prompt.promptText,
            createdAt: result.prompt.createdAt,
            category: result.prompt.category?.name,
          }
        : null,
      responseTextPreview: result.responseText.slice(0, 200) + (result.responseText.length > 200 ? '…' : ''),
    };
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

    const uniqueIds = [...new Set(promptResults.map((pr) => pr.promptId))];
    if (uniqueIds.length === 1 && promptResults.length > 1) {
      fastify.log.warn(
        { runId: run.id, promptId: uniqueIds[0], resultsCount: promptResults.length },
        'Todos los resultados del run tienen el mismo promptId; re-ejecutar con force=true si hay que usar varios prompts'
      );
    }

    return { ...run, promptResults };
  });

  // POST /runs
  const createRunSchema = z.object({
    tenantId: z.string().uuid(),
    brandId: z.string().uuid(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    runType: z.string().optional().default('monthly'),
    /** Snapshot opcional: fija qué prompt guardado del portal se usa (además de weekly_portal + selección en marca) */
    weeklyPortalSavedPromptId: z.string().uuid().optional().nullable(),
  });

  fastify.post<{ Body: z.infer<typeof createRunSchema> }>('/', async (request, reply) => {
    const data = createRunSchema.parse(request.body);

    // Validar límites
    const canCreate = await canCreateRun(data.tenantId);
    if (!canCreate.allowed) {
      return reply.code(403).send({ error: canCreate.reason });
    }

    if (data.weeklyPortalSavedPromptId) {
      if (data.runType !== 'weekly_portal') {
        return reply.code(400).send({
          error: 'weeklyPortalSavedPromptId solo puede usarse cuando runType es weekly_portal.',
        });
      }
      const sp = await prisma.brandPortalSavedPrompt.findFirst({
        where: { id: data.weeklyPortalSavedPromptId, brandId: data.brandId },
      });
      if (!sp) {
        return reply.code(400).send({
          error: 'weeklyPortalSavedPromptId no pertenece a esta marca o no existe.',
        });
      }
    }

    const run = await prisma.run.create({
      data: {
        tenantId: data.tenantId,
        brandId: data.brandId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        runType: data.runType,
        weeklyPortalSavedPromptId: data.weeklyPortalSavedPromptId ?? undefined,
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
            select: {
              id: true,
              name: true,
              domain: true,
              industry: true,
              country: true,
              productType: true,
              objective: true,
              description: true,
              businessType: true,
              category: true,
              subcategory: true,
              geoMarket: true,
              selectedWeeklyPortalPromptId: true,
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

      if (prompt.brandPortalSavedPromptId) {
        try {
          const analysis = await buildSavedPromptExecutionAnalysis(run.brand, prompt.promptText, finalResponseText);
          await persistSavedPromptExecutionSnapshot({
            savedPromptId: prompt.brandPortalSavedPromptId,
            runId: run.id,
            source: `run:${run.runType}`,
            promptTextSnapshot: prompt.promptText,
            responseText: finalResponseText,
            analysisJson: analysis ? (analysis as unknown as Prisma.InputJsonValue) : null,
          });
        } catch (err) {
          fastify.log.warn({ err, runId: run.id, promptId }, 'No se pudo guardar historial portal en addResult');
        }
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
            select: {
              id: true,
              name: true,
              domain: true,
              industry: true,
              country: true,
              productType: true,
              objective: true,
              description: true,
              businessType: true,
              category: true,
              subcategory: true,
              geoMarket: true,
              selectedWeeklyPortalPromptId: true,
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

      const promptVersion = await resolveActivePromptVersion(run.tenantId, data.promptVersionId ?? null);

      if (!promptVersion) {
        return reply.code(400).send({ error: 'No hay versión de prompts activa' });
      }

      let prompts;
      try {
        prompts = await loadPromptsForRunExecution(
          {
            runType: run.runType,
            weeklyPortalSavedPromptId: run.weeklyPortalSavedPromptId,
            brand: { selectedWeeklyPortalPromptId: run.brand.selectedWeeklyPortalPromptId },
          },
          promptVersion.id
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error resolviendo prompts';
        return reply.code(400).send({ error: msg });
      }

      if (prompts.length === 0) {
        return reply.code(400).send({ error: 'No hay prompts activos en la versión seleccionada' });
      }

      fastify.log.info(
        { runId: run.id, promptVersionId: promptVersion.id, promptIds: prompts.map((p) => p.id), count: prompts.length },
        'Ejecutando run: prompts a usar'
      );

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
        // Usar índice explícito para asegurar que cada resultado guarde el prompt correcto (evitar closure/async)
        for (let i = 0; i < prompts.length; i++) {
          const prompt = prompts[i];
          const promptIdToStore = prompt.id;
          const promptTextToSend = prompt.promptText;

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
                    `${promptTextToSend}\n\n` +
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
              promptId: promptIdToStore,
              responseText: finalResponseText,
              top3Json: top3 as unknown as Prisma.InputJsonValue,
              score,
              flags: flags as unknown as Prisma.InputJsonValue,
              truncated,
            },
          });
          if (created.promptId !== promptIdToStore) {
            fastify.log.warn(
              { runId: run.id, index: i, expectedPromptId: promptIdToStore, storedPromptId: created.promptId },
              'PromptResult creado con promptId distinto al esperado'
            );
          }
          if (prompt.brandPortalSavedPromptId) {
            try {
              const analysis = await buildSavedPromptExecutionAnalysis(run.brand, promptTextToSend, finalResponseText);
              await persistSavedPromptExecutionSnapshot({
                savedPromptId: prompt.brandPortalSavedPromptId,
                runId: run.id,
                source: `run:${run.runType}`,
                promptTextSnapshot: promptTextToSend,
                responseText: finalResponseText,
                analysisJson: analysis ? (analysis as unknown as Prisma.InputJsonValue) : null,
              });
            } catch (err) {
              fastify.log.warn(
                { err, runId: run.id, promptId: promptIdToStore },
                'No se pudo guardar historial portal durante execute'
              );
            }
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
