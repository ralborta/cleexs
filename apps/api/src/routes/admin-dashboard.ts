import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import {
  isResendApiKeyConfigured,
  isResendSmtpRelayConfigured,
  isSmtpOutboundConfigured,
} from '../lib/email-outbound-status';
import { prisma } from '../lib/prisma';

/** Runs auxiliares por motor (Gemini/Perplexity/Claude); no cuentan como corrida de producto. */
const DIAGNOSTIC_ENGINE_RUN_TYPES = ['diagnostic_gemini', 'diagnostic_perplexity', 'diagnostic_claude'] as const;

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

const adminDashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard-summary', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const [
      tenantsOperational,
      usersTotal,
      usersWithPortalPassword,
      brandsTotal,
      runsLast30Days,
      entitlementOverridesActive,
      referralRewardsGrantedTenants,
    ] = await Promise.all([
      prisma.tenant.count({ where: { NOT: { tenantCode: '000' } } }),
      prisma.user.count(),
      prisma.user.count({ where: { passwordHash: { not: null } } }),
      prisma.brand.count(),
      prisma.run.count({
        where: {
          createdAt: { gte: since30 },
          runType: { notIn: [...DIAGNOSTIC_ENGINE_RUN_TYPES] },
        },
      }),
      prisma.entitlementOverride.count({ where: { active: true } }),
      prisma.tenant.count({ where: { referralRewardAt: { not: null } } }),
    ]);

    let emailOps:
      | {
          campaignsConfigured: number;
          sendsLast30Days: number;
          byStatusLast30Days: Record<string, number>;
        }
      | { unavailable: true; reason?: string };

    try {
      const [campaignsConfigured, sendsLast30Days, grouped] = await Promise.all([
        prisma.cleexsInternalEmailCampaign.count(),
        prisma.cleexsInternalEmailSendLog.count({ where: { createdAt: { gte: since30 } } }),
        prisma.cleexsInternalEmailSendLog.groupBy({
          by: ['status'],
          where: { createdAt: { gte: since30 } },
          _count: { _all: true },
        }),
      ]);
      emailOps = {
        campaignsConfigured,
        sendsLast30Days,
        byStatusLast30Days: Object.fromEntries(grouped.map((g) => [g.status, g._count._all])),
      };
    } catch (e) {
      emailOps = {
        unavailable: true,
        reason: e instanceof Error ? e.message : 'email_ops_query_failed',
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      windowDays: 30,
      tenantsOperational,
      usersTotal,
      usersWithPortalPassword,
      brandsTotal,
      runsLast30Days,
      entitlementOverridesActive,
      referralRewardsGrantedTenants,
      emailOps,
      integrations: {
        resendApiKeyConfigured: isResendApiKeyConfigured(),
        resendSmtpRelayConfigured: isResendSmtpRelayConfigured(),
        smtpOutboundConfigured: isSmtpOutboundConfigured(),
      },
    };
  });
};

export default adminDashboardRoutes;
