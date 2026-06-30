import { EntitlementAction, ProfileClaimStatus } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { checkEntitlement } from '../lib/entitlements';
import { prisma } from '../lib/prisma';

const claimSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  profileSlug: z.string().trim().min(2).max(120).optional(),
  claimMethod: z.enum(['corporate_email', 'manual_admin']).default('manual_admin'),
  corporateEmail: z.string().email().optional(),
  note: z.string().trim().max(400).optional(),
});

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof claimSchema> }>('/profile/claim', async (request, reply) => {
    const parsed = claimSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido para profile claim.' });
    }

    const entitlement = await checkEntitlement(prisma, {
      actor: {
        tenantId: parsed.data.tenantId,
        userId: parsed.data.userId,
      },
      action: EntitlementAction.profile_claim,
      brandId: parsed.data.brandId,
      profileSlug: parsed.data.profileSlug,
    });

    if (!entitlement.allowed) {
      return reply.code(403).send({ ok: false, ...entitlement });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: parsed.data.brandId },
      select: { id: true, domain: true },
    });
    if (!brand) return reply.code(404).send({ error: 'Marca no encontrada.' });

    const emailDomain = parsed.data.corporateEmail?.split('@')[1]?.toLowerCase();
    const brandDomain = brand.domain?.toLowerCase() || '';
    const autoApprove =
      parsed.data.claimMethod === 'corporate_email' &&
      !!emailDomain &&
      !!brandDomain &&
      (brandDomain === emailDomain || brandDomain.endsWith(`.${emailDomain}`) || emailDomain.endsWith(`.${brandDomain}`));

    const claim = await prisma.profileClaim.create({
      data: {
        tenantId: parsed.data.tenantId,
        userId: parsed.data.userId,
        brandId: parsed.data.brandId,
        profileSlug: parsed.data.profileSlug,
        claimMethod: parsed.data.claimMethod,
        corporateEmail: parsed.data.corporateEmail,
        note: parsed.data.note,
        status: autoApprove ? ProfileClaimStatus.approved : ProfileClaimStatus.pending,
        reviewedAt: autoApprove ? new Date() : null,
      },
    });

    if (autoApprove) {
      await prisma.tenantBrandAccess.upsert({
        where: {
          tenantId_brandId: {
            tenantId: parsed.data.tenantId,
            brandId: parsed.data.brandId,
          },
        },
        create: {
          tenantId: parsed.data.tenantId,
          brandId: parsed.data.brandId,
          source: 'profile_claim_auto',
        },
        update: {},
      });
    }

    return {
      ok: true,
      claimId: claim.id,
      status: claim.status,
      autoApproved: autoApprove,
    };
  });
};

export default profileRoutes;
