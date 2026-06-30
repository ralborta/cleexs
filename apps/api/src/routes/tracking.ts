import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const optionalShort = z.string().trim().max(200).optional();

const pageviewSchema = z.object({
  path: z.string().trim().min(1).max(300),
  visitorId: z.string().trim().max(64).optional(),
  refCode: optionalShort,
  utmSource: optionalShort,
  utmMedium: optionalShort,
  utmCampaign: optionalShort,
  sourceChannel: optionalShort,
});

const shareSchema = z.object({
  channel: z.enum(['whatsapp', 'email', 'linkedin', 'x', 'copy', 'other']),
  diagnosticId: z.string().trim().max(64).optional(),
  shareSlug: z.string().trim().max(120).optional(),
  visitorId: z.string().trim().max(64).optional(),
});

const unlockClickSchema = z.object({
  unlockKey: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  diagnosticId: z.string().trim().max(64).optional(),
  visitorId: z.string().trim().max(64).optional(),
});

const emptyToUndefined = (v?: string) => {
  const t = (v || '').trim();
  return t ? t : undefined;
};

// Ingesta pública (sin auth) para el funnel de conversión interno.
// Best-effort: nunca bloquea al usuario; ante error responde 204 igual.
const trackingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: unknown }>('/track/pageview', async (request, reply) => {
    try {
      const parsed = pageviewSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(204).send();
      const d = parsed.data;
      await prisma.pageView.create({
        data: {
          path: d.path,
          visitorId: emptyToUndefined(d.visitorId),
          refCode: emptyToUndefined(d.refCode),
          utmSource: emptyToUndefined(d.utmSource),
          utmMedium: emptyToUndefined(d.utmMedium),
          utmCampaign: emptyToUndefined(d.utmCampaign),
          sourceChannel: emptyToUndefined(d.sourceChannel),
        },
      });
      return reply.code(204).send();
    } catch (err) {
      fastify.log.warn({ err }, 'track/pageview failed');
      return reply.code(204).send();
    }
  });

  fastify.post<{ Body: unknown }>('/track/share', async (request, reply) => {
    try {
      const parsed = shareSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(204).send();
      const d = parsed.data;
      await prisma.shareEvent.create({
        data: {
          channel: d.channel,
          diagnosticId: emptyToUndefined(d.diagnosticId),
          shareSlug: emptyToUndefined(d.shareSlug),
          visitorId: emptyToUndefined(d.visitorId),
        },
      });
      return reply.code(204).send();
    } catch (err) {
      fastify.log.warn({ err }, 'track/share failed');
      return reply.code(204).send();
    }
  });

  fastify.post<{ Body: unknown }>('/track/unlock-click', async (request, reply) => {
    try {
      const parsed = unlockClickSchema.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(204).send();
      const d = parsed.data;
      await prisma.unlockClickEvent.create({
        data: {
          unlockKey: d.unlockKey,
          label: d.label,
          diagnosticId: emptyToUndefined(d.diagnosticId),
          visitorId: emptyToUndefined(d.visitorId),
        },
      });
      return reply.code(204).send();
    } catch (err) {
      fastify.log.warn({ err }, 'track/unlock-click failed');
      return reply.code(204).send();
    }
  });
};

export default trackingRoutes;
