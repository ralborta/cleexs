import { EntitlementAction } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { checkEntitlement } from '../lib/entitlements';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';

const queryActorSchema = z.object({
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  visitorId: z.string().uuid().optional(),
});

const usageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: z.infer<typeof queryActorSchema> }>('/me/usage', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    let actor: { tenantId?: string; userId?: string; anonymousId?: string };
    let accountEmail: string | undefined;

    if (portalUser) {
      actor = { tenantId: portalUser.tenantId, userId: portalUser.userId };
      accountEmail = portalUser.email;
    } else if (process.env.ALLOW_USAGE_ACTOR_QUERY === 'true') {
      const parsed = queryActorSchema.safeParse(request.query ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'Parámetros inválidos para usage.' });
      actor = {
        tenantId: parsed.data.tenantId,
        userId: parsed.data.userId,
        anonymousId: parsed.data.visitorId,
      };
      if (parsed.data.userId != null) {
        const row = await prisma.user.findUnique({
          where: { id: parsed.data.userId },
          select: { email: true },
        });
        accountEmail = row?.email ?? undefined;
      }
    } else {
      return reply.code(401).send({
        error:
          'Autenticación requerida: Authorization: Bearer <token> (POST /api/auth/portal/login con email y contraseña).',
      });
    }

    const [scoreCheck, deepCheck, monthlyGenCheck] = await Promise.all([
      checkEntitlement(prisma, { actor, action: EntitlementAction.score_view }),
      checkEntitlement(prisma, { actor, action: EntitlementAction.report_deep_generate }),
      checkEntitlement(prisma, { actor, action: EntitlementAction.score_generate }),
    ]);

    return {
      actor,
      plan: scoreCheck.plan,
      planKey: scoreCheck.planKey,
      planDisplay: scoreCheck.planDisplay,
      period: 'monthly',
      usage: {
        scoreViews: scoreCheck.usage,
        deepReportsGenerated: deepCheck.usage,
      },
      limits: {
        scoreViews: scoreCheck.limit,
        deepReportsGenerated: deepCheck.limit,
      },
      permissions: {
        canViewScore: scoreCheck.allowed,
        canGenerateDeepReport: deepCheck.allowed,
        canRunMonthlyAnalysis: monthlyGenCheck.allowed,
      },
      account: accountEmail ? { email: accountEmail } : undefined,
    };
  });

  const checkSchema = z.object({
    action: z.nativeEnum(EntitlementAction),
    tenantId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    visitorId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    profileSlug: z.string().trim().min(2).max(120).optional(),
    dedupeKey: z.string().trim().min(3).max(255).optional(),
  });

  fastify.post<{ Body: z.infer<typeof checkSchema> }>('/usage/check', async (request, reply) => {
    const parsed = checkSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Payload inválido para usage/check.' });

    const actor = {
      tenantId: parsed.data.tenantId,
      userId: parsed.data.userId,
      anonymousId: parsed.data.visitorId,
    };

    const result = await checkEntitlement(prisma, {
      actor,
      action: parsed.data.action,
      brandId: parsed.data.brandId,
      profileSlug: parsed.data.profileSlug,
      dedupeKey: parsed.data.dedupeKey,
    });

    if (!result.allowed) return reply.code(403).send({ ok: false, ...result });
    return { ok: true, ...result };
  });
};

export default usageRoutes;
