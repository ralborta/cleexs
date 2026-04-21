import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { findBrandPosition, type Top3Entry } from '@cleexs/shared';

const leadsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /leads?tenantId=...
  fastify.get<{ Querystring: { tenantId: string } }>('/', async (request) => {
    const leads = await prisma.leadSource.findMany({
      where: { tenantId: request.query.tenantId },
      include: {
        brand: {
          select: { id: true, name: true, domain: true },
        },
        contacts: true,
        emails: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return leads;
  });

  // POST /leads/discover
  const discoverSchema = z.object({
    tenantId: z.string().uuid(),
    runId: z.string().uuid().optional(),
    domain: z.string().optional(),
    enrich: z.boolean().optional().default(true),
    competitorDomains: z
      .array(
        z.object({
          name: z.string().min(1),
          domain: z.string().min(1),
        })
      )
      .optional()
      .default([]),
  });

  fastify.post<{ Body: z.infer<typeof discoverSchema> }>('/discover', async (request, reply) => {
    const data = discoverSchema.parse(request.body);

    if (!data.runId && !data.domain) {
      return reply.code(400).send({ error: 'Debes enviar runId o domain' });
    }

    const normalizedDomain = data.domain
      ? data.domain
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0]
          .trim()
          .toLowerCase()
      : null;

    let run = null;
    if (data.runId) {
      run = await prisma.run.findUnique({
        where: { id: data.runId },
        include: {
          brand: {
            include: {
              aliases: true,
              competitors: true,
            },
          },
          promptResults: {
            include: {
              prompt: true,
            },
          },
        },
      });
    } else if (normalizedDomain) {
      const brand = await prisma.brand.findFirst({
        where: {
          tenantId: data.tenantId,
          domain: normalizedDomain,
        },
      });

      if (!brand) {
        return reply.code(404).send({ error: 'No se encontró una marca con ese dominio' });
      }

      run = await prisma.run.findFirst({
        where: {
          tenantId: data.tenantId,
          brandId: brand.id,
          status: 'completed',
        },
        orderBy: { periodEnd: 'desc' },
        include: {
          brand: {
            include: {
              aliases: true,
              competitors: true,
            },
          },
          promptResults: {
            include: {
              prompt: true,
            },
          },
        },
      });
    }

    if (!run || run.tenantId !== data.tenantId) {
      return reply.code(404).send({ error: 'Run no encontrado para ese dominio' });
    }

    const brandAliases = run.brand.aliases.map((a) => a.alias);
    const domainMap = new Map(
      data.competitorDomains.map((entry) => [entry.name.toLowerCase(), entry.domain])
    );

    const leadSources: Array<{
      competitorName: string;
      competitorDomain?: string;
      evidence: any;
    }> = [];

    for (const result of run.promptResults) {
      const top3 = result.top3Json as unknown as Top3Entry[];
      const brandPosition = findBrandPosition(top3, run.brand.name, brandAliases);
      for (const entry of top3.filter((item) => item.type === 'competitor')) {
        const competitorName = entry.name;
        const competitorDomain = domainMap.get(entry.name.toLowerCase());
        const competitorWins = !brandPosition || entry.position < brandPosition;
        if (!competitorWins) continue;

        if (!leadSources.find((lead) => lead.competitorName === competitorName)) {
          leadSources.push({
            competitorName,
            competitorDomain,
            evidence: {
              promptText: result.prompt.promptText,
              responseText: result.responseText,
              top3,
              brandPosition,
              competitorPosition: entry.position,
            },
          });
        }
      }
    }

    const createdSources = [];
    for (const lead of leadSources) {
      const existing = await prisma.leadSource.findFirst({
        where: {
          tenantId: data.tenantId,
          runId: run.id,
          competitorName: lead.competitorName,
        },
      });

      if (existing) {
        createdSources.push(existing);
        continue;
      }

      const created = await prisma.leadSource.create({
        data: {
          tenantId: data.tenantId,
          brandId: run.brandId,
          runId: run.id,
          competitorName: lead.competitorName,
          competitorDomain: lead.competitorDomain,
          evidenceJson: lead.evidence,
        },
      });
      createdSources.push(created);
    }

    if (!data.enrich) {
      return { leads: createdSources, contacts: [] };
    }

    const contacts = [];
    for (const source of createdSources) {
      const domain = source.competitorDomain;
      if (!domain) continue;
      const { foundContacts } = await enrichContacts(domain, source.id);
      contacts.push(...foundContacts);
    }

    return { leads: createdSources, contacts };
  });

  // POST /leads/email
  const emailSchema = z.object({
    leadSourceId: z.string().uuid(),
    leadContactId: z.string().uuid(),
  });

  fastify.post<{ Body: z.infer<typeof emailSchema> }>('/email', async (request, reply) => {
    const data = emailSchema.parse(request.body);

    const lead = await prisma.leadSource.findUnique({
      where: { id: data.leadSourceId },
      include: {
        brand: true,
        run: true,
      },
    });

    const contact = await prisma.leadContact.findUnique({
      where: { id: data.leadContactId },
    });

    if (!lead || !contact || contact.leadSourceId !== lead.id) {
      return reply.code(404).send({ error: 'Lead o contacto no encontrado' });
    }

    const evidence = lead.evidenceJson as any;
    const brandName = lead.brand?.name || 'una marca';
    const competitorName = lead.competitorName;

    const defaultSubject = `${competitorName} rankea mejor que ${brandName} en ChatGPT`;
    const defaultBody =
      `Hola,\n\n` +
      `Detectamos que ${competitorName} aparece recomendado por encima de ${brandName} en ChatGPT.\n` +
      `En uno de los prompts relevantes, el Top 3 fue:\n` +
      `${(evidence?.top3 || [])
        .map((entry: any) => `${entry.position}. ${entry.name}`)
        .join('\n')}\n\n` +
      `Podemos compartirte un reporte gratuito (código CLEEXS) con evidencia completa y acciones para mejorar.\n\n` +
      `¿Te interesa que te lo enviemos?\n\n` +
      `– Cleexs`;

    let subject = defaultSubject;
    let body = defaultBody;

    if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content:
                'Escribí un email comercial breve y profesional en español. Incluí evidencia concreta, tono directo y CTA.',
            },
            {
              role: 'user',
              content:
                `Marca medida: ${brandName}\n` +
                `Competidor: ${competitorName}\n` +
                `Top 3: ${(evidence?.top3 || []).map((entry: any) => `${entry.position}. ${entry.name}`).join(', ')}\n` +
                `CTA: Reporte gratis con código CLEEXS\n`,
            },
          ],
        }),
      });
      const responseJson = (await response.json()) as any;
      if (response.ok) {
        const content = responseJson?.choices?.[0]?.message?.content || '';
        const [subjectLine, ...bodyLines] = content.split('\n');
        if (subjectLine?.toLowerCase().startsWith('subject:')) {
          subject = subjectLine.replace(/subject:/i, '').trim();
          body = bodyLines.join('\n').trim();
        } else {
          body = content.trim() || defaultBody;
        }
      }
    }

    const email = await prisma.leadEmail.create({
      data: {
        leadSourceId: lead.id,
        leadContactId: contact.id,
        subject,
        body,
        status: 'draft',
      },
    });

    return email;
  });
};

