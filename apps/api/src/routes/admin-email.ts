import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import {
  CleexsEmailScoreBucket,
  CleexsEmailSendStatus,
  CleexsEmailTemplateVariant,
  Prisma,
} from '@prisma/client';
import { z } from 'zod';
import { sendInternalCampaignTestEmail } from '../lib/internal-email-campaign-send';
import { sendAdminTestEmail } from '../lib/internal-email-send';
import {
  buildCleexsEmail,
  buildCleexsEmailPreviewExample,
  buildMonthlyScoreDiagnosticUrl,
  buildMonthlyScorePlansUrl,
} from '../lib/monthly-score-email';
import { resolveMarketingRecipients, sendMarketingEmail } from '../lib/marketing-email';
import { getAppBaseUrlForPublicLinks } from '../lib/app-public-url';
import { buildTransactionalFromAddress, isEmailConfigured, isEmailDisabled, sendSmtpMail } from '../lib/email';
import { Resend } from 'resend';
import { buildResendWebhookStats } from '../lib/resend-webhook-stats';
import { getEmailBatchDetail, listEmailBatches } from '../lib/email-batch-status';
import {
  buildEmailCampaignAnalytics,
  listEmailCampaignAnalyticsRecipients,
  type EmailAnalyticsDetailFilter,
} from '../lib/email-campaign-analytics';
import { runCustomTemplateBatch } from '../lib/monthly-score-email-sender';
import { prisma } from '../lib/prisma';
import { resolveConversionRange } from '@cleexs/shared';

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
  templateVariant: z.enum(['letter', 'editorial']).optional(),
});

const patchCampaignBody = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  espTemplateId: z.string().trim().max(200).nullable().optional(),
  active: z.boolean().optional(),
  priority: z.number().int().min(0).max(999).optional(),
  weekIndex: z.number().int().min(1).max(52).optional(),
  scoreBucket: scoreBucketSchema.optional(),
  subject: z.string().trim().max(300).nullable().optional(),
  body: z.string().trim().max(20000).nullable().optional(),
  preheader: z.string().trim().max(500).nullable().optional(),
  templateVariant: z.enum(['letter', 'editorial']).optional(),
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

const sendCampaignTestBody = z.object({
  to: z.string().email(),
  campaignId: z.string().uuid(),
});

const templatePreviewQuery = z.object({
  variant: z.enum(['letter', 'editorial']).default('letter'),
  score: z
    .string()
    .optional()
    .transform((v) => {
      if (v == null || v.trim() === '') return 62;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(Math.max(0, Math.min(100, n))) : 62;
    }),
  domain: z.string().trim().max(200).optional().default('empliados.net'),
  brandName: z.string().trim().max(200).optional().default('Empliados'),
});

const monthlyScorePreviewQuery = templatePreviewQuery;

const templateTestBody = z.object({
  to: z.string().email(),
  variant: z.enum(['letter', 'editorial']).default('letter'),
  score: z.number().int().min(0).max(100).optional(),
  domain: z.string().trim().max(200).optional(),
  brandName: z.string().trim().max(200).optional(),
});

const monthlyScoreTestBody = templateTestBody;

const customBatchSendBody = z.object({
  campaignSlug: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9-_]*$/i),
  batchLabel: z.string().trim().min(1).max(120).optional(),
  emails: z.array(z.string().email()).min(1).max(50),
  variant: z.enum(['letter', 'editorial']).default('editorial'),
  subject: z.string().trim().min(1).max(180).optional(),
  dryRun: z.boolean().default(false),
});

const broadcastBody = z.object({
  subject: z.string().trim().min(3).max(180),
  body: z.string().trim().min(3).max(8000),
  segment: z.enum(['all', 'free', 'premium']).default('free'),
  ctaLabel: z.string().trim().min(1).max(80).optional(),
  ctaUrl: z.string().url().optional(),
  campaignSlug: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9-_]*$/i).optional(),
  limit: z.number().int().min(1).max(1000).default(250),
  dryRun: z.boolean().default(true),
});

