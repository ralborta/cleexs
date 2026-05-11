import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { EntitlementAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';
import { syncShadowPromptForSaved } from '../lib/portal-weekly-prompt-sync';
import { persistSavedPromptExecutionSnapshot } from '../lib/portal-saved-prompt-history';
import { checkEntitlement, consumeEntitlement } from '../lib/entitlements';
import { canCreateRun } from '../lib/tenant';
import {
  analyzePortalCustomPromptResponse,
  buildPortalBrandFreeformContextBlock,
  executeOpenAIRankingPrompt,
} from '../lib/run-executor';

const MAX_SLOT = 4;

function buildSavedPromptTitle(promptText: string, fallbackSlot?: number): string {
  const normalized = promptText
    .trim()
    .replace(/\s+/g, ' ');
  const words = normalized
    .split(' ')
    .filter(Boolean)
    .slice(0, 3);
  const totalWords = normalized ? normalized.split(' ').filter(Boolean).length : 0;

  if (words.length === 0) {
    return fallbackSlot != null ? `Opción ${fallbackSlot + 1}` : 'Prompt';
  }

  const title = words.join(' ');
  const capped = `${title.charAt(0).toUpperCase()}${title.slice(1)}`;
  return totalWords > 3 ? `${capped}...` : capped;
}

async function executePromptAgainstCurrentBrandContext(input: {
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
    aliases: Array<{ alias: string }>;
    competitors: Array<{ name: string; aliases?: unknown }>;
  };
  promptText: string;
}) {
  const competitors = input.brand.competitors.map((c) => ({
    name: c.name,
    aliases: (c.aliases as string[]) || [],
  }));

  const brandContextBlock = buildPortalBrandFreeformContextBlock({
    name: input.brand.name,
    domain: input.brand.domain,
    industry: input.brand.industry,
    country: input.brand.country,
    productType: input.brand.productType,
    objective: input.brand.objective,
    description: input.brand.description,
    businessType: input.brand.businessType,
    category: input.brand.category,
    subcategory: input.brand.subcategory,
    geoMarket: input.brand.geoMarket,
  });

  const out = await executeOpenAIRankingPrompt({
    promptText: input.promptText.trim(),
    brandName: input.brand.name,
    competitors,
    brandAliases: input.brand.aliases.map((a) => a.alias),
    brandContextBlock,
    mode: 'freeform',
  });

  const analysis = await analyzePortalCustomPromptResponse({
    userPrompt: input.promptText.trim(),
    responseText: out.responseText,
    brandName: input.brand.name,
    brandContextBlock,
  });

  return { out, analysis };
}

const portalWeeklyPromptsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { brandId: string } }>('/brands/:brandId/weekly-prompts', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    if (!portalUser) return reply.code(401).send({ error: 'Autenticación requerida.' });

    const brandId = request.params.brandId;
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, tenantId: portalUser.tenantId },
      select: {
        id: true,
        runSchedule: true,
        selectedWeeklyPortalPromptId: true,
        portalSavedPrompts: {
          orderBy: { slot: 'asc' },
          include: {
            executions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { createdAt: true },
            },
            _count: {
              select: { executions: true },
            },
          },
        },
      },
    });
    if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

    const slots = Array.from({ length: MAX_SLOT + 1 }, (_, slot) => {
      const row = brand.portalSavedPrompts.find((p) => p.slot === slot);
      return row
        ? {
            slot,
            id: row.id,
            title: buildSavedPromptTitle(row.promptText, slot),
            promptText: row.promptText,
            updatedAt: row.updatedAt.toISOString(),
            lastExecutedAt: row.executions[0]?.createdAt?.toISOString() ?? null,
            resultsCount: row._count.executions,
          }
        : {
            slot,
            id: null as string | null,
            title: '',
            promptText: '',
            updatedAt: null as string | null,
            lastExecutedAt: null as string | null,
            resultsCount: 0,
          };
    });

    return {
      brandId: brand.id,
      runSchedule: brand.runSchedule,
      selectedWeeklyPortalPromptId: brand.selectedWeeklyPortalPromptId,
      maxSlots: MAX_SLOT + 1,
      slots,
    };
  });

  const promptTryBody = z.object({
    promptText: z.string().min(5).max(20000),
  });

  /** Una consulta rápida: misma IA que corridas pero sin crear Run ni guardar; consume un score_generate como portal/mes. */
  fastify.post<{ Params: { brandId: string }; Body: unknown }>(
    '/brands/:brandId/prompt-try',
    async (request, reply) => {
      const portalUser = await resolvePortalUserFromRequest(request);
      if (!portalUser) return reply.code(401).send({ error: 'Autenticación requerida.' });

      const parsedBody = promptTryBody.safeParse(request.body ?? {});
      if (!parsedBody.success) return reply.code(400).send({ error: 'promptText inválido.', details: parsedBody.error.flatten() });

      const { tenantId, userId } = portalUser;
      const brandId = request.params.brandId;

      const brand = await prisma.brand.findFirst({
        where: { id: brandId, tenantId },
        include: {
          aliases: true,
          competitors: true,
        },
      });
      if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

      const canCreate = await canCreateRun(tenantId);
      if (!canCreate.allowed) {
        return reply.code(403).send({ error: canCreate.reason || 'No podés ejecutar una consulta ahora.' });
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

      try {
        await consumeEntitlement(prisma, {
          actor: { tenantId, userId },
          action: EntitlementAction.score_generate,
          brandId,
          dedupeKey: `portal-prompt-try:${userId}:${randomUUID()}`,
          metaJson: { brandId, kind: 'portal_prompt_try' },
        });
      } catch (err) {
        fastify.log.error({ err }, 'consumeEntitlement portal prompt-try');
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
          return reply.code(503).send({
            error: 'usage_ledger_requerido',
            message: 'Falta la tabla usage_ledger. Ejecutá migraciones en la API.',
          });
        }
        throw err;
      }

      try {
        const { out, analysis } = await executePromptAgainstCurrentBrandContext({
          brand,
          promptText: parsedBody.data.promptText.trim(),
        });

        return {
          responseText: out.responseText,
          analysis,
          totalTokens: out.totalTokens,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al ejecutar la consulta';
        fastify.log.error({ err: e, brandId }, 'executeOpenAIRankingPrompt portal');
        return reply.code(502).send({ error: msg });
      }
    }
  );

  fastify.post<{ Params: { brandId: string; savedPromptId: string } }>(
    '/brands/:brandId/weekly-prompts/:savedPromptId/execute',
    async (request, reply) => {
      const portalUser = await resolvePortalUserFromRequest(request);
      if (!portalUser) return reply.code(401).send({ error: 'Autenticación requerida.' });

      const { tenantId, userId } = portalUser;
      const brandId = request.params.brandId;
      const savedPromptId = request.params.savedPromptId;

      const brand = await prisma.brand.findFirst({
        where: { id: brandId, tenantId },
        include: {
          aliases: true,
          competitors: true,
          portalSavedPrompts: {
            where: { id: savedPromptId },
            take: 1,
          },
        },
      });
      if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

      const savedPrompt = brand.portalSavedPrompts[0];
      if (!savedPrompt || !savedPrompt.promptText.trim()) {
        return reply.code(404).send({ error: 'Prompt guardado no encontrado.' });
      }

      const canCreate = await canCreateRun(tenantId);
      if (!canCreate.allowed) {
        return reply.code(403).send({ error: canCreate.reason || 'No podés ejecutar una consulta ahora.' });
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

      try {
        await consumeEntitlement(prisma, {
          actor: { tenantId, userId },
          action: EntitlementAction.score_generate,
          brandId,
          dedupeKey: `portal-saved-prompt-execute:${savedPromptId}:${userId}:${randomUUID()}`,
          metaJson: { brandId, savedPromptId, kind: 'portal_saved_prompt_execute' },
        });
      } catch (err) {
        fastify.log.error({ err }, 'consumeEntitlement portal saved prompt execute');
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
          return reply.code(503).send({
            error: 'usage_ledger_requerido',
            message: 'Falta la tabla usage_ledger. Ejecutá migraciones en la API.',
          });
        }
        throw err;
      }

      try {
        const { out, analysis } = await executePromptAgainstCurrentBrandContext({
          brand,
          promptText: savedPrompt.promptText,
        });

        const execution = await persistSavedPromptExecutionSnapshot({
          savedPromptId: savedPrompt.id,
          source: 'portal_saved_prompt_execute',
          promptTextSnapshot: savedPrompt.promptText,
          responseText: out.responseText,
          analysisJson: analysis ? (analysis as unknown as Prisma.InputJsonValue) : null,
        });

        return {
          ok: true,
          executionId: execution.id,
          createdAt: execution.createdAt.toISOString(),
          savedPrompt: {
            id: savedPrompt.id,
            slot: savedPrompt.slot,
            title: buildSavedPromptTitle(savedPrompt.promptText, savedPrompt.slot),
            promptText: savedPrompt.promptText,
          },
          responseText: out.responseText,
          analysis,
          totalTokens: out.totalTokens,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al ejecutar el prompt guardado';
        fastify.log.error({ err: e, brandId, savedPromptId }, 'execute saved portal prompt');
        return reply.code(502).send({ error: msg });
      }
    }
  );

  const putBody = z.object({
    promptText: z.string().min(1).max(20000),
    latestExecution: z
      .object({
        responseText: z.string().min(1).max(100_000),
        analysis: z.unknown().nullable().optional(),
      })
      .optional(),
  });

  fastify.put<{ Params: { brandId: string; slot: string }; Body: unknown }>(
    '/brands/:brandId/weekly-prompts/:slot',
    async (request, reply) => {
      const portalUser = await resolvePortalUserFromRequest(request);
      if (!portalUser) return reply.code(401).send({ error: 'Autenticación requerida.' });

      const slot = Number(request.params.slot);
      if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
        return reply.code(400).send({ error: 'slot debe ser un entero entre 0 y 4.' });
      }

      const brand = await prisma.brand.findFirst({
        where: { id: request.params.brandId, tenantId: portalUser.tenantId },
        select: { id: true },
      });
      if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

      const parsed = putBody.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'Payload inválido.', details: parsed.error.flatten() });

      const { promptText, latestExecution } = parsed.data;
      const generatedTitle = buildSavedPromptTitle(promptText, slot);

      const saved = await prisma.brandPortalSavedPrompt.upsert({
        where: { brandId_slot: { brandId: brand.id, slot } },
        create: {
          brandId: brand.id,
          slot,
          title: generatedTitle,
          promptText: promptText.trim(),
        },
        update: {
          title: generatedTitle,
          promptText: promptText.trim(),
        },
      });

      try {
        await syncShadowPromptForSaved(portalUser.tenantId, saved);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo sincronizar el prompt técnico';
        fastify.log.error({ err: e, savedId: saved.id }, 'syncShadowPromptForSaved');
        return reply.code(503).send({ error: msg });
      }

      if (latestExecution?.responseText?.trim()) {
        try {
          await persistSavedPromptExecutionSnapshot({
            savedPromptId: saved.id,
            source: 'portal_manual',
            promptTextSnapshot: promptText.trim(),
            responseText: latestExecution.responseText.trim(),
            analysisJson:
              latestExecution.analysis && typeof latestExecution.analysis === 'object'
                ? (latestExecution.analysis as Prisma.InputJsonValue)
                : null,
          });
        } catch (e) {
          fastify.log.error({ err: e, savedId: saved.id }, 'persistSavedPromptExecutionSnapshot manual');
          return reply.code(503).send({ error: 'No se pudo guardar el historial del resultado.' });
        }
      }

      return reply.code(200).send({
        ok: true,
        slot: saved.slot,
        id: saved.id,
        title: buildSavedPromptTitle(saved.promptText, saved.slot),
        promptText: saved.promptText,
      });
    }
  );

  fastify.get<{ Params: { brandId: string; savedPromptId: string } }>(
    '/brands/:brandId/weekly-prompts/:savedPromptId/results',
    async (request, reply) => {
      const portalUser = await resolvePortalUserFromRequest(request);
      if (!portalUser) return reply.code(401).send({ error: 'Autenticación requerida.' });

      const row = await prisma.brandPortalSavedPrompt.findFirst({
        where: {
          id: request.params.savedPromptId,
          brandId: request.params.brandId,
          brand: { is: { tenantId: portalUser.tenantId } },
        },
        select: {
          id: true,
          slot: true,
          title: true,
          promptText: true,
          updatedAt: true,
          executions: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              createdAt: true,
              source: true,
              promptTextSnapshot: true,
              responseText: true,
              analysisJson: true,
              runId: true,
            },
          },
          _count: {
            select: { executions: true },
          },
        },
      });
      if (!row) return reply.code(404).send({ error: 'Prompt guardado no encontrado.' });

      return {
        savedPrompt: {
          id: row.id,
          slot: row.slot,
          title: buildSavedPromptTitle(row.promptText, row.slot),
          promptText: row.promptText,
          updatedAt: row.updatedAt.toISOString(),
          totalExecutions: row._count.executions,
        },
        results: row.executions.map((execution) => ({
          id: execution.id,
          createdAt: execution.createdAt.toISOString(),
          source: execution.source,
          promptTextSnapshot: execution.promptTextSnapshot,
          responseText: execution.responseText,
          analysis: execution.analysisJson,
          runId: execution.runId,
        })),
      };
    }
  );

  fastify.get<{ Params: { brandId: string } }>(
    '/brands/:brandId/weekly-prompts/results',
    async (request, reply) => {
      const portalUser = await resolvePortalUserFromRequest(request);
      if (!portalUser) return reply.code(401).send({ error: 'Autenticación requerida.' });

      const brand = await prisma.brand.findFirst({
        where: { id: request.params.brandId, tenantId: portalUser.tenantId },
        select: { id: true },
      });
      if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

      const executions = await prisma.brandPortalSavedPromptExecution.findMany({
        where: {
          savedPrompt: {
            brandId: brand.id,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
        select: {
          id: true,
          createdAt: true,
          source: true,
          promptTextSnapshot: true,
          responseText: true,
          analysisJson: true,
          runId: true,
          savedPrompt: {
            select: {
              id: true,
              slot: true,
              title: true,
              promptText: true,
            },
          },
        },
      });

      return {
        results: executions.map((execution) => ({
          id: execution.id,
          createdAt: execution.createdAt.toISOString(),
          source: execution.source,
          promptTextSnapshot: execution.promptTextSnapshot,
          responseText: execution.responseText,
          analysis: execution.analysisJson,
          runId: execution.runId,
          savedPrompt: {
            id: execution.savedPrompt.id,
            slot: execution.savedPrompt.slot,
            title: buildSavedPromptTitle(execution.savedPrompt.promptText, execution.savedPrompt.slot),
            promptText: execution.savedPrompt.promptText,
          },
        })),
      };
    }
  );

  fastify.delete<{ Params: { brandId: string; slot: string } }>(
    '/brands/:brandId/weekly-prompts/:slot',
    async (request, reply) => {
      const portalUser = await resolvePortalUserFromRequest(request);
      if (!portalUser) return reply.code(401).send({ error: 'Autenticación requerida.' });

      const slot = Number(request.params.slot);
      if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
        return reply.code(400).send({ error: 'slot debe ser un entero entre 0 y 4.' });
      }

      const brand = await prisma.brand.findFirst({
        where: { id: request.params.brandId, tenantId: portalUser.tenantId },
        select: { id: true, selectedWeeklyPortalPromptId: true },
      });
      if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

      const existing = await prisma.brandPortalSavedPrompt.findUnique({
        where: { brandId_slot: { brandId: brand.id, slot } },
      });
      if (!existing) return reply.code(204).send();

      await prisma.prompt.updateMany({
        where: { brandPortalSavedPromptId: existing.id },
        data: { brandPortalSavedPromptId: null },
      });

      if (brand.selectedWeeklyPortalPromptId === existing.id) {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { selectedWeeklyPortalPromptId: null },
        });
      }

      await prisma.brandPortalSavedPrompt.delete({ where: { id: existing.id } });
      return reply.code(204).send();
    }
  );

  const selectionBody = z.object({
    savedPromptId: z.string().uuid().nullable(),
  });

  fastify.patch<{ Params: { brandId: string }; Body: unknown }>(
    '/brands/:brandId/weekly-prompts/selection',
    async (request, reply) => {
      const portalUser = await resolvePortalUserFromRequest(request);
      if (!portalUser) return reply.code(401).send({ error: 'Autenticación requerida.' });

      const brand = await prisma.brand.findFirst({
        where: { id: request.params.brandId, tenantId: portalUser.tenantId },
        select: { id: true },
      });
      if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

      const parsed = selectionBody.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'Payload inválido.' });

      const { savedPromptId } = parsed.data;

      if (savedPromptId === null) {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { selectedWeeklyPortalPromptId: null },
        });
        return { ok: true, selectedWeeklyPortalPromptId: null };
      }

      const row = await prisma.brandPortalSavedPrompt.findFirst({
        where: { id: savedPromptId, brandId: brand.id },
      });
      if (!row) return reply.code(400).send({ error: 'Ese prompt no pertenece a esta marca.' });
      if (!row.promptText.trim()) {
        return reply.code(400).send({ error: 'El prompt está vacío; guardá texto antes de seleccionarlo.' });
      }

      try {
        await syncShadowPromptForSaved(portalUser.tenantId, row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo sincronizar el prompt técnico';
        fastify.log.error({ err: e, savedId: row.id }, 'syncShadowPromptForSaved on selection');
        return reply.code(503).send({ error: msg });
      }

      await prisma.brand.update({
        where: { id: brand.id },
        data: { selectedWeeklyPortalPromptId: row.id },
      });

      return { ok: true, selectedWeeklyPortalPromptId: row.id };
    }
  );
};

export default portalWeeklyPromptsRoutes;
