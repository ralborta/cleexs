import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  isEmailUnsubscribed,
  resolveUnsubscribeFormState,
  unsubscribeMarketingEmail,
  updateEmailUnsubscribePreferences,
} from '../lib/email-unsubscribe';

const querySchema = z.object({
  email: z.string().email().optional(),
  preview: z.enum(['1', 'true']).optional(),
  from: z.enum(['content', 'monthly_score', 'weekly', 'broadcast', 'free_sequence']).optional(),
});

const legacyBodySchema = z.object({
  email: z.string().email(),
});

const preferencesBodySchema = z.object({
  email: z.string().email(),
  leaveContent: z.boolean(),
  leaveMonthlyScore: z.boolean(),
});

const emailUnsubscribeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/email/unsubscribe', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos' });
    }

    if (parsed.data.preview) {
      return {
        ok: true,
        preview: true,
        leaveContent: true,
        leaveMonthlyScore: false,
      };
    }

    const email = parsed.data.email;
    if (!email) {
      return reply.code(400).send({ error: 'Falta el parámetro email' });
    }

    const form = await resolveUnsubscribeFormState(email, parsed.data.from);

    return {
      ok: true,
      email,
      leaveContent: form.leaveContent,
      leaveMonthlyScore: form.leaveMonthlyScore,
      unsubscribed: await isEmailUnsubscribed(email),
      preferences: form.preferences,
    };
  });

  fastify.post('/email/unsubscribe', async (request, reply) => {
    const prefsParsed = preferencesBodySchema.safeParse(request.body ?? {});
    if (prefsParsed.success) {
      const result = await updateEmailUnsubscribePreferences(prefsParsed.data.email, {
        leaveContent: prefsParsed.data.leaveContent,
        leaveMonthlyScore: prefsParsed.data.leaveMonthlyScore,
      });
      return {
        ok: true,
        email: result.email,
        changed: result.changed,
        preferences: result.preferences,
        leaveContent: result.preferences.contentUnsubscribed,
        leaveMonthlyScore: result.preferences.monthlyScoreUnsubscribed,
        stillReceivingContent: !result.preferences.contentUnsubscribed,
        stillReceivingMonthlyScore: !result.preferences.monthlyScoreUnsubscribed,
      };
    }

    const legacyParsed = legacyBodySchema.safeParse(request.body ?? {});
    if (!legacyParsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: legacyParsed.error.flatten() });
    }

    const result = await unsubscribeMarketingEmail(legacyParsed.data.email);
    return { ok: true, email: result.email, unsubscribed: true, already: result.already };
  });
};

export default emailUnsubscribeRoutes;
