import { UserRole } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import {
  PORTAL_REFERRAL_GOAL,
  ensureTenantReferralSlug,
} from '../lib/portal-referral';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';

const meReferralRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me/referral', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    if (!portalUser) {
      return reply.code(401).send({
        error:
          'Autenticación requerida: Authorization: Bearer <token> (POST /api/auth/portal/login).',
      });
    }

    const slug = await ensureTenantReferralSlug(prisma, portalUser.tenantId);
    const tenant = await prisma.tenant.findUnique({
      where: { id: portalUser.tenantId },
      select: {
        referralCount: true,
        referralRewardAt: true,
        referralUpsellDismissedAt: true,
      },
    });
    if (!tenant) return reply.code(404).send({ error: 'Tenant no encontrado.' });

    return {
      referralSlug: slug,
      goal: PORTAL_REFERRAL_GOAL,
      referralCount: tenant.referralCount,
      rewarded: Boolean(tenant.referralRewardAt),
      upsellDismissed: Boolean(tenant.referralUpsellDismissedAt),
    };
  });

  fastify.post('/me/referral/dismiss', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    if (!portalUser) {
      return reply.code(401).send({
        error:
          'Autenticación requerida: Authorization: Bearer <token> (POST /api/auth/portal/login).',
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: portalUser.userId },
      select: { role: true },
    });
    if (actor?.role !== UserRole.owner) {
      return reply.code(403).send({
        error: 'Solo el administrador de la cuenta puede ocultar este mensaje.',
      });
    }

    await prisma.tenant.update({
      where: { id: portalUser.tenantId },
      data: { referralUpsellDismissedAt: new Date() },
    });

    return { ok: true };
  });
};

export default meReferralRoutes;
