import { createHash, randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { RunStatus } from '@prisma/client';
import { resolvePlanKey } from './entitlements';
import { getAppBaseUrlForPublicLinks } from './app-public-url';
import { prisma } from './prisma';
import { signPortalToken } from './portal-jwt';
import { sendPortalMagicLinkEmail } from './portal-magic-link-email';

const DEFAULT_TTL_HOURS = 72;

export type PortalMagicLinkTarget = 'auto' | 'free' | 'premium';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function addHours(date: Date, hours: number): Date {
  const copy = new Date(date);
  copy.setHours(copy.getHours() + hours);
  return copy;
}

export function buildPortalMagicLinkUrl(rawToken: string): string {
  const base = getAppBaseUrlForPublicLinks();
  return `${base}/portal/acceso?token=${encodeURIComponent(rawToken)}`;
}

export async function resolvePortalMagicLinkRedirect(
  client: PrismaClient,
  userId: string,
  tenantId: string,
  target: PortalMagicLinkTarget = 'auto',
  runId?: string | null,
): Promise<string> {
  const planKey =
    target === 'free'
      ? 'free'
      : target === 'premium'
        ? 'crecimiento'
        : await resolvePlanKey(client, { tenantId, userId });

  const isPremium = planKey === 'crecimiento' || planKey === 'enterprise';

  if (runId) {
    const run = await client.run.findFirst({
      where: { id: runId, tenantId, status: RunStatus.completed },
      select: { id: true },
    });
    if (run?.id) {
      return isPremium
        ? `/portal-crecimiento/reporte/${run.id}/premium`
        : `/portal-cliente/reporte/${run.id}`;
    }
  }

  const latestRun = await client.run.findFirst({
    where: { tenantId, status: RunStatus.completed },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (isPremium) {
    if (latestRun?.id) return `/portal-crecimiento/reporte/${latestRun.id}/premium`;
    return '/portal-crecimiento';
  }

  if (latestRun?.id) return `/portal-cliente/reporte/${latestRun.id}`;
  return '/portal-cliente';
}

export async function createPortalMagicLink(input: {
  userId: string;
  createdBy: string;
  ttlHours?: number;
  redirectPath?: string | null;
}): Promise<{ rawToken: string; url: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = addHours(new Date(), input.ttlHours ?? DEFAULT_TTL_HOURS);

  await prisma.portalLoginToken.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      createdBy: input.createdBy,
      redirectPath: input.redirectPath?.trim() || null,
    },
  });

  return {
    rawToken,
    url: buildPortalMagicLinkUrl(rawToken),
    expiresAt,
  };
}

export async function consumePortalMagicLink(rawToken: string) {
  const tokenHash = hashToken(rawToken.trim());
  const now = new Date();

  const row = await prisma.portalLoginToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, email: true, tenantId: true },
      },
    },
  });

  if (!row) return { ok: false as const, error: 'Link inválido o expirado.' };
  if (row.usedAt) return { ok: false as const, error: 'Este link ya fue utilizado.' };
  if (row.expiresAt < now) return { ok: false as const, error: 'Este link expiró. Pedí uno nuevo.' };

  await prisma.portalLoginToken.update({
    where: { id: row.id },
    data: { usedAt: now },
  });

  const redirectUrl =
    row.redirectPath?.trim() ||
    (await resolvePortalMagicLinkRedirect(prisma, row.user.id, row.user.tenantId, 'auto'));

  return {
    ok: true as const,
    token: signPortalToken(row.user.id),
    expiresInSeconds: 7 * 24 * 60 * 60,
    redirectUrl,
    user: {
      id: row.user.id,
      email: row.user.email,
      tenantId: row.user.tenantId,
    },
  };
}

export async function sendPortalMagicLinkForUser(input: {
  userId?: string;
  email?: string;
  createdBy: string;
  portalTarget?: PortalMagicLinkTarget;
  runId?: string;
  ttlHours?: number;
  subject?: string;
  intro?: string;
}): Promise<{ sent: boolean; reason?: string; email?: string; magicLinkUrl?: string; redirectPath?: string }> {
  const email = input.email?.trim().toLowerCase();
  const user = input.userId
    ? await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, email: true, tenantId: true, name: true },
      })
    : email
      ? await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, tenantId: true, name: true },
        })
      : null;

  if (!user) return { sent: false, reason: 'user_not_found' };

  const target = input.portalTarget ?? 'auto';
  const redirectPath = await resolvePortalMagicLinkRedirect(
    prisma,
    user.id,
    user.tenantId,
    target,
    input.runId,
  );

  const { url, expiresAt } = await createPortalMagicLink({
    userId: user.id,
    createdBy: input.createdBy,
    ttlHours: input.ttlHours,
    redirectPath,
  });

  const mail = await sendPortalMagicLinkEmail({
    to: user.email,
    magicLinkUrl: url,
    expiresAt,
    brandOrName: user.name || user.email.split('@')[0] || 'tu empresa',
    subject: input.subject,
    intro: input.intro,
    redirectHint:
      target === 'premium' || redirectPath.includes('/portal-crecimiento')
        ? 'portal Premium'
        : 'portal cliente',
  });

  return {
    sent: mail.sent,
    reason: mail.reason,
    email: user.email,
    magicLinkUrl: url,
    redirectPath,
  };
}
