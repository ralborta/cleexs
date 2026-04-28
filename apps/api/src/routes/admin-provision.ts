import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { provisionAccount, randomPortalPassword } from '../lib/provision-account-core';

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

const provisionBody = z.object({
  email: z.string().email(),
  domain: z.string().min(3).max(200),
  plan: z.enum(['free', 'crecimiento']).default('crecimiento'),
  password: z.string().min(8).max(200).optional(),
  grantCourtesyCrecimiento: z.boolean().optional(),
});

const adminProvisionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof provisionBody> }>('/provision-account', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const parsed = provisionBody.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });

    const passwordFromCli = Boolean(parsed.data.password?.trim());
    const portalPassword = parsed.data.password?.trim() || randomPortalPassword();
    const plan = parsed.data.plan;
    const grantCourtesyCrecimiento =
      parsed.data.grantCourtesyCrecimiento ?? plan === 'crecimiento';

    try {
      const result = await provisionAccount(prisma, {
        email: parsed.data.email.trim().toLowerCase(),
        domain: parsed.data.domain.trim().toLowerCase(),
        plan,
        grantCourtesyCrecimiento,
        portalPassword,
        passwordFromCli,
      });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al provisionar';
      return reply.code(400).send({ error: msg });
    }
  });

  fastify.get<{ Querystring: { q?: string; limit?: string } }>('/users', async (request, reply) => {
    if (!requireAdminSecret(request)) {
      return reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
        error: process.env.ADMIN_API_SECRET ? 'No autorizado' : 'ADMIN_API_SECRET no configurado',
      });
    }

    const q = (request.query.q || '').trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 20));
    if (q.length < 2) {
      return reply.code(400).send({ error: 'Query q debe tener al menos 2 caracteres.' });
    }

    const users = await prisma.user.findMany({
      where: { email: { contains: q, mode: 'insensitive' } },
      take: limit,
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        role: true,
        passwordHash: true,
        tenant: { select: { tenantCode: true } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      tenantId: u.tenantId,
      tenantCode: u.tenant.tenantCode,
      role: u.role,
      hasPortalPassword: Boolean(u.passwordHash),
    }));
  });
};

export default adminProvisionRoutes;
