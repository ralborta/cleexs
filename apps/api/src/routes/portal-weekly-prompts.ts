import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';
import { syncShadowPromptForSaved } from '../lib/portal-weekly-prompt-sync';

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

      await prisma.brand.update({
        where: { id: brand.id },
        data: { selectedWeeklyPortalPromptId: row.id },
      });

      return { ok: true, selectedWeeklyPortalPromptId: row.id };
    }
  );
};

export default portalWeeklyPromptsRoutes;
