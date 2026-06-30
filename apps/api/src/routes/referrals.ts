import { createHash } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
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

function hasConfirmedCompetitors(setupDraftJson: unknown): boolean {
  if (!setupDraftJson || typeof setupDraftJson !== 'object' || Array.isArray(setupDraftJson)) return false;
  const draft = setupDraftJson as Record<string, unknown>;
  const confirmed = draft.confirmedCompetitorUrls;
  return Array.isArray(confirmed) && confirmed.some((x) => typeof x === 'string' && x.trim());
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
    const [campaigns, clicks, diagnostics] = await Promise.all([
      prisma.referralCampaign.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.referralClick.findMany({
        where: { createdAt: { gte: since30 } },
        select: { refCode: true, createdAt: true },
        take: 10000,
      }),
      prisma.publicDiagnostic.findMany({
        where: { refCode: { not: null } },
        select: {
          refCode: true,
          status: true,
          email: true,
          setupDraftJson: true,
          sourceChannel: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
    ]);

    const campaignByRef = new Map(campaigns.map((c) => [c.refCode, c]));
    const refs = new Set<string>(campaigns.map((c) => c.refCode));
    for (const row of clicks) refs.add(row.refCode);
    for (const row of diagnostics) if (row.refCode) refs.add(row.refCode.trim().toLowerCase());

    const rows = Array.from(refs)
      .map((refCode) => {
        const campaign = campaignByRef.get(refCode);
        const refClicks = clicks.filter((c) => c.refCode === refCode);
        const refDiagnostics = diagnostics.filter((d) => d.refCode?.trim().toLowerCase() === refCode);
        const completed = refDiagnostics.filter((d) => d.status === 'completed').length;
        const capturedEmails = refDiagnostics.filter(
          (d) => d.email && !d.email.endsWith('@whatsapp.cleexs.net')
        ).length;
        const competitorsConfirmed = refDiagnostics.filter((d) => hasConfirmedCompetitors(d.setupDraftJson)).length;
        const latestAt =
          [...refClicks.map((c) => c.createdAt), ...refDiagnostics.map((d) => d.createdAt)].sort(
            (a, b) => b.getTime() - a.getTime()
          )[0] ?? campaign?.createdAt ?? new Date(0);
        const targetUrl = buildReferralTargetUrl({
          refCode,
          utmSource: campaign?.utmSource || 'auspiciador',
          utmMedium: campaign?.utmMedium || 'link',
          utmCampaign: campaign?.utmCampaign || refCode,
        });
        return {
          id: campaign?.id ?? null,
          registered: Boolean(campaign),
          name: campaign?.name ?? refCode,
          refCode,
          active: campaign?.active ?? false,
          utmSource: campaign?.utmSource ?? null,
          utmMedium: campaign?.utmMedium ?? null,
          utmCampaign: campaign?.utmCampaign ?? null,
          notes: campaign?.notes ?? null,
          targetUrl,
          shortUrlPath: `/r/${refCode}`,
          clicks30d: refClicks.length,
          diagnosticsStarted: refDiagnostics.length,
          capturedEmails,
          competitorsConfirmed,
          completedDiagnostics: completed,
          completionRate:
            refDiagnostics.length > 0 ? (completed / refDiagnostics.length) * 100 : 0,
          upsell1: 0,
          upsell2: 0,
          agente250: 0,
          latestAt: latestAt.toISOString(),
          createdAt: campaign?.createdAt.toISOString() ?? null,
          updatedAt: campaign?.updatedAt.toISOString() ?? null,
        };
      })
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());

    return { generatedAt: new Date().toISOString(), windowDays: 30, rows };
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
