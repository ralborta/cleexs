import { createHash } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  aggregateDiagnosticsByRefCode,
  countGlobalUniqueDiagnosticEmails,
  normalizeReferralRefCode,
  SIN_REFERIDOR_LABEL,
  SIN_REFERIDOR_SLUG,
} from '../lib/referral-attribution';
import { prisma } from '../lib/prisma';

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

const trackingField = z
  .string()
  .trim()
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Solo letras, números, guión y guión bajo');

function normalizeTracking(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 120);
}

function hashValue(input: string | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function marketingBaseUrl(): string {
  return (process.env.CLEEXS_MARKETING_URL || 'https://cleexs.net').trim().replace(/\/$/, '');
}

function buildReferralTargetUrl(input: {
  refCode: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}): string {
  const search = new URLSearchParams();
  search.set('ref', input.refCode);
  if (input.utmSource?.trim()) search.set('utm_source', normalizeTracking(input.utmSource));
  if (input.utmMedium?.trim()) search.set('utm_medium', normalizeTracking(input.utmMedium));
  if (input.utmCampaign?.trim()) search.set('utm_campaign', normalizeTracking(input.utmCampaign));
  return `${marketingBaseUrl()}/?${search.toString()}`;
}

const campaignBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  refCode: trackingField,
  utmSource: trackingField.optional().or(z.literal('')),
  utmMedium: trackingField.optional().or(z.literal('')),
  utmCampaign: trackingField.optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  active: z.boolean().optional(),
});

const referralRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/referrals', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [campaigns, clicks, aggRows, totalUniqueEmailsGlobal] = await Promise.all([
      prisma.referralCampaign.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.referralClick.findMany({
        where: { createdAt: { gte: since30 } },
        select: { refCode: true, createdAt: true },
        take: 10000,
      }),
      aggregateDiagnosticsByRefCode(),
      countGlobalUniqueDiagnosticEmails(),
    ]);

    const campaignByRef = new Map(campaigns.map((c) => [c.refCode.toLowerCase(), c]));
    const aggBySlug = new Map<string, (typeof aggRows)[number]>();
    for (const row of aggRows) {
      const slug = normalizeReferralRefCode(row.ref_code);
      aggBySlug.set(slug, row);
    }

    const refs = new Set<string>();
    for (const c of campaigns) refs.add(c.refCode);
    for (const row of clicks) refs.add(row.refCode);
    for (const row of aggRows) refs.add(normalizeReferralRefCode(row.ref_code));

    let unattributedUniqueEmails = 0;

    const rows = Array.from(refs)
      .map((refCode) => {
        const campaign = campaignByRef.get(refCode);
        const agg = aggBySlug.get(refCode);
        const refClicks = clicks.filter((c) => c.refCode === refCode);
        const diagnosticsStarted = agg?.diagnostics ?? 0;
        const capturedEmails = agg?.with_email ?? 0;
        const uniqueEmails = agg?.unique_emails ?? 0;
        const completedDiagnostics = agg?.completed ?? 0;

        if (refCode === SIN_REFERIDOR_SLUG) {
          unattributedUniqueEmails = uniqueEmails;
        }

        const competitorsConfirmed = 0;
        const latestAt =
          agg?.latest_at ??
          [...refClicks.map((c) => c.createdAt)].sort((a, b) => b.getTime() - a.getTime())[0] ??
          campaign?.createdAt ??
          new Date(0);

        const targetUrl =
          refCode === SIN_REFERIDOR_SLUG
            ? ''
            : buildReferralTargetUrl({
                refCode,
                utmSource: campaign?.utmSource || 'auspiciador',
                utmMedium: campaign?.utmMedium || 'link',
                utmCampaign: campaign?.utmCampaign || refCode,
              });

        return {
          id: campaign?.id ?? null,
          registered: Boolean(campaign),
          name: refCode === SIN_REFERIDOR_SLUG ? SIN_REFERIDOR_LABEL : campaign?.name ?? refCode,
          refCode,
          active: campaign?.active ?? false,
          utmSource: campaign?.utmSource ?? null,
          utmMedium: campaign?.utmMedium ?? null,
          utmCampaign: campaign?.utmCampaign ?? null,
          notes: campaign?.notes ?? null,
          targetUrl,
          shortUrlPath: refCode === SIN_REFERIDOR_SLUG ? '' : `/r/${refCode}`,
          clicks30d: refClicks.length,
          diagnosticsStarted,
          capturedEmails,
          uniqueEmails,
          competitorsConfirmed,
          completedDiagnostics,
          completionRate:
            diagnosticsStarted > 0 ? (completedDiagnostics / diagnosticsStarted) * 100 : 0,
          upsell1: 0,
          upsell2: 0,
          agente250: 0,
          latestAt: latestAt instanceof Date ? latestAt.toISOString() : new Date(latestAt).toISOString(),
          createdAt: campaign?.createdAt.toISOString() ?? null,
          updatedAt: campaign?.updatedAt.toISOString() ?? null,
          isUnattributed: refCode === SIN_REFERIDOR_SLUG,
        };
      })
      .sort((a, b) => {
        if (a.isUnattributed && !b.isUnattributed) return 1;
        if (!a.isUnattributed && b.isUnattributed) return -1;
        if (b.uniqueEmails !== a.uniqueEmails) return b.uniqueEmails - a.uniqueEmails;
        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
      });

    return {
      generatedAt: new Date().toISOString(),
      windowDays: 30,
      summary: {
        totalUniqueEmails: totalUniqueEmailsGlobal,
        attributedUniqueEmails: Math.max(0, totalUniqueEmailsGlobal - unattributedUniqueEmails),
        unattributedUniqueEmails,
        note:
          'Emails únicos = personas distintas que dejaron email. Sin referidor = entraron sin ref en el link.',
      },
      rows,
    };
  });

  /** Crear o actualizar campaña por ref_code (desde /tools/auspiciadores o admin). */
  fastify.put('/admin/referrals/upsert', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }
    const parsed = campaignBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors.map((e) => e.message).join(', ') });
    }
    const body = parsed.data;
    const refCode = normalizeTracking(body.refCode);
    const data = {
      name: body.name.trim(),
      refCode,
      utmSource: body.utmSource ? normalizeTracking(body.utmSource) : 'auspiciador',
      utmMedium: body.utmMedium ? normalizeTracking(body.utmMedium) : 'link',
      utmCampaign: body.utmCampaign ? normalizeTracking(body.utmCampaign) : refCode,
      notes: body.notes?.trim() || null,
      active: body.active ?? true,
    };

    try {
      const existing = await prisma.referralCampaign.findUnique({ where: { refCode } });
      if (existing) {
        const campaign = await prisma.referralCampaign.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            utmSource: data.utmSource,
            utmMedium: data.utmMedium,
            utmCampaign: data.utmCampaign,
            notes: data.notes,
            active: data.active,
          },
        });
        return campaign;
      }
      const campaign = await prisma.referralCampaign.create({ data });
      return reply.code(201).send(campaign);
    } catch (err) {
      fastify.log.error({ err }, 'Error upsert referral campaign');
      return reply.code(500).send({ error: 'No se pudo guardar la campaña.' });
    }
  });

  /** Upsert masivo (migración desde historial local /tools/auspiciadores). */
  fastify.put('/admin/referrals/upsert/bulk', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }
    const bulkSchema = z.array(campaignBodySchema).max(50);
    const parsed = bulkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors.map((e) => e.message).join(', ') });
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const body of parsed.data) {
      try {
        const refCode = normalizeTracking(body.refCode);
        const data = {
          name: body.name.trim(),
          refCode,
          utmSource: body.utmSource ? normalizeTracking(body.utmSource) : 'auspiciador',
          utmMedium: body.utmMedium ? normalizeTracking(body.utmMedium) : 'link',
          utmCampaign: body.utmCampaign ? normalizeTracking(body.utmCampaign) : refCode,
          notes: body.notes?.trim() || null,
          active: body.active ?? true,
        };
        const existing = await prisma.referralCampaign.findUnique({ where: { refCode } });
        if (existing) {
          await prisma.referralCampaign.update({
            where: { id: existing.id },
            data: {
              name: data.name,
              utmSource: data.utmSource,
              utmMedium: data.utmMedium,
              utmCampaign: data.utmCampaign,
              notes: data.notes,
              active: data.active,
            },
          });
          updated += 1;
        } else {
          await prisma.referralCampaign.create({ data });
          created += 1;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error';
        errors.push(`${body.refCode}: ${msg}`);
      }
    }

    return { created, updated, total: parsed.data.length, errors };
  });

  fastify.post('/admin/referrals', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }
    const parsed = campaignBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors.map((e) => e.message).join(', ') });
    }
    const body = parsed.data;
    try {
      const refCode = normalizeTracking(body.refCode);
      const campaign = await prisma.referralCampaign.create({
        data: {
          name: body.name.trim(),
          refCode,
          utmSource: body.utmSource ? normalizeTracking(body.utmSource) : 'auspiciador',
          utmMedium: body.utmMedium ? normalizeTracking(body.utmMedium) : 'link',
          utmCampaign: body.utmCampaign ? normalizeTracking(body.utmCampaign) : refCode,
          notes: body.notes?.trim() || null,
          active: body.active ?? true,
        },
      });
      return reply.code(201).send(campaign);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear la campaña';
      if (message.includes('Unique constraint') || message.includes('ref_code')) {
        return reply.code(409).send({ error: 'Ya existe una campaña con ese ref.' });
      }
      fastify.log.error({ err }, 'Error creando referral campaign');
      return reply.code(500).send({ error: 'No se pudo crear la campaña.' });
    }
  });

  fastify.patch<{ Params: { id: string } }>('/admin/referrals/:id', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }
    const parsed = campaignBodySchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors.map((e) => e.message).join(', ') });
    }
    const body = parsed.data;
    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = body.name.trim();
    if (body.refCode != null) data.refCode = normalizeTracking(body.refCode);
    if (body.utmSource !== undefined) data.utmSource = body.utmSource ? normalizeTracking(body.utmSource) : null;
    if (body.utmMedium !== undefined) data.utmMedium = body.utmMedium ? normalizeTracking(body.utmMedium) : null;
    if (body.utmCampaign !== undefined) data.utmCampaign = body.utmCampaign ? normalizeTracking(body.utmCampaign) : null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.active !== undefined) data.active = body.active;

    try {
      const campaign = await prisma.referralCampaign.update({
        where: { id: request.params.id },
        data,
      });
      return campaign;
    } catch (err) {
      fastify.log.error({ err, id: request.params.id }, 'Error actualizando referral campaign');
      return reply.code(404).send({ error: 'Campaña no encontrada o ref duplicado.' });
    }
  });

  fastify.post<{ Params: { ref: string } }>('/referrals/:ref/click', async (request, reply) => {
    const refCode = normalizeTracking(request.params.ref);
    if (!refCode) return reply.code(400).send({ error: 'ref inválido' });

    const campaign = await prisma.referralCampaign.findUnique({ where: { refCode } });
    const targetUrl = buildReferralTargetUrl({
      refCode,
      utmSource: campaign?.utmSource || 'auspiciador',
      utmMedium: campaign?.utmMedium || 'link',
      utmCampaign: campaign?.utmCampaign || refCode,
    });

    const forwardedFor = request.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || request.ip;
    const userAgent = request.headers['user-agent'];

    await prisma.referralClick.create({
      data: {
        campaignId: campaign?.id ?? null,
        refCode,
        targetUrl,
        ipHash: hashValue(typeof ip === 'string' ? ip.split(',')[0] : undefined),
        userAgentHash: hashValue(typeof userAgent === 'string' ? userAgent : undefined),
      },
    });

    return { targetUrl, active: campaign?.active ?? true };
  });
};

export default referralRoutes;
