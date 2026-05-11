import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { resolvePortalUserFromRequest } from '../lib/portal-user';
import {
  classifyDomain,
  normalizeDomain,
} from '../lib/classifier';
import { resolveBrandAnalysisContext } from '../lib/diagnostic-ai';
import { buildDiagnosticPrompts, getIntentionForIndustry } from '../lib/diagnostic-prompts';

const normalizeSuggestion = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

function deriveBrandNameFromDomain(domain: string): string {
  const root = normalizeDomain(domain).split('.')[0] || domain;
  return root
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type SuggestionItem = { name: string; reason?: string };

const parseSuggestions = (text: string): SuggestionItem[] => {
  let trimmed = text.trim();
  // Quitar posible markdown ```json ... ```
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) trimmed = codeBlock[1].trim();
  const jsonStart = trimmed.indexOf('[');
  const jsonEnd = trimmed.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    try {
      let jsonText = trimmed.slice(jsonStart, jsonEnd + 1);
      // Quitar coma final antes de ] (JSON inválido pero común en LLMs)
      jsonText = jsonText.replace(/,(\s*])/g, '$1');
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
  // GET /brands — con Bearer (portal) usa el tenant del usuario; legacy opcional con ?tenantId=
  fastify.get<{ Querystring: { tenantId?: string } }>('/', async (request, reply) => {
    const portalUser = await resolvePortalUserFromRequest(request);
    let tenantId: string | undefined;
    if (portalUser) tenantId = portalUser.tenantId;
    else if (process.env.ALLOW_USAGE_ACTOR_QUERY === 'true' && request.query.tenantId) {
      tenantId = request.query.tenantId;
    }
    if (!tenantId) {
      return reply.code(401).send({
        error:
          'Autenticación requerida: Authorization: Bearer <token>, o ?tenantId= con ALLOW_USAGE_ACTOR_QUERY=true.',
      });
    }

    const brands = await prisma.brand.findMany({
      where: { tenantId },
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

  // PATCH /brands/:id — actualizar runSchedule (corridas programadas: semanal, quincenal, mensual)
  const patchBrandSchema = z.object({
    runSchedule: z.enum(['semanal', 'quincenal', 'mensual']).nullable(),
  });

  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof patchBrandSchema> }>(
    '/:id',
    async (request, reply) => {
      const data = patchBrandSchema.parse(request.body);
      const brand = await prisma.brand.update({
        where: { id: request.params.id },
        data: {
          ...(data.runSchedule !== undefined && { runSchedule: data.runSchedule }),
        },
        include: {
          aliases: true,
          competitors: true,
          tenant: { select: { id: true, tenantCode: true } },
        },
      });
      return brand;
    }
  );

  // POST /brands
  const createBrandSchema = z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(1),
    domain: z.string().optional(),
    industry: z.string().optional(),
    productType: z.string().optional(),
    country: z.string().optional(),
    objective: z.string().optional(),
    description: z.string().optional(),
    aliases: z.array(z.string()).optional(),
  });

  fastify.post<{ Body: z.infer<typeof createBrandSchema> }>('/', async (request, reply) => {
    const data = createBrandSchema.parse(request.body);

    const brand = await prisma.brand.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        domain: data.domain ? normalizeDomain(data.domain) : null,
        industry: data.industry,
        productType: data.productType,
        country: data.country,
        objective: data.objective,
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
    domain: z.string().optional(),
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
          domain: data.domain ? normalizeDomain(data.domain) : null,
          aliases: data.aliases || [],
        },
      });

      return reply.code(201).send(competitor);
    }
  );

  // POST /brands/auto-create
  // Crea marca + competidores + prompt version + prompts a partir de UN dominio.
  const autoCreateSchema = z.object({
    tenantId: z.string().uuid(),
    domain: z.string().min(3),
    promptCount: z.number().min(3).max(20).optional().default(10),
    versionName: z.string().optional(),
  });

  fastify.post<{ Body: z.infer<typeof autoCreateSchema> }>(
    '/auto-create',
    async (request, reply) => {
      if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
        return reply.code(500).send({ error: 'No hay API key de clasificacion configurada' });
      }

      const data = autoCreateSchema.parse(request.body);
      const normalizedDomain = normalizeDomain(data.domain);

      // 1. Clasificación liviana para nombre/tipo; el contexto real se resuelve desde el sitio.
      let classification;
      try {
        classification = await classifyDomain(normalizedDomain);
      } catch (err: any) {
        return reply.code(500).send({ error: err?.message || 'Error clasificando dominio' });
      }

      const brandName =
        `${classification.brandName || ''}`.trim() ||
        deriveBrandNameFromDomain(normalizedDomain) ||
        normalizedDomain;
      const analysisContext = await resolveBrandAnalysisContext({
        brandName,
        websiteUrl: normalizedDomain,
        fallbackIndustry: classification.category || 'General',
      });
      const competitorCandidates = analysisContext.competitors.map((c) => ({
        domain: c.domain ?? '',
        name: c.name,
        reason: 'Detectado desde contexto real del sitio',
      }));
      const intention = getIntentionForIndustry(analysisContext.industry);
      const generatedPrompts = buildDiagnosticPrompts(
        brandName,
        analysisContext.industry,
        analysisContext.competitors.map((c) => c.name),
        intention,
        analysisContext.country
      ).slice(0, Math.max(1, Math.min(data.promptCount, 9)));

      // 5. Persistir todo en una transaccion
      const brand = await prisma.$transaction(async (tx) => {
        const createdBrand = await tx.brand.create({
          data: {
            tenantId: data.tenantId,
            name: brandName,
            domain: classification.domain,
            industry: analysisContext.industry,
            productType: classification.subcategory || null,
            country: analysisContext.country,
            description: analysisContext.verticalSummary || classification.description || null,
            businessType: classification.businessType as any,
            category: classification.category,
            subcategory: classification.subcategory || null,
            geoMarket: classification.geoMarket,
            sizeSegment: classification.sizeSegment as any,
            autoDetected: true,
            classifierMeta: {
              classification,
              marketProfile: {
                country: analysisContext.country,
                industry: analysisContext.industry,
                confidence: analysisContext.confidence,
                verticalSummary: analysisContext.verticalSummary,
                customerSegment: analysisContext.customerSegment,
                sourceUrls: analysisContext.sourceUrls,
              },
            } as unknown as Prisma.InputJsonValue,
            aliases: {
              create: (classification.aliases || []).map((alias) => ({ alias })),
            },
            competitors: {
              create: analysisContext.competitors.map((c) => ({
                name: c.name,
                domain: c.domain,
                aliases: [],
                businessType: classification.businessType as any,
                category: analysisContext.industry,
                subcategory: classification.subcategory || null,
                geoMarket: classification.geoMarket,
                autoDetected: true,
                validated: true,
                discoveryReason: 'Detectado desde contexto real del sitio',
              })),
            },
          },
          include: { aliases: true, competitors: true },
        });

        if (generatedPrompts.length > 0) {
          const versionName =
            data.versionName ||
            `Auto-${classification.brandName.slice(0, 20)}-${new Date()
              .toISOString()
              .slice(0, 10)}`;

          // Aseguramos uniqueness de (tenantId, versionName)
          let finalVersionName = versionName;
          let suffix = 1;
          // Best-effort: si ya existe, sumar sufijo
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const existing = await tx.promptVersion.findFirst({
              where: { tenantId: data.tenantId, name: finalVersionName },
            });
            if (!existing) break;
            suffix += 1;
            finalVersionName = `${versionName}-${suffix}`;
          }

          await tx.promptVersion.create({
            data: {
              tenantId: data.tenantId,
              name: finalVersionName,
              active: true,
              prompts: {
                create: generatedPrompts.map((p) => ({
                  name: p.name,
                  promptText: p.promptText,
                  active: true,
                })),
              },
            },
          });
        }

        return createdBrand;
      });

      return reply.code(201).send({
        brand,
        classification,
        competitorCandidates,
        competitorsCreated: analysisContext.competitors.length,
        competitorsRejected: [],
        promptsCreated: generatedPrompts.length,
      });
    }
  );

  // POST /brands/classify-preview  -> preview sin persistir (para debug UI)
  fastify.post<{ Body: { domain: string } }>('/classify-preview', async (request, reply) => {
    const domain = normalizeDomain(String(request.body?.domain || ''));
    if (!domain) return reply.code(400).send({ error: 'domain requerido' });
    try {
      const classification = await classifyDomain(domain);
      const brandName =
        `${classification.brandName || ''}`.trim() ||
        deriveBrandNameFromDomain(domain) ||
        domain;
      const analysisContext = await resolveBrandAnalysisContext({
        brandName,
        websiteUrl: domain,
        fallbackIndustry: classification.category || 'General',
      });
      const candidates = analysisContext.competitors.map((c) => ({
        domain: c.domain ?? '',
        name: c.name,
        reason: 'Detectado desde contexto real del sitio',
      }));
      return { classification, analysisContext, candidates };
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message || 'Error' });
    }
  });

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
                  'Sos un analista de mercado. Devolvé SOLO un JSON array con 5 a 8 competidores DIRECTOS de la misma industria y tipo de producto que se indican. No sugieras marcas de otros rubros. Formato: [{"name":"Marca","reason":"breve motivo"}]. No incluyas texto extra.',
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
