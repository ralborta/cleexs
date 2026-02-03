import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const normalizeSuggestion = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

type SuggestionItem = { name: string; reason?: string };

const parseSuggestions = (text: string): SuggestionItem[] => {
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf('[');
  const jsonEnd = trimmed.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    try {
      const jsonText = trimmed.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => {
            if (typeof item === 'string') {
              const name = item.trim();
              return name ? { name } : null;
            }
            if (item && typeof item === 'object') {
              const name = `${item.name || ''}`.trim();
              const reason = item.reason ? `${item.reason}`.trim() : undefined;
              return name ? { name, reason } : null;
            }
            return null;
          })
          .filter(Boolean) as SuggestionItem[];
      }
    } catch {
      // fallback a parseo por líneas
    }
  }

  return trimmed
    .split('\n')
    .map((line) => line.replace(/^[\s\-•*\d\.\)\]]+/, '').trim())
    .filter(Boolean)
    .map((name) => ({ name }));
};

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

  // POST /brands/:id/competitor-suggestions
  const suggestSchema = z.object({
    industry: z.string().optional(),
    productType: z.string().optional(),
    country: z.string().optional(),
    objective: z.string().optional(),
    useCases: z.array(z.string()).optional(),
    factors: z.array(z.string()).optional(),
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof suggestSchema> }>(
    '/:id/competitor-suggestions',
    async (request, reply) => {
      if (!process.env.OPENAI_API_KEY) {
        return reply.code(500).send({ error: 'OPENAI_API_KEY no configurada' });
      }

      const context = suggestSchema.parse(request.body || {});
      const brand = await prisma.brand.findUnique({
        where: { id: request.params.id },
        include: { aliases: true, competitors: true },
      });

      if (!brand) {
        return reply.code(404).send({ error: 'Brand no encontrado' });
      }

      const existingNames = [
        brand.name,
        ...brand.aliases.map((a) => a.alias),
        ...brand.competitors.map((c) => c.name),
      ];

      const prompt = [
        `Marca: ${brand.name}`,
        brand.domain ? `Dominio: ${brand.domain}` : null,
        context.industry ? `Industria: ${context.industry}` : null,
        context.productType ? `Producto/servicio: ${context.productType}` : null,
        context.country ? `País/mercado: ${context.country}` : null,
        context.objective ? `Objetivo: ${context.objective}` : null,
        context.useCases?.length ? `Casos de uso: ${context.useCases.join(', ')}` : null,
        context.factors?.length ? `Factores decisivos: ${context.factors.join(', ')}` : null,
        existingNames.length ? `Marcas a excluir: ${existingNames.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.4,
            max_tokens: 180,
            messages: [
              {
                role: 'system',
                content:
                  'Sos un analista de mercado. Devolvé SOLO un JSON array con 5 a 8 competidores directos, en formato: [{"name":"Marca","reason":"breve motivo"}]. No incluyas texto extra.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });

        const responseJson = (await response.json()) as any;
        if (!response.ok) {
          throw new Error(responseJson?.error?.message || 'Error en OpenAI');
        }

        const responseText = responseJson?.choices?.[0]?.message?.content?.trim() || '';
        const rawSuggestions = parseSuggestions(responseText);
        const normalizedExisting = new Set(existingNames.map(normalizeSuggestion));
        const unique: SuggestionItem[] = [];
        for (const suggestion of rawSuggestions) {
          const normalized = normalizeSuggestion(suggestion.name);
          if (!normalized || normalizedExisting.has(normalized)) continue;
          if (!unique.find((item) => normalizeSuggestion(item.name) === normalized)) {
            unique.push({ name: suggestion.name, reason: suggestion.reason });
          }
        }

        return reply.send({ suggestions: unique.slice(0, 8) });
      } catch (error: any) {
        return reply.code(500).send({ error: error?.message || 'No se pudieron sugerir competidores' });
      }
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