async function enrichContacts(domain: string, leadSourceId: string) {
  const foundContacts: any[] = [];

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v2/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          urls: [`https://${domain}/*`],
          prompt: 'Extrae todos los emails visibles de la web. Devuelve una lista de emails.',
          schema: {
            type: 'object',
            properties: {
              emails: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['emails'],
          },
        }),
      });
      const payload = (await response.json()) as any;
      const emails = payload?.data?.emails || [];
      for (const email of emails) {
        const contact = await prisma.leadContact.upsert({
          where: { leadSourceId_email: { leadSourceId, email } },
          create: {
            leadSourceId,
            email,
            source: 'firecrawl',
          },
          update: {},
        });
        foundContacts.push(contact);
      }
    } catch (error) {
      fastifyLog('Firecrawl error', error);
    }
  }

  const hunterKey = process.env.HUNTER_API_KEY;
  if (hunterKey) {
    try {
      const response = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}`
      );
      const payload = (await response.json()) as any;
      const emails = payload?.data?.emails || [];
      for (const entry of emails) {
        const contact = await prisma.leadContact.upsert({
          where: { leadSourceId_email: { leadSourceId, email: entry.value } },
          create: {
            leadSourceId,
            email: entry.value,
            name: [entry.first_name, entry.last_name].filter(Boolean).join(' '),
            role: entry.position,
            source: 'hunter',
            score: entry.confidence || 0,
            verified: entry.status === 'valid',
          },
          update: {
            verified: entry.status === 'valid',
          },
        });
        foundContacts.push(contact);
      }
    } catch (error) {
      fastifyLog('Hunter error', error);
    }
  }

  return { foundContacts };
}

function fastifyLog(message: string, error: unknown) {
  if (error instanceof Error) {
    console.error(`[Leads] ${message}: ${error.message}`);
    return;
  }
  console.error(`[Leads] ${message}`, error);
}

export default leadsRoutes;
