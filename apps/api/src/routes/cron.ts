import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveMarketingRecipients, sendMarketingEmail, weeklyEmailForRecipient } from '../lib/marketing-email';
import { prisma } from '../lib/prisma';

const RUN_SCHEDULE_VALUES = ['semanal', 'quincenal', 'mensual'] as const;

/** Normaliza un header a string (Fastify/Node pueden devolver string | string[]) */
function headerString(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Rutas para n8n (corridas programadas). Protegidas por CRON_SECRET.
 * GET /api/cron/scheduled-runs?frequency=semanal
 * Devuelve marcas con runSchedule = frequency y el periodo sugerido (periodStart, periodEnd).
 */
function checkCronSecret(request: { headers: { [k: string]: string | string[] | undefined } }, reply: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    reply.code(500).send({ error: 'CRON_SECRET no configurado' });
    return false;
  }
  const raw = request.headers['x-cron-secret'] ?? request.headers.authorization;
  const auth = headerString(raw);
  const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '').trim() : undefined;
  if (token !== secret) {
    reply.code(401).send({ error: 'No autorizado' });
    return false;
  }
  return true;
}

function getPeriodForFrequency(frequency: 'semanal' | 'quincenal' | 'mensual'): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);

  let periodStart: Date;
  switch (frequency) {
    case 'semanal': {
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);
      periodStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'quincenal': {
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 15);
      periodStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'mensual': {
      periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1, 0, 0, 0, 0);
      periodStart.setMonth(periodStart.getMonth() - 1);
      break;
    }
    default:
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);
      periodStart.setHours(0, 0, 0, 0);
  }

  return { periodStart, periodEnd };
}

function weekSlotOfMonth(date = new Date()): 1 | 2 | 3 | 4 {
  const slot = (Math.floor((date.getDate() - 1) / 7) % 4) + 1;
  return slot as 1 | 2 | 3 | 4;
}

function dateSlug(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

const cronRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/cron/scheduled-runs?frequency=semanal
  fastify.get<{
    Querystring: { frequency: string };
  }>('/scheduled-runs', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      frequency: z.enum(RUN_SCHEDULE_VALUES),
    });
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'frequency debe ser semanal, quincenal o mensual' });
    }

    const { frequency } = parsed.data;
    const { periodStart, periodEnd } = getPeriodForFrequency(frequency);

    const brands = await prisma.brand.findMany({
      where: { runSchedule: frequency },
      select: {
        id: true,
        tenantId: true,
        name: true,
        selectedWeeklyPortalPromptId: true,
        runSchedule: true,
      },
    });

    const items = brands.map((b) => ({
      brandId: b.id,
      tenantId: b.tenantId,
      brandName: b.name,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      selectedWeeklyPortalPromptId: b.selectedWeeklyPortalPromptId,
      /** Al crear el run, usar runType `weekly_portal` y opcionalmente weeklyPortalSavedPromptId = este valor (snapshot) */
      suggestedRunType: frequency === 'semanal' ? 'weekly_portal' : 'monthly',
    }));

    return { items, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
  });

  fastify.post<{
    Body: {
      segment?: 'all' | 'free' | 'premium';
      limit?: number;
      dryRun?: boolean;
      weekSlot?: 1 | 2 | 3 | 4;
      ctaUrl?: string;
    };
  }>('/weekly-emails', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      segment: z.enum(['all', 'free', 'premium']).default('free'),
      limit: z.number().int().min(1).max(1000).default(250),
      dryRun: z.boolean().default(false),
      weekSlot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      ctaUrl: z.string().url().optional(),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const slot = parsed.data.weekSlot ?? weekSlotOfMonth();
    const campaignSlug = `weekly-auto-w${slot}-${dateSlug()}`;
    const recipients = await resolveMarketingRecipients({
      segment: parsed.data.segment,
      limit: parsed.data.limit,
    });

    if (parsed.data.dryRun) {
      const sample = await Promise.all(
        recipients.slice(0, 10).map(async (r) => {
          const email = await weeklyEmailForRecipient(r, slot);
          return {
            email: r.email,
            subject: email.subject,
            brandName: r.brandName,
            domain: r.domain,
            cleexsScore: r.cleexsScore,
            scoreBucket: r.scoreBucket,
          };
        })
      );
      return {
        ok: true,
        dryRun: true,
        campaignSlug,
        weekSlot: slot,
        segment: parsed.data.segment,
        totalRecipients: recipients.length,
        sample,
      };
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const recipient of recipients) {
      const alreadySent = await prisma.cleexsInternalEmailSendLog.findFirst({
        where: {
          recipientEmail: recipient.email,
          campaignSlug,
          status: 'sent',
        },
        select: { id: true },
      });
      if (alreadySent) {
        skipped += 1;
        continue;
      }

      const email = await weeklyEmailForRecipient(recipient, slot);
      try {
        await sendMarketingEmail({
          recipient,
          campaignSlug,
          subject: email.subject,
          body: email.body,
          preheader: email.preheader,
          ctaLabel: 'Ver Premium',
          ctaUrl: parsed.data.ctaUrl,
          mergeSummary: {
            mode: 'weekly_auto',
            segment: parsed.data.segment,
            weekSlot: slot,
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
      weekSlot: slot,
      segment: parsed.data.segment,
      totalRecipients: recipients.length,
      sent,
      skipped,
      failed,
      errors,
    };
  });
};

export default cronRoutes;
