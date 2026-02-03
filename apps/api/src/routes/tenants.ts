import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { generateTenantPath, getTenantDescendants, canCreateRun } from '../lib/tenant';

const tenantRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /tenants/by-code/:code
  fastify.get<{ Params: { code: string } }>('/by-code/:code', async (request, reply) => {
    const tenant = await prisma.tenant.findUnique({
      where: { tenantCode: request.params.code },
      include: {
        plan: true,
      },
    });

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant no encontrado' });
    }

    return tenant;
  });

  // GET /tenants/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.params.id },
      include: {
        plan: true,
        parent: {
          select: { id: true, tenantCode: true, tenantType: true },
        },
        _count: {
          select: {
            children: true,
            brands: true,
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant no encontrado' });
    }

    return tenant;
  });

  // GET /tenants/:id/children
  fastify.get<{ Params: { id: string } }>('/:id/children', async (request, reply) => {
    const children = await prisma.tenant.findMany({
      where: { parentTenantId: request.params.id },
      include: {
        plan: true,
        _count: {
          select: {
            brands: true,
            users: true,
          },
        },
      },
    });

    return children;
  });

  // POST /tenants
  const createTenantSchema = z.object({
    tenantCode: z.string().min(1),
    parentTenantId: z.string().uuid().optional(),
    tenantType: z.enum(['AGENCY', 'DIRECT_CLIENT', 'AGENCY_CLIENT']),
    planId: z.string().uuid(),
  });

  fastify.post<{ Body: z.infer<typeof createTenantSchema> }>('/', async (request, reply) => {
    const data = createTenantSchema.parse(request.body);

    // Validar parent si existe
    let parentPath = null;
    if (data.parentTenantId) {
      const parent = await prisma.tenant.findUnique({
        where: { id: data.parentTenantId },
        select: { tenantPath: true },
      });

      if (!parent) {
        return reply.code(404).send({ error: 'Parent tenant no encontrado' });
      }

      parentPath = parent.tenantPath;
    }

    const tenantPath = generateTenantPath(parentPath, data.tenantCode);

    // Verificar que tenantCode no exista
    const existing = await prisma.tenant.findUnique({
      where: { tenantCode: data.tenantCode },
    });

    if (existing) {
      return reply.code(400).send({ error: 'tenantCode ya existe' });
    }

    const tenant = await prisma.tenant.create({
      data: {
        tenantCode: data.tenantCode,
        tenantPath,
        parentTenantId: data.parentTenantId,
        tenantType: data.tenantType,
        planId: data.planId,
      },
      include: {
        plan: true,
      },
    });

    return reply.code(201).send(tenant);
  });

  // GET /tenants/:id/usage
  fastify.get<{ Params: { id: string }; Querystring: { year?: string; month?: string } }>(
    '/:id/usage',
    async (request, reply) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.params.id },
        include: { plan: true },
      });

      if (!tenant) {
        return reply.code(404).send({ error: 'Tenant no encontrado' });
      }

      const now = new Date();
      const year = parseInt(request.query.year || String(now.getFullYear()));
      const month = parseInt(request.query.month || String(now.getMonth() + 1));

      const { getMonthlyRunConsumption } = await import('../lib/tenant.js');
      const consumption = await getMonthlyRunConsumption(tenant.id, year, month);

      const canCreate = await canCreateRun(tenant.id);

      return {
        tenantId: tenant.id,
        plan: {
          runsPerMonth: tenant.plan.runsPerMonth,
          promptsActiveLimit: tenant.plan.promptsActiveLimit,
          brandsLimit: tenant.plan.brandsLimit,
        },
        consumption: {
          runs: consumption,
          runsLimit: tenant.plan.runsPerMonth,
          canCreateRun: canCreate.allowed,
          reason: canCreate.reason,
        },
        period: { year, month },
      };
    }
  );
};

export default tenantRoutes;
