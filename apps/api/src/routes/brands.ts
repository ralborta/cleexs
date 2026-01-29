import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const brandRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /brands?tenantId=...
  fastify.get<{ Querystring: { tenantId: string } }>('/', async (request, reply) => {
    const brands = await prisma.brand.findMany({
      where: { tenantId: request.query.tenantId },
      include: {
        aliases: true,
        competitors: true,
        _count: {
          select: {
            runs: true,
          },
        },
      },
    });

    return brands;
  });

  // GET /brands/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const brand = await prisma.brand.findUnique({
      where: { id: request.params.id },
      include: {
        aliases: true,
        competitors: true,
        tenant: {
          select: { id: true, tenantCode: true, tenantType: true },
        },
      },
    });

    if (!brand) {
      return reply.code(404).send({ error: 'Brand no encontrado' });
    }

    return brand;
  });

  // POST /brands
  const createBrandSchema = z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(1),
    domain: z.string().optional(),
    description: z.string().optional(),
    aliases: z.array(z.string()).optional(),
  });

  fastify.post<{ Body: z.infer<typeof createBrandSchema> }>('/', async (request, reply) => {
    const data = createBrandSchema.parse(request.body);

    const brand = await prisma.brand.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        domain: data.domain,
        description: data.description,
        aliases: {
          create: (data.aliases || []).map((alias) => ({ alias })),
        },
      },
      include: {
        aliases: true,
      },
    });

    return reply.code(201).send(brand);
  });

  // POST /brands/:id/aliases
  const addAliasSchema = z.object({
    alias: z.string().min(1),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof addAliasSchema> }>(
    '/:id/aliases',
    async (request, reply) => {
      const { alias } = addAliasSchema.parse(request.body);

      const brandAlias = await prisma.brandAlias.create({
        data: {
          brandId: request.params.id,
          alias,
        },
      });

      return reply.code(201).send(brandAlias);
    }
  );

  // DELETE /brands/:id/aliases/:aliasId
  fastify.delete<{ Params: { id: string; aliasId: string } }>(
    '/:id/aliases/:aliasId',
    async (request, reply) => {
      await prisma.brandAlias.delete({
        where: { id: request.params.aliasId },
      });

      return reply.code(204).send();
    }
  );

  // POST /brands/:id/competitors
  const addCompetitorSchema = z.object({
    name: z.string().min(1),
    aliases: z.array(z.string()).optional(),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof addCompetitorSchema> }>(
    '/:id/competitors',
    async (request, reply) => {
      const data = addCompetitorSchema.parse(request.body);

      const competitor = await prisma.competitor.create({
        data: {
          brandId: request.params.id,
          name: data.name,
          aliases: data.aliases || [],
        },
      });

      return reply.code(201).send(competitor);
    }
  );

  // DELETE /brands/:id/competitors/:competitorId
  fastify.delete<{ Params: { id: string; competitorId: string } }>(
    '/:id/competitors/:competitorId',
    async (request, reply) => {
      await prisma.competitor.delete({
        where: { id: request.params.competitorId },
      });

      return reply.code(204).send();
    }
  );
};

export default brandRoutes;
