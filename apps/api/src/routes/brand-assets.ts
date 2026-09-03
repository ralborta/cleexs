import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveBrandAsset } from '../lib/brand-assets';

const bodySchema = z.object({
  domain: z.string().min(1).max(253),
  brandName: z.string().trim().max(120).optional(),
  refresh: z.boolean().optional(),
});

const querySchema = z.object({
  domain: z.string().min(1).max(253),
  brandName: z.string().trim().max(120).optional(),
  refresh: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional(),
});

const brandAssetsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/brand-assets/resolve', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', detail: parsed.error.flatten() });
    }
    const refresh = parsed.data.refresh === '1' || parsed.data.refresh === 'true';
    const result = await resolveBrandAsset({
      domain: parsed.data.domain,
      brandName: parsed.data.brandName,
      refresh,
    });
    if (!result) {
      return reply.code(400).send({ error: 'Dominio inválido' });
    }
    return result;
  });

  server.post('/brand-assets/resolve', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Body inválido', detail: parsed.error.flatten() });
    }
    const result = await resolveBrandAsset(parsed.data);
    if (!result) {
      return reply.code(400).send({ error: 'Dominio inválido' });
    }
    return result;
  });
};

export default brandAssetsRoutes;