function todaySlugPart() {
  return new Date().toISOString().slice(0, 10);
}

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

  fastify.post<{ Body: z.infer<typeof sendCampaignTestBody> }>('/email/send-campaign-test', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = sendCampaignTestBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const campaign = await prisma.cleexsInternalEmailCampaign.findUnique({
      where: { id: parsed.data.campaignId },
    });
    if (!campaign) {
      return reply.code(404).send({ error: 'Campaña no encontrada' });
    }

    try {
      const result = await sendInternalCampaignTestEmail(parsed.data.to, campaign);
      return { ok: true, slug: campaign.slug, ...result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code =
        e && typeof e === 'object' && 'statusCode' in e ? Number((e as { statusCode: unknown }).statusCode) || 502 : 502;
      return reply.code(code).send({ error: msg });
    }
  });

  fastify.post<{ Body: z.infer<typeof broadcastBody> }>('/email/broadcast', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = broadcastBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const campaignSlug = parsed.data.campaignSlug || `broadcast-${todaySlugPart()}`;
    const recipients = await resolveMarketingRecipients({
      segment: parsed.data.segment,
      limit: parsed.data.limit,
    });

    if (parsed.data.dryRun) {
      return {
        ok: true,
        dryRun: true,
        campaignSlug,
        segment: parsed.data.segment,
        totalRecipients: recipients.length,
        sample: recipients.slice(0, 10).map((r) => ({
          email: r.email,
          planName: r.planName,
          brandName: r.brandName,
          domain: r.domain,
          cleexsScore: r.cleexsScore,
          scoreBucket: r.scoreBucket,
        })),
      };
    }

    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      const alreadySent = await prisma.cleexsInternalEmailSendLog.findFirst({
        where: {
          recipientEmail: recipient.email,
          campaignSlug,
          status: CleexsEmailSendStatus.sent,
        },
        select: { id: true },
      });
      if (alreadySent) continue;

      try {
        await sendMarketingEmail({
          recipient,
          campaignSlug,
          subject: parsed.data.subject,
          body: parsed.data.body,
          ctaLabel: parsed.data.ctaLabel,
          ctaUrl: parsed.data.ctaUrl,
          mergeSummary: {
            mode: 'admin_broadcast',
            segment: parsed.data.segment,
          },
        });
        sent += 1;
      } catch (e) {
        failed += 1;
        if (errors.length < 20) errors.push({ email: recipient.email, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      ok: failed === 0,
      dryRun: false,
      campaignSlug,
      segment: parsed.data.segment,
      totalRecipients: recipients.length,
      sent,
      failed,
      errors,
    };
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
            'Incluye HTML por defecto al probar desde admin (sin id Resend). Con plantilla en Resend: definí esp_template_id y variables WEEK, TITLE, PREHEADER, SLUG. Personalización por score: duplicá campañas con bucket low/mid/high.',
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
          templateVariant:
            parsed.data.templateVariant === 'editorial'
              ? CleexsEmailTemplateVariant.editorial
              : CleexsEmailTemplateVariant.letter,
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
      if (parsed.data.subject !== undefined) data.subject = parsed.data.subject;
      if (parsed.data.body !== undefined) data.body = parsed.data.body;
      if (parsed.data.preheader !== undefined) data.preheader = parsed.data.preheader;
      if (parsed.data.templateVariant !== undefined) {
        data.templateVariant =
          parsed.data.templateVariant === 'editorial'
            ? CleexsEmailTemplateVariant.editorial
            : CleexsEmailTemplateVariant.letter;
      }

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

  fastify.get('/email/monthly-score/preview', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = monthlyScorePreviewQuery.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Query inválido', details: parsed.error.flatten() });
    }

    const built = buildCleexsEmailPreviewExample({
      variant: 'editorial',
      score: parsed.data.score,
      domain: parsed.data.domain,
      brandName: parsed.data.brandName,
    });
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return built.html;
  });

  fastify.get('/email/templates/preview', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = templatePreviewQuery.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Query inválido', details: parsed.error.flatten() });
    }

    const built = buildCleexsEmailPreviewExample({
      variant: parsed.data.variant,
      score: parsed.data.score,
      domain: parsed.data.domain,
      brandName: parsed.data.brandName,
    });
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return built.html;
  });

  fastify.get('/email/monthly-score/preview.json', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = monthlyScorePreviewQuery.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Query inválido', details: parsed.error.flatten() });
    }

    const built = buildCleexsEmailPreviewExample({
      variant: 'editorial',
      score: parsed.data.score,
      domain: parsed.data.domain,
      brandName: parsed.data.brandName,
    });
    return {
      ok: true,
      variant: built.variant,
      subject: built.subject,
      html: built.html,
      text: built.text,
      assets: built.assets,
      sampleScore: parsed.data.score,
      sampleDomain: parsed.data.domain,
      sampleBrandName: parsed.data.brandName,
      newDiagnosticUrl: buildMonthlyScoreDiagnosticUrl(),
      plansUrl: buildMonthlyScorePlansUrl(),
    };
  });

  fastify.get('/email/templates/preview.json', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = templatePreviewQuery.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Query inválido', details: parsed.error.flatten() });
    }

    const built = buildCleexsEmailPreviewExample({
      variant: parsed.data.variant,
      score: parsed.data.score,
      domain: parsed.data.domain,
      brandName: parsed.data.brandName,
    });
    return {
      ok: true,
      variant: built.variant,
      subject: built.subject,
      html: built.html,
      text: built.text,
      assets: built.assets,
      sampleScore: parsed.data.score,
      sampleDomain: parsed.data.domain,
      sampleBrandName: parsed.data.brandName,
      newDiagnosticUrl: buildMonthlyScoreDiagnosticUrl(),
      plansUrl: buildMonthlyScorePlansUrl(),
    };
  });

  fastify.post<{ Body: z.infer<typeof templateTestBody> }>(
    '/email/templates/send-test',
    async (request, reply) => {
      if (!requireAdminSecret(request)) {
        return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
          error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
        });
      }

      const parsed = templateTestBody.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
      }

      if (isEmailDisabled()) {
        return reply.code(400).send({ error: 'Envíos deshabilitados (DISABLE_EMAILS).' });
      }

      const base = getAppBaseUrlForPublicLinks();
      const built = buildCleexsEmail({
        variant: parsed.data.variant,
        personalization: {
          score: parsed.data.score ?? 62,
          domain: parsed.data.domain ?? 'empliados.net',
          brandName: parsed.data.brandName ?? 'Empliados',
        },
        links: {
          newDiagnosticUrl: buildMonthlyScoreDiagnosticUrl(base),
          reportUrl: `${base.replace(/\/+$/, '')}/ver-resultado?diagnosticId=preview-example`,
          shareUrl: `${base.replace(/\/+$/, '')}/score/ejemplo-preview`,
          plansUrl: buildMonthlyScorePlansUrl(base),
          unsubscribeUrl: `${base.replace(/\/+$/, '')}/email/unsubscribe?example=1`,
        },
        showFounderSignature: true,
        showScoreBlock: true,
        showReportLinks: true,
      });

      const to = parsed.data.to.trim().toLowerCase();
      const from = buildTransactionalFromAddress();
      const apiKey = process.env.RESEND_API_KEY?.trim();

      try {
        if (apiKey) {
          const resend = new Resend(apiKey);
          const { data, error } = await resend.emails.send({
            from,
            to: [to],
            subject: built.subject,
            html: built.html,
            text: built.text,
            headers: { 'X-Cleexs-Campaign': `template-${parsed.data.variant}-test` },
          });
          if (error) throw new Error(typeof error === 'object' && error && 'message' in error ? String((error as { message: string }).message) : String(error));
          return { ok: true, provider: 'resend_inline', variant: built.variant, externalId: data?.id ?? null, subject: built.subject };
        }
        if (isEmailConfigured()) {
          const info = await sendSmtpMail({ to, subject: built.subject, html: built.html, text: built.text });
          return { ok: true, provider: 'smtp', variant: built.variant, externalId: info.messageId ?? null, subject: built.subject };
        }
        return reply.code(503).send({ error: 'Sin canal de envío: configurá RESEND_API_KEY o SMTP completo.' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.code(502).send({ error: msg });
      }
    }
  );

  fastify.post<{ Body: z.infer<typeof monthlyScoreTestBody> }>(
    '/email/monthly-score/send-test',
    async (request, reply) => {
      if (!requireAdminSecret(request)) {
        return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
          error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
        });
      }

      const parsed = monthlyScoreTestBody.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
      }

      if (isEmailDisabled()) {
        return reply.code(400).send({ error: 'Envíos deshabilitados (DISABLE_EMAILS).' });
      }

      const base = getAppBaseUrlForPublicLinks();
      const variant = parsed.data.variant ?? 'editorial';
      const built = buildCleexsEmail({
        variant,
        personalization: {
          score: parsed.data.score ?? 62,
          domain: parsed.data.domain ?? 'empliados.net',
          brandName: parsed.data.brandName ?? 'Empliados',
        },
        links: {
          newDiagnosticUrl: buildMonthlyScoreDiagnosticUrl(base),
          reportUrl: `${base.replace(/\/+$/, '')}/ver-resultado?diagnosticId=preview-example`,
          shareUrl: `${base.replace(/\/+$/, '')}/score/ejemplo-preview`,
          plansUrl: buildMonthlyScorePlansUrl(base),
          unsubscribeUrl: `${base.replace(/\/+$/, '')}/email/unsubscribe?example=1`,
        },
        showFounderSignature: true,
        showScoreBlock: true,
        showReportLinks: variant === 'letter',
      });

      const to = parsed.data.to.trim().toLowerCase();
      const from = buildTransactionalFromAddress();
      const apiKey = process.env.RESEND_API_KEY?.trim();

      try {
        if (apiKey) {
          const resend = new Resend(apiKey);
          const { data, error } = await resend.emails.send({
            from,
            to: [to],
            subject: built.subject,
            html: built.html,
            text: built.text,
            headers: { 'X-Cleexs-Campaign': 'monthly-score-preview-test' },
          });
          if (error) throw new Error(typeof error === 'object' && error && 'message' in error ? String((error as { message: string }).message) : String(error));
          return { ok: true, provider: 'resend_inline', variant: built.variant, externalId: data?.id ?? null, subject: built.subject };
        }
        if (isEmailConfigured()) {
          const info = await sendSmtpMail({ to, subject: built.subject, html: built.html, text: built.text });
          return { ok: true, provider: 'smtp', variant: built.variant, externalId: info.messageId ?? null, subject: built.subject };
        }
        return reply.code(503).send({ error: 'Sin canal de envío: configurá RESEND_API_KEY o SMTP completo.' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.code(502).send({ error: msg });
      }
    }
  );

  fastify.get('/email/batches', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const q = z
      .object({ limit: z.coerce.number().int().min(5).max(60).optional() })
      .safeParse(request.query);
    const limit = q.success ? q.data.limit : undefined;
    const batches = await listEmailBatches(limit ?? 30);
    return { batches };
  });

  fastify.get<{ Params: { campaignSlug: string } }>('/email/batches/:campaignSlug', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const slug = decodeURIComponent(request.params.campaignSlug).trim();
    if (!slug) {
      return reply.code(400).send({ error: 'campaignSlug requerido' });
    }

    const detail = await getEmailBatchDetail(slug);
    if (detail.recipients.length === 0) {
      return reply.code(404).send({ error: 'Batch no encontrado' });
    }
    return detail;
  });

  fastify.get<{ Querystring: { from?: string; to?: string } }>('/email/analytics', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const { from, to, fromDay, toDay } = resolveConversionRange(request.query, 7);
    return buildEmailCampaignAnalytics({ from, to, fromDay, toDay });
  });

  fastify.get<{
    Querystring: { from?: string; to?: string; filter?: string };
  }>('/email/analytics/recipients', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const filterSchema = z.enum([
      'sent',
      'delivered',
      'opened',
      'clicked',
      'clicked_plans',
      'clicked_diagnostic',
      'clicked_report',
      'clicked_share',
      'clicked_other',
      'purchased',
    ]);
    const parsedFilter = filterSchema.safeParse(request.query.filter);
    if (!parsedFilter.success) {
      return reply.code(400).send({ error: 'filter inválido' });
    }

    const { from, to } = resolveConversionRange(request.query, 7);
    const items = await listEmailCampaignAnalyticsRecipients({
      from,
      to,
      filter: parsedFilter.data as EmailAnalyticsDetailFilter,
    });
    return { ok: true, filter: parsedFilter.data, total: items.length, items };
  });

  fastify.post<{ Body: z.infer<typeof customBatchSendBody> }>('/email/batches/send', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = customBatchSendBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    if (isEmailDisabled()) {
      return reply.code(400).send({ error: 'Envíos deshabilitados (DISABLE_EMAILS).' });
    }

    return runCustomTemplateBatch(parsed.data);
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

    const resendWebhook = await buildResendWebhookStats(30);

    return {
      windowDays: 30,
      campaignsConfigured: campaigns,
      logsAllTime: logsTotal,
      byStatusLast30Days: Object.fromEntries(grouped.map((g) => [g.status, g._count._all])),
      resendWebhook,
    };
  });
};

export default adminEmailRoutes;
