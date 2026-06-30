/**
 * Toggles de promociones / feature flags controlados desde el admin.
 *
 * Endpoints (auth admin: header `x-admin-secret: $ADMIN_API_SECRET`):
 *   GET /api/admin/promo/plan-conquistar-upsell  — estado actual del upsell en resultados
 *   PUT /api/admin/promo/plan-conquistar-upsell  — prende/apaga + ventana de fechas opcional
 */

import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  getPlanConquistarUpsellConfig,
  isPlanConquistarUpsellActive,
  setPlanConquistarUpsellConfig,
} from '../lib/promo-settings';

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

function adminAuthGuard(request: FastifyRequest, reply: any): boolean {
  if (requireAdminSecret(request)) return true;
  reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
    error: process.env.ADMIN_API_SECRET
      ? 'No autorizado'
      : 'ADMIN_API_SECRET no configurado en el servidor',
  });
  return false;
}

const upsertSchema = z.object({
  enabled: z.boolean(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  updatedBy: z.string().max(120).nullable().optional(),
});

const adminPromoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/promo/plan-conquistar-upsell', async (request, reply) => {
    if (!adminAuthGuard(request, reply)) return;
    const config = await getPlanConquistarUpsellConfig();
    return { ok: true, config, active: isPlanConquistarUpsellActive(config) };
  });

  fastify.put<{ Body: z.infer<typeof upsertSchema> }>(
    '/promo/plan-conquistar-upsell',
    async (request, reply) => {
      if (!adminAuthGuard(request, reply)) return;
      const parsed = upsertSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'payload_invalido', issues: parsed.error.issues });
      }
      if (parsed.data.startsAt && parsed.data.endsAt) {
        if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
          return reply.code(400).send({ error: 'La fecha de fin debe ser posterior a la de inicio.' });
        }
      }
      const config = await setPlanConquistarUpsellConfig(
        {
          enabled: parsed.data.enabled,
          startsAt: parsed.data.startsAt ?? null,
          endsAt: parsed.data.endsAt ?? null,
        },
        parsed.data.updatedBy ?? null
      );
      return { ok: true, config, active: isPlanConquistarUpsellActive(config) };
    }
  );
};

export default adminPromoRoutes;
