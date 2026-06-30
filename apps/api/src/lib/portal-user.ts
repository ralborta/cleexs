import type { FastifyRequest } from 'fastify';
import { prisma } from './prisma';
import { verifyPortalToken } from './portal-jwt';

export type ResolvedPortalUser = {
  userId: string;
  tenantId: string;
  email: string;
};

/** Usuario autenticado vía Bearer (portal). */
export async function resolvePortalUserFromRequest(request: FastifyRequest): Promise<ResolvedPortalUser | null> {
  const raw = request.headers.authorization;
  if (!raw?.startsWith('Bearer ')) return null;
  const token = raw.slice('Bearer '.length).trim();
  if (!token) return null;
  const v = verifyPortalToken(token);
  if (!v) return null;
  const user = await prisma.user.findUnique({
    where: { id: v.userId },
    select: { id: true, email: true, tenantId: true },
  });
  if (!user) return null;
  return { userId: user.id, tenantId: user.tenantId, email: user.email };
}
