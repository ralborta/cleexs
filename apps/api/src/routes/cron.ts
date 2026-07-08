import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  resolveFreeDiagnosticFollowupCandidates,
  sendFreeDiagnosticFollowup,
  wasFreeDiagnosticFollowupSent,
} from '../lib/free-diagnostic-followup';
import { runFreeOnboardingEmailBatch, wasFreeOnboardingStepSent } from '../lib/free-email-sequence-sender';
import { resolveMarketingRecipients, sendMarketingEmail, weeklyEmailForRecipient } from '../lib/marketing-email';
import { runCustomTemplateBatch, runMonthlyScoreEmailBatch } from '../lib/monthly-score-email-sender';
import { sendLeadEmail } from '../lib/lead-email-sender';
import {
  evaluateWeeklyEmailSend,
  getCurrentWeeklyWindowStart,
  weeklyCampaignSlugForWindow,
} from '../lib/weekly-email-schedule';
import { createOutreachLeadEmailDraft } from '../lib/outreach-email-builder';
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
  const cronSecret = process.env.CRON_SECRET?.trim();
  const adminSecret = process.env.ADMIN_API_SECRET?.trim();
  if (!cronSecret && !adminSecret) {
    reply.code(500).send({ error: 'CRON_SECRET o ADMIN_API_SECRET no configurado' });
    return false;
  }
  const raw = request.headers['x-cron-secret'] ?? request.headers['x-admin-secret'] ?? request.headers.authorization;
  const auth = headerString(raw);
  const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '').trim() : undefined;
  if (!token || (token !== cronSecret && token !== adminSecret)) {
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

function outreachAutoShadowLimit(): number {
  const parsed = Number(process.env.OUTREACH_AUTO_SHADOW_LIMIT || 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(50, Math.floor(parsed)) : 10;
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
      force?: boolean;
    };
  }>('/weekly-emails', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      segment: z.enum(['all', 'free', 'premium']).optional(),
      limit: z.number().int().min(1).max(1000).default(250),
      dryRun: z.boolean().default(false),
      weekSlot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      ctaUrl: z.string().url().optional(),
      force: z.boolean().default(false),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    // Schedule (singleton). El cron del workflow puede correr cada hora;
    // este guard hace que solo dispare cuando el dia/hora UTC coincidan
    // con lo configurado en /admin/email/weekly.
    let schedule = await prisma.weeklyEmailSchedule.findUnique({ where: { key: 'default' } });
    if (!schedule) {
      schedule = await prisma.weeklyEmailSchedule.create({
        data: {
          key: 'default',
          enabled: true,
          dayOfWeekUtc: 2,
          hourUtc: 13,
          segment: 'free',
          dryRun: false,
        },
      });
    }

    const nowUtc = new Date();

    const weeklyDecision = evaluateWeeklyEmailSend(schedule, {
      force: parsed.data.force,
      now: nowUtc,
    });

    if (!weeklyDecision.due) {
      return {
        ok: true,
        skipped: true,
        reason: weeklyDecision.reason,
        schedule: {
          enabled: schedule.enabled,
          dayOfWeekUtc: schedule.dayOfWeekUtc,
          hourUtc: schedule.hourUtc,
        },
        nowUtc: nowUtc.toISOString(),
        currentDow: nowUtc.getUTCDay(),
        currentHour: nowUtc.getUTCHours(),
      };
    }

    const windowStart = weeklyDecision.windowStart ?? getCurrentWeeklyWindowStart(schedule, nowUtc) ?? nowUtc;

    const effectiveSegment = parsed.data.segment ?? (schedule.segment as 'all' | 'free' | 'premium');
    const effectiveDryRun = parsed.data.dryRun || schedule.dryRun;
    const slot = parsed.data.weekSlot ?? weekSlotOfMonth(windowStart);
    const campaignSlug = weeklyCampaignSlugForWindow(windowStart, slot);

    const batchAlreadySent =
      !parsed.data.force &&
      (await prisma.cleexsInternalEmailSendLog.findFirst({
        where: { campaignSlug, status: 'sent' },
        select: { id: true },
      }));
    if (batchAlreadySent) {
      return {
        ok: true,
        skipped: true,
        reason: 'already_sent_this_week',
        campaignSlug,
        windowStart: windowStart.toISOString(),
        schedule: {
          enabled: schedule.enabled,
          dayOfWeekUtc: schedule.dayOfWeekUtc,
          hourUtc: schedule.hourUtc,
        },
        nowUtc: nowUtc.toISOString(),
      };
    }
    const recipients = await resolveMarketingRecipients({
      segment: effectiveSegment,
      limit: parsed.data.limit,
    });

    if (effectiveDryRun) {
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
        windowStart: windowStart.toISOString(),
        segment: effectiveSegment,
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
            segment: effectiveSegment,
            weekSlot: slot,
          },
        });
        sent += 1;
      } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'unsubscribed_content') {
          skipped += 1;
          continue;
        }
        failed += 1;
        if (errors.length < 20) errors.push({ email: recipient.email, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      ok: failed === 0,
      dryRun: false,
      campaignSlug,
      weekSlot: slot,
      windowStart: windowStart.toISOString(),
      segment: effectiveSegment,
      totalRecipients: recipients.length,
      sent,
      skipped,
      failed,
      errors,
    };
  });

  // POST /api/cron/monthly-score-emails
  fastify.post<{
    Body: {
      segment?: 'all' | 'free' | 'premium';
      limit?: number;
      dryRun?: boolean;
      force?: boolean;
      variant?: 'letter' | 'editorial';
    };
  }>('/monthly-score-emails', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      segment: z.enum(['all', 'free', 'premium']).optional(),
      limit: z.number().int().min(1).max(1000).default(250),
      dryRun: z.boolean().default(false),
      force: z.boolean().default(false),
      variant: z.enum(['letter', 'editorial']).optional(),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    return runMonthlyScoreEmailBatch(parsed.data);
  });

  // POST /api/cron/custom-template-batch — listas manuales (pruebas, batches nombrados).
  fastify.post<{
    Body: {
      campaignSlug: string;
      batchLabel?: string;
      emails: string[];
      variant?: 'letter' | 'editorial';
      subject?: string;
      dryRun?: boolean;
    };
  }>('/custom-template-batch', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      campaignSlug: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9-_]*$/i),
      batchLabel: z.string().trim().min(1).max(120).optional(),
      emails: z.array(z.string().email()).min(1).max(50),
      variant: z.enum(['letter', 'editorial']).default('editorial'),
      subject: z.string().trim().min(1).max(180).optional(),
      dryRun: z.boolean().default(false),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    return runCustomTemplateBatch(parsed.data);
  });

  // POST /api/cron/free-diagnostic-followup
  // Reenvía el correo con link al diagnóstico a usuarios free registrados en los últimos N días.
  // Pensado para GitHub Actions (sin n8n). Deduplica por diagnóstico vía cleexs_internal_email_send_logs.
  fastify.post<{
    Body: {
      registeredWithinDays?: number;
      minRegistrationAgeDays?: number;
      limit?: number;
      dryRun?: boolean;
      force?: boolean;
    };
  }>('/free-diagnostic-followup', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      registeredWithinDays: z.number().int().min(1).max(90).default(20),
      minRegistrationAgeDays: z.number().int().min(0).max(90).default(1),
      limit: z.number().int().min(1).max(500).default(100),
      dryRun: z.boolean().default(false),
      force: z.boolean().default(false),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const { registeredWithinDays, minRegistrationAgeDays, limit, dryRun, force } = parsed.data;
    const candidates = await resolveFreeDiagnosticFollowupCandidates({
      registeredWithinDays,
      minRegistrationAgeDays,
      limit,
    });

    if (dryRun) {
      const pending: typeof candidates = [];
      for (const candidate of candidates) {
        if (!force && (await wasFreeDiagnosticFollowupSent(candidate.diagnosticId))) continue;
        if (!force && (await wasFreeOnboardingStepSent(candidate.email, 1))) continue;
        pending.push(candidate);
      }
      return {
        ok: true,
        dryRun: true,
        registeredWithinDays,
        minRegistrationAgeDays,
        totalCandidates: candidates.length,
        wouldSend: pending.length,
        sample: pending.slice(0, 15).map((c) => ({
          email: c.email,
          diagnosticId: c.diagnosticId,
          brandName: c.brandName,
          domain: c.domain,
          registeredAt: c.createdAt.toISOString(),
        })),
      };
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ email: string; diagnosticId: string; error: string }> = [];

    for (const candidate of candidates) {
      if (!force && (await wasFreeDiagnosticFollowupSent(candidate.diagnosticId))) {
        skipped += 1;
        continue;
      }
      if (!force && (await wasFreeOnboardingStepSent(candidate.email, 1))) {
        skipped += 1;
        continue;
      }

      try {
        const result = await sendFreeDiagnosticFollowup(candidate);
        if (result.sent) {
          sent += 1;
        } else {
          skipped += 1;
        }
      } catch (e) {
        failed += 1;
        if (errors.length < 20) {
          errors.push({
            email: candidate.email,
            diagnosticId: candidate.diagnosticId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    return {
      ok: failed === 0,
      dryRun: false,
      registeredWithinDays,
      minRegistrationAgeDays,
      totalCandidates: candidates.length,
      sent,
      skipped,
      failed,
      errors,
    };
  });

  // POST /api/cron/free-onboarding-emails
  // Secuencia automática free post-diagnóstico (pasos editables en admin).
  fastify.post<{
    Body: {
      dryRun?: boolean;
      force?: boolean;
      limit?: number;
      enrolledWithinDays?: number;
    };
  }>('/free-onboarding-emails', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      dryRun: z.boolean().default(false),
      force: z.boolean().default(false),
      limit: z.number().int().min(1).max(500).default(100),
      enrolledWithinDays: z.number().int().min(7).max(180).default(60),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    return runFreeOnboardingEmailBatch(parsed.data);
  });

  // POST /api/cron/outreach-shadow
  // mode='shadow' (default seguro): manda al buzón de revisión (OUTREACH_SHADOW_TO / reply-to), nunca al competidor.
  // mode='real': envía al competidor real. Requiere OUTREACH_DOMAIN_VERIFIED=true y respeta límites diarios/por dominio.
  // El default es 'shadow' a propósito: si el endpoint se dispara sin `mode`, nunca manda real por accidente.
  fastify.post<{
    Body: {
      limit?: number;
      dryRun?: boolean;
      mode?: 'shadow' | 'real';
    };
  }>('/outreach-shadow', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      limit: z.number().int().min(1).max(50).default(outreachAutoShadowLimit()),
      dryRun: z.boolean().default(false),
      mode: z.enum(['shadow', 'real']).default('shadow'),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    const mode = parsed.data.mode;

    const candidates = await prisma.leadContact.findMany({
      where: {
        status: { notIn: ['ignored', 'sent'] },
        email: { contains: '@' },
        emails: { none: {} },
      },
      include: {
        leadSource: {
          include: {
            brand: { select: { name: true, industry: true, domain: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: parsed.data.limit,
    });

    if (parsed.data.dryRun) {
      return {
        ok: true,
        dryRun: true,
        mode,
        candidates: candidates.map((c) => ({
          leadContactId: c.id,
          email: c.email,
          competitorName: c.leadSource.competitorName,
          competitorDomain: c.leadSource.competitorDomain,
          brandName: c.leadSource.brand?.name ?? null,
          industry: c.leadSource.brand?.industry ?? null,
        })),
      };
    }

    let generated = 0;
    let sent = 0;
    let failed = 0;
    const errors: Array<{ leadContactId: string; email: string; error: string }> = [];

    for (const contact of candidates) {
      try {
        const email = await createOutreachLeadEmailDraft({
          leadSourceId: contact.leadSourceId,
          leadContactId: contact.id,
          meta: {
            automated: true,
            automation: mode === 'real' ? 'cron_outreach_real' : 'cron_outreach_shadow',
          },
        });
        generated += 1;

        await sendLeadEmail({
          leadEmailId: email.id,
          mode,
        });
        sent += 1;
      } catch (e) {
        failed += 1;
        if (errors.length < 20) {
          errors.push({
            leadContactId: contact.id,
            email: contact.email,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    return {
      ok: failed === 0,
      dryRun: false,
      mode,
      candidates: candidates.length,
      generated,
      sent,
      failed,
      errors,
    };
  });
};

export default cronRoutes;
