import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { planDisplayName, resolvePlanKeyFromName } from '../lib/entitlements';

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

const createOverrideSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  grantPlan: z.string().min(2).max(80),
  reason: z.string().max(500).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
});

const adminEntitlementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof createOverrideSchema> }>(
    '/entitlement-overrides',
    async (request, reply) => {
      if (!requireAdminSecret(request)) {
        return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
          error: process.env.ADMIN_API_SECRET
            ? 'No autorizado'
            : 'ADMIN_API_SECRET no configurado en el servidor',
        });
      }

      const parsed = createOverrideSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Payload inválido' });
      }

      const planKey = resolvePlanKeyFromName(parsed.data.grantPlan);
      const now = new Date();
      const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : now;
      const endsAt = parsed.data.endsAt === null ? null : parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;

      const row = await prisma.entitlementOverride.create({
        data: {
          tenantId: parsed.data.tenantId,
          userId: parsed.data.userId,
          grantPlan: parsed.data.grantPlan,
          reason: parsed.data.reason,
          startsAt,
          endsAt,
          active: true,
          createdBy: 'admin-api',
        },
      });

      return {
        ok: true,
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        grantPlan: row.grantPlan,
        planKey,
        planDisplay: planDisplayName(planKey),
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      };
    }
  );

  fastify.get<{ Querystring: { tenantId?: string; limit?: string } }>(
    '/entitlement-overrides',
    async (request, reply) => {
      if (!requireAdminSecret(request)) {
        return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
          error: process.env.ADMIN_API_SECRET
            ? 'No autorizado'
            : 'ADMIN_API_SECRET no configurado en el servidor',
        });
      }

      const tenantId = request.query.tenantId;
      const limit = Math.min(100, Math.max(1, Number(request.query.limit || '30') || 30));

      const rows = await prisma.entitlementOverride.findMany({
        where: tenantId ? { tenantId } : {},
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        userId: r.userId,
        grantPlan: r.grantPlan,
        planKey: resolvePlanKeyFromName(r.grantPlan),
        planDisplay: planDisplayName(resolvePlanKeyFromName(r.grantPlan)),
        active: r.active,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        reason: r.reason,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
      }));
    }
  );
};

export default adminEntitlementRoutes;
