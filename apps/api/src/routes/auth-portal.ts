import bcrypt from 'bcryptjs';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { consumePortalMagicLink } from '../lib/portal-magic-link';
import { maybeAttachReferralForTenant } from '../lib/portal-referral';
import { prisma } from '../lib/prisma';
import { signPortalToken } from '../lib/portal-jwt';
import { resolvePortalUserFromRequest } from '../lib/portal-user';

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  referralSlug: z.string().max(64).optional(),
});

const magicConsumeBody = z.object({
  token: z.string().min(16).max(500),
});

const authPortalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof loginBody> }>('/portal/login', async (request, reply) => {
    const parsed = loginBody.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'Email o contraseña inválidos.' });

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      select: { id: true, email: true, tenantId: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      return reply.code(403).send({
        error:
          'Este usuario no tiene contraseña de portal. Ejecutá: npm run db:provision:account -- --email=TU_EMAIL --domain=tu-dominio.com --password=TU_CONTRASEÑA',
      });
    }

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'Credenciales incorrectas.' });

    await maybeAttachReferralForTenant(prisma, user.tenantId, parsed.data.referralSlug);

    let token: string;
    try {
      token = signPortalToken(user.id);
    } catch {
      return reply.code(503).send({ error: 'PORTAL_JWT_SECRET no configurado en el servidor.' });
    }

    return {
      token,
      expiresInSeconds: 7 * 24 * 60 * 60,
      user: { id: user.id, email: user.email, tenantId: user.tenantId },
    };
  });

  fastify.post<{ Body: z.infer<typeof magicConsumeBody> }>(
    '/portal/magic-link/consume',
    async (request, reply) => {
      const parsed = magicConsumeBody.safeParse(request.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'Token inválido.' });

      const result = await consumePortalMagicLink(parsed.data.token);
      if (!result.ok) return reply.code(401).send({ error: result.error });

      return {
        token: result.token,
        expiresInSeconds: result.expiresInSeconds,
        redirectUrl: result.redirectUrl,
        user: result.user,
      };
    },
  );

  fastify.get('/portal/me', async (request, reply) => {
    const u = await resolvePortalUserFromRequest(request);
    if (!u) return reply.code(401).send({ error: 'No autenticado.' });
    return { user: { id: u.userId, email: u.email, tenantId: u.tenantId } };
  });
};

export default authPortalRoutes;
