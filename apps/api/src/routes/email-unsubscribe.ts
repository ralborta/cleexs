import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isEmailUnsubscribed, unsubscribeMarketingEmail } from '../lib/email-unsubscribe';

const querySchema = z.object({
  email: z.string().email().optional(),
  preview: z.enum(['1', 'true']).optional(),
});

const bodySchema = z.object({
  email: z.string().email(),
});

const emailUnsubscribeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/email/unsubscribe', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos' });
    }

    if (parsed.data.preview) {
      return { ok: true, preview: true, unsubscribed: false };
    }

    const email = parsed.data.email;
    if (!email) {
      return reply.code(400).send({ error: 'Falta el parámetro email' });
    }

    const unsubscribed = await isEmailUnsubscribed(email);
    return { ok: true, email, unsubscribed };
  });

  fastify.post('/email/unsubscribe', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const result = await unsubscribeMarketingEmail(parsed.data.email);
    return { ok: true, email: result.email, unsubscribed: true, already: result.already };
  });
};

export default emailUnsubscribeRoutes;
