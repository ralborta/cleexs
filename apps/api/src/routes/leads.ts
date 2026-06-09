import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { findBrandPosition, type Top3Entry } from '@cleexs/shared';
import { scrapeEmailsForDomain } from '../lib/firecrawl-emails';
import { sendLeadEmail } from '../lib/lead-email-sender';
import { buildOutreachStats, listOutreachEmails } from '../lib/outreach-stats';

const FINAL_OUTREACH_SUBJECT = 'ChatGPT elige a un competidor tuyo';

const FINAL_OUTREACH_BODY_TEMPLATE =
  'Hola,\n\n' +
  'Preguntamos a ChatGPT: "¿quién me recomendás para {{industryQuery}}?" Aparece un competidor tuyo entre los primeros. Vos no estás.\n\n' +
  'Ya que le hicimos el reporte a ellos, también te armamos uno para vos de cómo te ve la IA. El Cleexs Score dio oportunidades de mejora — y se arregla con 3 cambios muy concretos.\n\n' +
  '¿Querés que te mande el diagnóstico completo? Es gratis. Respondeme este mail y te lo mando.\n\n' +
  'Gonzalo — Fundador, Cleexs';

function fallbackIndustryQuery(industry?: string | null, promptText?: string | null): string {
  const text = `${industry || ''} ${promptText || ''}`.toLowerCase();
  if (/abog|legal|jur[ií]dic|estudio/.test(text)) return 'resolver un tema legal';
  if (/odont|dent|dental/.test(text)) return 'un implante dental';
  if (/salud|m[eé]dic|cl[ií]nica|hospital/.test(text)) return 'atenderme con un especialista';
  if (/conta|impuest|monotribut|financ/.test(text)) return 'ordenar mis impuestos';
  if (/inmobili|propiedad|alquiler|real estate/.test(text)) return 'comprar o alquilar una propiedad';
  if (/software|tecnolog|saas|automatiz|digital/.test(text)) return 'implementar una solución tecnológica';
  if (/educ|coleg|univers|curso/.test(text)) return 'elegir una institución educativa';
  if (/hotel|turis|viaje|restaur/.test(text)) return 'organizar una experiencia en tu ciudad';
  if (/constru|arquitect|obra|ingenier/.test(text)) return 'hacer una obra o remodelación';
  const cleaned = (industry || '').trim();
  if (cleaned) return `contratar una empresa de ${cleaned}`;
  return 'resolver una necesidad de mi rubro';
}

