import { prisma } from './prisma';
import { findBrandPosition, type Top3Entry } from '@cleexs/shared';
import { resolveCompetitorDomains } from './diagnostic-ai';

export interface OutreachToolResult {
  ok: boolean;
  count: number;
  error?: string;
}

export interface OutreachRunResult {
  leadsCreated: number;
  leadsTotal: number;
  contactsCreated: number;
  firecrawl: OutreachToolResult;
  hunter: OutreachToolResult;
}

type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error?: (...args: unknown[]) => void };

/**
 * Detecta competidores que le ganan a la marca en el run indicado, persiste LeadSource
 * y, si enrich=true, busca contactos en Firecrawl y Hunter por competidor.
 *
 * No envia correos ni genera emails. Pensado para correrse automatico despues de un run.
 */
export async function runOutreachForRun(
  tenantId: string,
  runId: string,
  opts: { enrich?: boolean; logger?: Logger } = {}
): Promise<OutreachRunResult> {
  const { enrich = true, logger } = opts;

  const result: OutreachRunResult = {
    leadsCreated: 0,
    leadsTotal: 0,
    contactsCreated: 0,
    firecrawl: { ok: false, count: 0 },
    hunter: { ok: false, count: 0 },
  };

  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      brand: {
        include: {
          aliases: true,
          competitors: true,
        },
      },
      promptResults: {
        include: { prompt: true },
      },
    },
  });

  if (!run || run.tenantId !== tenantId) {
    logger?.warn?.({ tenantId, runId }, 'Outreach: run no encontrado o tenant mismatch');
    return result;
  }

  const brandAliases = run.brand.aliases.map((a) => a.alias);

  // Mapa nombre/alias -> dominio del competidor (si esta guardado)
  const domainMap = new Map<string, string>();
  for (const competitor of run.brand.competitors) {
    if (competitor.domain) {
      domainMap.set(competitor.name.toLowerCase(), competitor.domain);
      const aliases = (competitor.aliases as string[]) || [];
      for (const alias of aliases) {
        domainMap.set(alias.toLowerCase(), competitor.domain);
      }
    }
  }

  // Detectar competidores que rankean por encima de la marca
  const leadSources: Array<{
    competitorName: string;
    competitorDomain?: string;
    evidence: unknown;
  }> = [];

  for (const pr of run.promptResults) {
    const top3 = (pr.top3Json || []) as unknown as Top3Entry[];
    const brandPosition = findBrandPosition(top3, run.brand.name, brandAliases);
    for (const entry of top3.filter((e) => e.type === 'competitor')) {
      const competitorWins = !brandPosition || entry.position < brandPosition;
      if (!competitorWins) continue;
      if (leadSources.find((l) => l.competitorName === entry.name)) continue;
      leadSources.push({
        competitorName: entry.name,
        competitorDomain: domainMap.get(entry.name.toLowerCase()),
        evidence: {
          promptText: pr.prompt?.promptText,
          responseText: pr.responseText,
          top3,
          brandPosition,
          competitorPosition: entry.position,
        },
      });
    }
  }

  // Persistir LeadSources (idempotente por runId + competitorName)
  const persistedSources: Array<{ id: string; competitorDomain: string | null }> = [];
  for (const lead of leadSources) {
    const existing = await prisma.leadSource.findFirst({
      where: {
        tenantId,
        runId: run.id,
        competitorName: lead.competitorName,
      },
      select: { id: true, competitorDomain: true },
    });

    if (existing) {
      persistedSources.push({ id: existing.id, competitorDomain: existing.competitorDomain });
      continue;
    }

    const created = await prisma.leadSource.create({
      data: {
        tenantId,
        brandId: run.brandId,
        runId: run.id,
        competitorName: lead.competitorName,
        competitorDomain: lead.competitorDomain,
        evidenceJson: lead.evidence as object,
      },
      select: { id: true, competitorDomain: true },
    });
    persistedSources.push({ id: created.id, competitorDomain: created.competitorDomain });
    result.leadsCreated += 1;
  }
  result.leadsTotal = persistedSources.length;

  if (!enrich || persistedSources.length === 0) {
    return result;
  }

  // Fallback: si algun LeadSource no tiene competitorDomain, intentar resolverlo con OpenAI
  // (habilita runs historicos que se guardaron sin dominio). Persistimos la resolucion.
  const missingDomainLeads = persistedSources.filter((s) => !s.competitorDomain);
  if (missingDomainLeads.length > 0) {
    try {
      const leadsById = new Map(persistedSources.map((s) => [s.id, s]));
      const missingNames: string[] = [];
      for (const lead of missingDomainLeads) {
        const source = await prisma.leadSource.findUnique({
          where: { id: lead.id },
          select: { competitorName: true },
        });
        if (source?.competitorName) missingNames.push(source.competitorName);
      }
      if (missingNames.length > 0) {
        const resolved = await resolveCompetitorDomains(
          missingNames,
          run.brand.country || undefined,
          run.brand.industry || undefined
        );
        const byName = new Map(resolved.map((r) => [r.name.toLowerCase(), r.domain]));
        for (const lead of missingDomainLeads) {
          const source = await prisma.leadSource.findUnique({
            where: { id: lead.id },
            select: { competitorName: true },
          });
          const domain = source?.competitorName
            ? byName.get(source.competitorName.toLowerCase()) ?? null
            : null;
          if (domain) {
            await prisma.leadSource.update({
              where: { id: lead.id },
              data: { competitorDomain: domain },
            });
            const entry = leadsById.get(lead.id);
            if (entry) entry.competitorDomain = domain;
          }
        }
      }
    } catch (err) {
      logger?.warn?.({ err, runId: run.id }, 'Fallback de resolucion de dominios fallo');
    }
  }

  // Enriquecer con Firecrawl + Hunter
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const hunterKey = process.env.HUNTER_API_KEY;

  if (!firecrawlKey) result.firecrawl.error = 'FIRECRAWL_API_KEY no configurada';
  if (!hunterKey) result.hunter.error = 'HUNTER_API_KEY no configurada';

  for (const source of persistedSources) {
    const domain = source.competitorDomain;
    if (!domain) continue;

    // Firecrawl: scrapeamos paginas candidatas (home, /contact, /contacto, /about,
    // /about-us, /nosotros) y extraemos emails con regex sobre el markdown.
    // Usamos /v2/scrape (sincronico) en lugar de /v2/extract (async, no devuelve
    // emails sin polling y gasta creditos sin resultado). Es mas barato y directo.
    if (firecrawlKey) {
      const candidatePaths = ['', '/contact', '/contacto', '/about', '/about-us', '/nosotros'];
      const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
      const genericLocals = new Set([
        'example',
        'sentry',
        'noreply',
        'no-reply',
        'do-not-reply',
        'donotreply',
        'postmaster',
      ]);
      const foundEmails = new Set<string>();
      let firecrawlError: string | undefined;

      for (const path of candidatePaths) {
        const url = `https://${domain}${path}`;
        try {
          const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${firecrawlKey}`,
            },
            body: JSON.stringify({
              url,
              formats: ['markdown'],
              onlyMainContent: false,
              timeout: 20000,
            }),
          });
          if (!response.ok) {
            // 404 o bloqueo: seguimos con la siguiente ruta, no rompemos.
            if (!firecrawlError) firecrawlError = `HTTP ${response.status} en ${url}`;
            continue;
          }
          const payload = (await response.json()) as {
            success?: boolean;
            data?: { markdown?: string; html?: string };
          };
          const content = payload?.data?.markdown || payload?.data?.html || '';
          if (!content) continue;
          const matches = content.match(emailRegex) || [];
          for (const match of matches) {
            const email = match.toLowerCase();
            const [local] = email.split('@');
            if (genericLocals.has(local)) continue;
            if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.svg')) continue;
            foundEmails.add(email);
          }
        } catch (err) {
          if (!firecrawlError) {
            firecrawlError = err instanceof Error ? err.message : String(err);
          }
        }
      }

      for (const email of foundEmails) {
        await prisma.leadContact.upsert({
          where: { leadSourceId_email: { leadSourceId: source.id, email } },
          create: {
            leadSourceId: source.id,
            email,
            source: 'firecrawl',
          },
          update: {},
        });
        result.contactsCreated += 1;
        result.firecrawl.count += 1;
      }
      if (foundEmails.size > 0) {
        result.firecrawl.ok = true;
      } else if (firecrawlError) {
        result.firecrawl.error = firecrawlError;
        logger?.warn?.({ domain, err: firecrawlError }, 'Firecrawl sin emails');
      } else {
        result.firecrawl.ok = true; // scrape exitoso pero sin emails en paginas visitadas
      }
    }

    // Hunter
    if (hunterKey) {
      try {
        const response = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(
            domain
          )}&api_key=${hunterKey}`
        );
        const payload = (await response.json()) as {
          data?: {
            emails?: Array<{
              value: string;
              first_name?: string | null;
              last_name?: string | null;
              position?: string | null;
              confidence?: number;
              status?: string;
            }>;
          };
        };
        const emails = payload?.data?.emails || [];
        for (const entry of emails) {
          await prisma.leadContact.upsert({
            where: { leadSourceId_email: { leadSourceId: source.id, email: entry.value } },
            create: {
              leadSourceId: source.id,
              email: entry.value,
              name: [entry.first_name, entry.last_name].filter(Boolean).join(' ') || null,
              role: entry.position || null,
              source: 'hunter',
              score: entry.confidence || 0,
              verified: entry.status === 'valid',
            },
            update: {
              verified: entry.status === 'valid',
            },
          });
          result.contactsCreated += 1;
          result.hunter.count += 1;
        }
        result.hunter.ok = true;
      } catch (err) {
        result.hunter.error = err instanceof Error ? err.message : String(err);
        logger?.warn?.({ domain, err: result.hunter.error }, 'Hunter fallo');
      }
    }
  }

  return result;
}
