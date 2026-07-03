import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import { CleexsEmailTemplateVariant } from '@prisma/client';
import { z } from 'zod';
import {
  createFreeEmailSequenceStep,
  deleteFreeEmailSequenceStep,
  getFreeEmailSequenceBundle,
  reorderFreeEmailSequenceSteps,
  sendFreeEmailSequenceStepTest,
  updateFreeEmailSequenceConfig,
  updateFreeEmailSequenceStep,
  buildFreeSequencePreview,
} from '../lib/free-email-sequence';

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

function adminGuard(request: FastifyRequest, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if (!requireAdminSecret(request)) {
    return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
      error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
    });
  }
  return null;
}

const previewSampleSchema = z.object({
  score: z.number().int().min(0).max(100).optional(),
  domain: z.string().trim().max(200).optional(),
  brandName: z.string().trim().max(200).optional(),
});

const stepContentSchema = z.object({
  variant: z.enum(['letter', 'editorial']).default('letter'),
  subject: z.string().trim().max(300).nullable().optional(),
  preheader: z.string().trim().max(500).nullable().optional(),
  body: z.string().trim().max(20000).nullable().optional(),
  sortOrder: z.number().int().min(1).max(99).optional(),
});

const patchConfigSchema = z.object({
  enabled: z.boolean().optional(),
  sendHourLocal: z.number().int().min(0).max(23).optional(),
  sendMinuteLocal: z.number().int().min(0).max(59).optional(),
  notes: z.string().trim().max(8000).nullable().optional(),
});

const patchStepSchema = z.object({
  sortOrder: z.number().int().min(1).max(99).optional(),
  delayDaysAfterPrevious: z.number().int().min(0).max(365).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().max(300).nullable().optional(),
  preheader: z.string().trim().max(500).nullable().optional(),
  body: z.string().trim().max(20000).nullable().optional(),
  templateVariant: z.nativeEnum(CleexsEmailTemplateVariant).optional(),
  active: z.boolean().optional(),
});

const createStepSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  delayDaysAfterPrevious: z.number().int().min(0).max(365).optional(),
  templateVariant: z.nativeEnum(CleexsEmailTemplateVariant).optional(),
  useSuggestedContent: z.boolean().optional(),
});

const reorderSchema = z.object({
  stepIds: z.array(z.string().uuid()).min(1).max(20),
});

const sendTestSchema = stepContentSchema.merge(previewSampleSchema).extend({
  to: z.string().email(),
});

/** Preview privado — secuencia free onboarding (pendiente aprobación Gonzalo). */
const adminEmailFreeSequencePreviewRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/email/free-sequence-preview', async (request, reply) => {
    const blocked = adminGuard(request, reply);
    if (blocked) return blocked;
    return getFreeEmailSequenceBundle();
  });

  fastify.patch('/email/free-sequence-preview/config', async (request, reply) => {
    const blocked = adminGuard(request, reply);
    if (blocked) return blocked;
    const parsed = patchConfigSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const config = await updateFreeEmailSequenceConfig(parsed.data);
    return { ok: true, config };
  });

  fastify.post('/email/free-sequence-preview/preview', async (request, reply) => {
    const blocked = adminGuard(request, reply);
    if (blocked) return blocked;
    const bodySchema = stepContentSchema.merge(previewSampleSchema);
    const parsed = bodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const { variant, subject, preheader, body, sortOrder, score, domain, brandName } = parsed.data;
    return buildFreeSequencePreview({
      content: { variant, subject, preheader, body },
      sortOrder,
      score,
      domain,
      brandName,
    });
  });

  fastify.post('/email/free-sequence-preview/send-test', async (request, reply) => {
    const blocked = adminGuard(request, reply);
    if (blocked) return blocked;
    const parsed = sendTestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const { to, variant, subject, preheader, body, sortOrder, score, domain, brandName } = parsed.data;
    try {
      return await sendFreeEmailSequenceStepTest({
        to,
        content: { variant, subject, preheader, body },
        sortOrder,
        score,
        domain,
        brandName,
      });
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode ?? 502;
      return reply.code(statusCode).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  fastify.post('/email/free-sequence-preview/steps', async (request, reply) => {
    const blocked = adminGuard(request, reply);
    if (blocked) return blocked;
    const parsed = createStepSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const step = await createFreeEmailSequenceStep(parsed.data);
    return { ok: true, step };
  });

  fastify.patch<{ Params: { stepId: string } }>('/email/free-sequence-preview/steps/:stepId', async (request, reply) => {
    const blocked = adminGuard(request, reply);
    if (blocked) return blocked;
    const parsed = patchStepSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    try {
      const step = await updateFreeEmailSequenceStep(request.params.stepId, parsed.data);
      return { ok: true, step };
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  fastify.delete<{ Params: { stepId: string } }>('/email/free-sequence-preview/steps/:stepId', async (request, reply) => {
    const blocked = adminGuard(request, reply);
    if (blocked) return blocked;
    try {
      return await deleteFreeEmailSequenceStep(request.params.stepId);
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  fastify.post('/email/free-sequence-preview/steps/reorder', async (request, reply) => {
    const blocked = adminGuard(request, reply);
    if (blocked) return blocked;
    const parsed = reorderSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    try {
      const steps = await reorderFreeEmailSequenceSteps(parsed.data.stepIds);
      return { ok: true, steps };
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode ?? 400;
      return reply.code(statusCode).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });
};

export default adminEmailFreeSequencePreviewRoutes;