async function buildIndustryQuery(args: {
  industry?: string | null;
  promptText?: string | null;
  competitorName: string;
}): Promise<string> {
  const fallback = fallbackIndustryQuery(args.industry, args.promptText);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 30,
        messages: [
          {
            role: 'system',
            content:
              'Devolvé solo una frase corta en español, sin comillas ni punto final, que complete: "¿quién me recomendás para ___?". Debe ser una consulta concreta y de alto impacto para la industria.',
          },
          {
            role: 'user',
            content:
              `Industria: ${args.industry || 'desconocida'}\n` +
              `Competidor: ${args.competitorName}\n` +
              `Prompt original/evidencia: ${args.promptText || 'sin dato'}\n` +
              `Fallback si no alcanza: ${fallback}`,
          },
        ],
      }),
    });
    const json = (await response.json()) as any;
    const phrase = String(json?.choices?.[0]?.message?.content || '')
      .trim()
      .replace(/^["“”']+|["“”'.]+$/g, '');
    if (response.ok && phrase && phrase.length <= 120) return phrase;
  } catch {
    // El email no debe bloquearse si falla la generación de la consulta.
  }
  return fallback;
}

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
    const domainMap = new Map<string, string>();
    // Primary: dominios guardados en cada competidor de la marca (auto-detectados)
    for (const competitor of run.brand.competitors) {
      if (competitor.domain) {
        domainMap.set(competitor.name.toLowerCase(), competitor.domain);
        const aliases = (competitor.aliases as string[]) || [];
        for (const alias of aliases) {
          domainMap.set(alias.toLowerCase(), competitor.domain);
        }
      }
    }
    // Override/fallback: los que vengan en el body
    for (const entry of data.competitorDomains) {
      domainMap.set(entry.name.toLowerCase(), entry.domain);
    }

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

  const sendEmailSchema = z.object({
    mode: z.enum(['shadow', 'real']).default('shadow'),
    shadowTo: z.string().email().optional(),
    subject: z.string().trim().min(3).max(180).optional(),
    body: z.string().trim().min(3).max(8000).optional(),
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
    const industry = lead.brand?.industry || null;
    const competitorName = lead.competitorName;
    const industryQuery = await buildIndustryQuery({
      industry,
      promptText: evidence?.promptText || null,
      competitorName,
    });
    const top3Lines = (evidence?.top3 || [])
      .map((entry: any) => `${entry.position}. ${entry.name}`)
      .join('\n');
    const top3Inline = (evidence?.top3 || [])
      .map((entry: any) => `${entry.position}. ${entry.name}`)
      .join(', ');

    const fallbackSubject = FINAL_OUTREACH_SUBJECT;
    const fallbackBody = FINAL_OUTREACH_BODY_TEMPLATE;

    const template = await prisma.outreachTemplate
      .findUnique({ where: { key: 'default' } })
      .catch(() => null);

    const subjectTemplate = template?.subject || fallbackSubject;
    const bodyTemplate = template?.body || fallbackBody;
    const renderVars = (input: string): string =>
      input
        .replace(/\{\{\s*brandName\s*\}\}/g, brandName)
        .replace(/\{\{\s*competitorName\s*\}\}/g, competitorName)
        .replace(/\{\{\s*industryQuery\s*\}\}/g, industryQuery)
        .replace(/\{\{\s*top3\s*\}\}/g, top3Lines)
        .replace(/\{\{\s*top3Inline\s*\}\}/g, top3Inline);

    let subject = renderVars(subjectTemplate);
    let body = renderVars(bodyTemplate);

    // La versión final aprobada por el cliente es fija. La IA solo se usa arriba
    // para completar la consulta típica del rubro, no para reescribir el correo.
    const shouldUseAi = false;
    if (shouldUseAi && process.env.OPENAI_API_KEY) {
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
          body = content.trim() || renderVars(bodyTemplate);
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

  // GET /leads/email/stats?windowDays=30
  fastify.get<{ Querystring: { windowDays?: string } }>('/email/stats', async (request) => {
    const parsed = Number(request.query.windowDays);
    const windowDays = Number.isFinite(parsed) && parsed > 0 ? Math.min(180, Math.floor(parsed)) : 30;
    return buildOutreachStats(windowDays);
  });

  // GET /leads/email/list?limit=50&windowDays=30&status=&mode=
  fastify.get<{ Querystring: { limit?: string; windowDays?: string; status?: string; mode?: string } }>(
    '/email/list',
    async (request) => {
      const limit = Number(request.query.limit);
      const windowDays = Number(request.query.windowDays);
      const mode = request.query.mode === 'shadow' || request.query.mode === 'real' ? request.query.mode : null;
      return listOutreachEmails({
        limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50,
        windowDays: Number.isFinite(windowDays) && windowDays > 0 ? Math.min(180, Math.floor(windowDays)) : 30,
        status: request.query.status?.trim() || null,
        mode,
      });
    },
  );

  // GET /leads/template  -> devuelve la plantilla editable + ejemplo renderizado
  fastify.get('/template', async () => {
    const template = await prisma.outreachTemplate
      .findUnique({ where: { key: 'default' } })
      .catch(() => null);

    const fallbackSubject = '{{competitorName}} rankea mejor que {{brandName}} en ChatGPT';
    const fallbackBody =
      'Hola,\n\n' +
      'Detectamos que {{competitorName}} aparece recomendado por encima de {{brandName}} en ChatGPT.\n' +
      'En uno de los prompts relevantes, el Top 3 fue:\n' +
      '{{top3}}\n\n' +
      'Podemos compartirte un reporte gratuito (código CLEEXS) con evidencia completa y acciones para mejorar.\n\n' +
      '¿Te interesa que te lo enviemos?\n\n' +
      '– Cleexs';

    return {
      key: 'default',
      subject: template?.subject ?? fallbackSubject,
      body: template?.body ?? fallbackBody,
      useAi: template?.useAi ?? false,
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
      updatedAt: template?.updatedAt?.toISOString() ?? null,
      updatedBy: template?.updatedBy ?? null,
      variables: ['brandName', 'competitorName', 'top3', 'top3Inline'],
      example: {
        brandName: 'Marca Ejemplo',
        competitorName: 'Competidor X',
        top3: '1. Competidor X\n2. Marca Ejemplo\n3. Otro Competidor',
      },
    };
  });

  // PUT /leads/template  -> actualizar la plantilla
  const templateUpdateSchema = z.object({
    subject: z.string().trim().min(3).max(300),
    body: z.string().trim().min(10).max(8000),
    useAi: z.boolean().optional(),
    updatedBy: z.string().trim().max(200).optional(),
  });

  fastify.put('/template', async (request, reply) => {
    const parsed = templateUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }
    const data = parsed.data;
    const saved = await prisma.outreachTemplate.upsert({
      where: { key: 'default' },
      update: {
        subject: data.subject,
        body: data.body,
        useAi: data.useAi ?? false,
        updatedBy: data.updatedBy ?? null,
      },
      create: {
        key: 'default',
        subject: data.subject,
        body: data.body,
        useAi: data.useAi ?? false,
        updatedBy: data.updatedBy ?? null,
      },
    });
    return {
      ok: true,
      key: saved.key,
      subject: saved.subject,
      body: saved.body,
      useAi: saved.useAi,
      updatedAt: saved.updatedAt.toISOString(),
      updatedBy: saved.updatedBy,
    };
  });

  // POST /leads/email/:id/send
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof sendEmailSchema> }>('/email/:id/send', async (request, reply) => {
    const parsed = sendEmailSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Payload inválido', details: parsed.error.flatten() });
    }

    try {
      const result = await sendLeadEmail({
        leadEmailId: request.params.id,
        mode: parsed.data.mode,
        shadowTo: parsed.data.shadowTo,
        subject: parsed.data.subject,
        body: parsed.data.body,
      });
      return { ok: true, ...result };
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error ? Number((error as { statusCode: unknown }).statusCode) || 500 : 500;
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : undefined;
      return reply.code(statusCode).send({
        error: error instanceof Error ? error.message : String(error),
        ...(code ? { code } : {}),
      });
    }
  });
};

async function enrichContacts(domain: string, leadSourceId: string) {
  const foundContacts: any[] = [];

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    try {
      // Usamos /v2/scrape (sincronico) via helper. /v2/extract gasta creditos
      // sin devolver emails (es async y requiere polling del jobId).
      const scrapeResult = await scrapeEmailsForDomain(domain, firecrawlKey);
      for (const email of scrapeResult.emails) {
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
      if (scrapeResult.error) {
        fastifyLog(
          `Firecrawl sin emails para ${domain} (ultimo error: ${scrapeResult.error})`,
          null
        );
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
