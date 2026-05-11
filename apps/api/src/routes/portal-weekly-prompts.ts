import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { EntitlementAction, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';
import { syncShadowPromptForSaved } from '../lib/portal-weekly-prompt-sync';
import { checkEntitlement, consumeEntitlement } from '../lib/entitlements';
import { canCreateRun } from '../lib/tenant';
import {
  analyzePortalCustomPromptResponse,
  buildPortalBrandContextBlock,
  executeOpenAIRankingPrompt,
} from '../lib/run-executor';

const MAX_SLOT = 4;

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
        portalSavedPrompts: { orderBy: { slot: 'asc' } },
      },
    });
    if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

    const slots = Array.from({ length: MAX_SLOT + 1 }, (_, slot) => {
      const row = brand.portalSavedPrompts.find((p) => p.slot === slot);
      return row
        ? {
            slot,
            id: row.id,
            title: row.title,
            promptText: row.promptText,
            updatedAt: row.updatedAt.toISOString(),
          }
        : {
            slot,
            id: null as string | null,
            title: '',
            promptText: '',
            updatedAt: null as string | null,
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
        const competitors = brand.competitors.map((c) => ({
          name: c.name,
          aliases: (c.aliases as string[]) || [],
        }));

        const brandContextBlock = buildPortalBrandContextBlock({
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
          competitors: brand.competitors,
        });

        const out = await executeOpenAIRankingPrompt({
          promptText: parsedBody.data.promptText.trim(),
          brandName: brand.name,
          competitors,
          brandAliases: brand.aliases.map((a) => a.alias),
          brandContextBlock,
        });

        const analysis = await analyzePortalCustomPromptResponse({
          userPrompt: parsedBody.data.promptText.trim(),
          responseText: out.responseText,
          brandName: brand.name,
          brandContextBlock,
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

  const putBody = z.object({
    title: z.string().max(160).optional().default(''),
    promptText: z.string().min(1).max(20000),
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

      const { title, promptText } = parsed.data;

      const saved = await prisma.brandPortalSavedPrompt.upsert({
        where: { brandId_slot: { brandId: brand.id, slot } },
        create: {
          brandId: brand.id,
          slot,
          title: title.trim(),
          promptText: promptText.trim(),
        },
        update: {
          title: title.trim(),
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

      return reply.code(200).send({
        ok: true,
        slot: saved.slot,
        id: saved.id,
        title: saved.title,
        promptText: saved.promptText,
      });
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
