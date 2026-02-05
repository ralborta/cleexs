import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const promptRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /prompt-versions?tenantId=...
  fastify.get<{ Querystring: { tenantId: string } }>('/prompt-versions', async (request) => {
    const versions = await prisma.promptVersion.findMany({
      where: { tenantId: request.query.tenantId },
      include: {
        _count: {
          select: {
            prompts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return versions;
  });

  // POST /prompt-versions
  const createVersionSchema = z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(1),
  });

  fastify.post<{ Body: z.infer<typeof createVersionSchema> }>(
    '/prompt-versions',
    async (request, reply) => {
      const data = createVersionSchema.parse(request.body);

      // Verificar que no exista otra versión con el mismo nombre
      const existing = await prisma.promptVersion.findUnique({
        where: {
          tenantId_name: {
            tenantId: data.tenantId,
            name: data.name,
          },
        },
      });

      if (existing) {
        return reply.code(400).send({ error: 'Ya existe una versión con ese nombre' });
      }

      const version = await prisma.promptVersion.create({
        data,
      });

      return reply.code(201).send(version);
    }
  );

  // POST /prompt-versions/:id/clone
  fastify.post<{ Params: { id: string }; Body: { newName: string } }>(
    '/prompt-versions/:id/clone',
    async (request, reply) => {
      const original = await prisma.promptVersion.findUnique({
        where: { id: request.params.id },
        include: {
          prompts: {
            include: {
              category: true,
            },
          },
        },
      });

      if (!original) {
        return reply.code(404).send({ error: 'Versión no encontrada' });
      }

      // Crear nueva versión
      const newVersion = await prisma.promptVersion.create({
        data: {
          tenantId: original.tenantId,
          name: request.body.newName,
          active: true,
        },
      });

      // Clonar prompts
      await prisma.prompt.createMany({
        data: original.prompts.map((p) => ({
          promptVersionId: newVersion.id,
          categoryId: p.categoryId,
          promptText: p.promptText,
          active: p.active,
        })),
      });

      return reply.code(201).send(newVersion);
    }
  );

  // GET /prompts?versionId=...
  fastify.get<{ Querystring: { versionId: string } }>('/prompts', async (request) => {
    const prompts = await prisma.prompt.findMany({
      where: { promptVersionId: request.query.versionId },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return prompts;
  });

  // POST /prompts
  const createPromptSchema = z.object({
    promptVersionId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    promptText: z.string().min(1),
    active: z.boolean().optional().default(true),
  });

  fastify.post<{ Body: z.infer<typeof createPromptSchema> }>('/prompts', async (request, reply) => {
    const data = createPromptSchema.parse(request.body);

    const prompt = await prisma.prompt.create({
      data,
      include: {
        category: true,
      },
    });

    fastify.log.info(
      { promptId: prompt.id, promptVersionId: prompt.promptVersionId, preview: prompt.promptText.slice(0, 50) },
      'Prompt creado y guardado en DB'
    );

    return reply.code(201).send(prompt);
  });

  // GET /prompt-categories?tenantId=...
  fastify.get<{ Querystring: { tenantId: string } }>('/prompt-categories', async (request) => {
    const categories = await prisma.promptCategory.findMany({
      where: { tenantId: request.query.tenantId },
      include: {
        _count: {
          select: {
            prompts: true,
          },
        },
      },
    });

    return categories;
  });

  // POST /prompt-categories
  const createCategorySchema = z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(1),
  });

  fastify.post<{ Body: z.infer<typeof createCategorySchema> }>(
    '/prompt-categories',
    async (request, reply) => {
      const data = createCategorySchema.parse(request.body);

      // Verificar que no exista
      const existing = await prisma.promptCategory.findUnique({
        where: {
          tenantId_name: {
            tenantId: data.tenantId,
            name: data.name,
          },
        },
      });

      if (existing) {
        return reply.code(400).send({ error: 'Ya existe una categoría con ese nombre' });
      }

      const category = await prisma.promptCategory.create({
        data,
      });

      return reply.code(201).send(category);
    }
  );
};

export default promptRoutes;
