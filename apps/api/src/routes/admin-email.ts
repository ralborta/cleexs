import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import {
  CleexsEmailScoreBucket,
  CleexsEmailSendStatus,
  Prisma,
} from '@prisma/client';
import { z } from 'zod';
import { sendAdminTestEmail } from '../lib/internal-email-send';
import { prisma } from '../lib/prisma';

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

const scoreBucketSchema = z.nativeEnum(CleexsEmailScoreBucket);
const sendStatusSchema = z.nativeEnum(CleexsEmailSendStatus);

const createCampaignBody = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9-_]*$/i),
  weekIndex: z.number().int().min(1).max(52),
  scoreBucket: scoreBucketSchema,
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(8000).optional(),
  espTemplateId: z.string().trim().max(200).optional(),
  active: z.boolean().optional(),
  priority: z.number().int().min(0).max(999).optional(),
});

const patchCampaignBody = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  espTemplateId: z.string().trim().max(200).nullable().optional(),
  active: z.boolean().optional(),
  priority: z.number().int().min(0).max(999).optional(),
  weekIndex: z.number().int().min(1).max(52).optional(),
  scoreBucket: scoreBucketSchema.optional(),
});

const createLogBody = z.object({
  recipientEmail: z.string().email(),
  campaignSlug: z.string().trim().min(1).max(120),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  scoreBucket: z.string().trim().max(32).optional(),
  cleexsScore: z.number().int().min(0).max(100).optional(),
  mergeSummary: z.record(z.string(), z.any()).optional(),
  status: sendStatusSchema.optional(),
  externalId: z.string().trim().max(255).optional(),
  errorMessage: z.string().trim().max(8000).optional(),
});

const sendTestBody = z.object({
  to: z.string().email(),
});

const adminEmailRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof sendTestBody> }>('/email/send-test', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = sendTestBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    try {
      const result = await sendAdminTestEmail(parsed.data.to);
      return { ok: true, ...result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error';
      const code =
        e && typeof e === 'object' && 'statusCode' in e ? Number((e as { statusCode: unknown }).statusCode) || 502 : 502;
      return reply.code(code).send({ error: msg });
    }
  });

  fastify.post('/email/campaigns/seed-defaults', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const created: string[] = [];
    for (let w = 1; w <= 8; w += 1) {
      const slug = `weekly-seq-w${w}-all`;
      await prisma.cleexsInternalEmailCampaign.upsert({
        where: { slug },
        create: {
          slug,
          weekIndex: w,
          scoreBucket: CleexsEmailScoreBucket.all,
          title: `Semana ${w} — plantilla base (todas las bandas de score)`,
          description:
            'Definí esp_template_id en admin cuando conectes el ESP. Personalización por score: duplicá campañas con bucket low/mid/high.',
          active: true,
          priority: 0,
        },
        update: {},
      });
      created.push(slug);
    }

    return { ok: true, upsertedSlugs: created };
  });

  fastify.get('/email/campaigns', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const rows = await prisma.cleexsInternalEmailCampaign.findMany({
      orderBy: [{ weekIndex: 'asc' }, { priority: 'desc' }, { slug: 'asc' }],
    });
    return rows;
  });

  fastify.post<{ Body: z.infer<typeof createCampaignBody> }>('/email/campaigns', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = createCampaignBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    try {
      const row = await prisma.cleexsInternalEmailCampaign.create({
        data: {
          slug: parsed.data.slug,
          weekIndex: parsed.data.weekIndex,
          scoreBucket: parsed.data.scoreBucket,
          title: parsed.data.title,
          description: parsed.data.description,
          espTemplateId: parsed.data.espTemplateId,
          active: parsed.data.active ?? true,
          priority: parsed.data.priority ?? 0,
        },
      });
      return row;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'P2002') return reply.code(409).send({ error: 'Slug ya existe.' });
      throw e;
    }
  });

  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof patchCampaignBody> }>(
    '/email/campaigns/:id',
    async (request, reply) => {
      if (!requireAdminSecret(request)) {
        return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
          error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
        });
      }

      const parsed = patchCampaignBody.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
      }

      const id = request.params.id?.trim();
      if (!id) return reply.code(400).send({ error: 'id requerido' });

      const data: Prisma.CleexsInternalEmailCampaignUpdateInput = {};
      if (parsed.data.title !== undefined) data.title = parsed.data.title;
      if (parsed.data.description !== undefined) data.description = parsed.data.description;
      if (parsed.data.espTemplateId !== undefined) data.espTemplateId = parsed.data.espTemplateId;
      if (parsed.data.active !== undefined) data.active = parsed.data.active;
      if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
      if (parsed.data.weekIndex !== undefined) data.weekIndex = parsed.data.weekIndex;
      if (parsed.data.scoreBucket !== undefined) data.scoreBucket = parsed.data.scoreBucket;

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'Nada para actualizar.' });
      }

      try {
        const row = await prisma.cleexsInternalEmailCampaign.update({
          where: { id },
          data,
        });
        return row;
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'P2025') return reply.code(404).send({ error: 'Campaña no encontrada.' });
        throw e;
      }
    },
  );

  fastify.get<{ Querystring: { limit?: string; campaignSlug?: string } }>('/email/logs', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 50));
    const campaignSlug = (request.query.campaignSlug || '').trim();

    const where: Prisma.CleexsInternalEmailSendLogWhereInput = {};
    if (campaignSlug) where.campaignSlug = campaignSlug;

    const rows = await prisma.cleexsInternalEmailSendLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows;
  });

  fastify.post<{ Body: z.infer<typeof createLogBody> }>('/email/logs', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = createLogBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const row = await prisma.cleexsInternalEmailSendLog.create({
      data: {
        recipientEmail: parsed.data.recipientEmail.toLowerCase(),
        campaignSlug: parsed.data.campaignSlug,
        userId: parsed.data.userId,
        tenantId: parsed.data.tenantId,
        scoreBucket: parsed.data.scoreBucket,
        cleexsScore: parsed.data.cleexsScore,
        ...(parsed.data.mergeSummary !== undefined ? { mergeSummary: parsed.data.mergeSummary } : {}),
        status: parsed.data.status ?? CleexsEmailSendStatus.pending,
        externalId: parsed.data.externalId,
        errorMessage: parsed.data.errorMessage,
      },
    });
    return row;
  });

  fastify.get('/email/stats', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const grouped = await prisma.cleexsInternalEmailSendLog.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });

    const campaigns = await prisma.cleexsInternalEmailCampaign.count();
    const logsTotal = await prisma.cleexsInternalEmailSendLog.count();

    return {
      windowDays: 30,
      campaignsConfigured: campaigns,
      logsAllTime: logsTotal,
      byStatusLast30Days: Object.fromEntries(grouped.map((g) => [g.status, g._count._all])),
    };
  });
};

export default adminEmailRoutes;
