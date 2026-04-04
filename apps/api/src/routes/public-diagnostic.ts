import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { isEmailConfigured, isEmailDisabled, sendDiagnosticLink } from '../lib/email';
import { executeRun, executeRunGemini } from '../lib/run-executor';
import { determineMarketProfileForBrand, fetchSearchEvidence, getTop5Competitors } from '../lib/diagnostic-ai';
import { getIntentionForIndustry, buildDiagnosticPrompts } from '../lib/diagnostic-prompts';
import { buildRunContext, generateDiagnosticAnalysis } from '../lib/diagnostic-analysis';
import { runSatelliteAnalysis, type SatelliteModuleResult } from '../lib/satellite-client';

/** TLDs genéricos: no indican país (ej. nike.com = global). .co es Colombia, no va aquí. */
const GENERIC_TLDS = new Set(['com', 'net', 'org', 'info', 'biz', 'edu', 'gov', 'int', 'io', 'ai', 'app']);

/**
 * Mapa TLD → país (nombre en español).
 * Incluye Américas completas + principales del mundo.
 * Clave: sufijo de 2 partes (com.ar) o 1 parte (ar). Para .com/.net etc. no está en el mapa → país desde búsqueda.
 */
const TLD_TO_COUNTRY: Record<string, string> = {
  // Américas — compuestos
  'com.ar': 'Argentina',
  'com.bo': 'Bolivia',
  'com.br': 'Brasil',
  'com.co': 'Colombia',
  'co.cr': 'Costa Rica',
  'com.ec': 'Ecuador',
  'com.sv': 'El Salvador',
  'com.gt': 'Guatemala',
  'com.hn': 'Honduras',
  'com.mx': 'México',
  'com.ni': 'Nicaragua',
  'com.pa': 'Panamá',
  'com.py': 'Paraguay',
  'com.pe': 'Perú',
  'com.uy': 'Uruguay',
  'com.ve': 'Venezuela',
  'com.do': 'República Dominicana',
  'com.cu': 'Cuba',
  'com.pr': 'Puerto Rico',
  'com.jm': 'Jamaica',
  'com.tt': 'Trinidad y Tobago',
  'com.bs': 'Bahamas',
  'com.bb': 'Barbados',
  'com.bz': 'Belice',
  'com.gy': 'Guyana',
  'com.sr': 'Surinam',
  // Europa y otros compuestos
  'co.uk': 'Reino Unido',
  'com.au': 'Australia',
  'co.nz': 'Nueva Zelanda',
  'co.za': 'Sudáfrica',
  'co.in': 'India',
  'com.cn': 'China',
  'co.jp': 'Japón',
  'co.kr': 'Corea del Sur',
  'com.sg': 'Singapur',
  'com.hk': 'Hong Kong',
  'com.tw': 'Taiwán',
  'com.my': 'Malasia',
  'co.id': 'Indonesia',
  'com.ph': 'Filipinas',
  'com.vn': 'Vietnam',
  'com.th': 'Tailandia',
  'com.sa': 'Arabia Saudita',
  'com.ae': 'Emiratos Árabes Unidos',
  'com.tr': 'Turquía',
  'com.ru': 'Rusia',
  'com.ua': 'Ucrania',
  'com.pl': 'Polonia',
  'com.ro': 'Rumania',
  'com.gr': 'Grecia',
  'com.pt': 'Portugal',
  'com.ie': 'Irlanda',
  'com.ch': 'Suiza',
  'com.at': 'Austria',
  'com.be': 'Bélgica',
  'com.se': 'Suecia',
  'com.no': 'Noruega',
  'com.dk': 'Dinamarca',
  'com.fi': 'Finlandia',
  'com.cz': 'República Checa',
  'com.hu': 'Hungría',
  'com.il': 'Israel',
  'com.eg': 'Egipto',
  // Américas y mundo — un solo segmento (ccTLD)
  ar: 'Argentina',
  bo: 'Bolivia',
  br: 'Brasil',
  cl: 'Chile',
  co: 'Colombia',
  cr: 'Costa Rica',
  ec: 'Ecuador',
  sv: 'El Salvador',
  gt: 'Guatemala',
  hn: 'Honduras',
  mx: 'México',
  ni: 'Nicaragua',
  pa: 'Panamá',
  py: 'Paraguay',
  pe: 'Perú',
  uy: 'Uruguay',
  ve: 'Venezuela',
  do: 'República Dominicana',
  cu: 'Cuba',
  pr: 'Puerto Rico',
  jm: 'Jamaica',
  tt: 'Trinidad y Tobago',
  gy: 'Guyana',
  sr: 'Surinam',
  bz: 'Belice',
  ca: 'Canadá',
  us: 'Estados Unidos',
  uk: 'Reino Unido',
  de: 'Alemania',
  fr: 'Francia',
  es: 'España',
  it: 'Italia',
  nl: 'Países Bajos',
  pt: 'Portugal',
  pl: 'Polonia',
  ru: 'Rusia',
  ua: 'Ucrania',
  ie: 'Irlanda',
  ch: 'Suiza',
  at: 'Austria',
  be: 'Bélgica',
  gr: 'Grecia',
  se: 'Suecia',
  no: 'Noruega',
  dk: 'Dinamarca',
  fi: 'Finlandia',
  ro: 'Rumania',
  hu: 'Hungría',
  cz: 'República Checa',
  tr: 'Turquía',
  au: 'Australia',
  nz: 'Nueva Zelanda',
  za: 'Sudáfrica',
  in: 'India',
  cn: 'China',
  jp: 'Japón',
  kr: 'Corea del Sur',
  sg: 'Singapur',
  hk: 'Hong Kong',
  tw: 'Taiwán',
  my: 'Malasia',
  id: 'Indonesia',
  ph: 'Filipinas',
  vn: 'Vietnam',
  th: 'Tailandia',
  sa: 'Arabia Saudita',
  ae: 'Emiratos Árabes Unidos',
  il: 'Israel',
  eg: 'Egipto',
};

/**
 * Si el dominio tiene TLD de país (ej. nike.com.co → Colombia), devuelve el país.
 * Si es genérico (nike.com, .net, .org) devuelve null → país se obtiene por búsqueda.
 */
function getCountryFromDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.toLowerCase();
    const parts = host.split('.').filter(Boolean);
    if (parts.length >= 3) {
      const compound = parts.slice(-2).join('.');
      const country = TLD_TO_COUNTRY[compound];
      if (country) return country;
    }
    if (parts.length >= 2) {
      const single = parts[parts.length - 1]!;
      if (GENERIC_TLDS.has(single)) return null;
      const country = TLD_TO_COUNTRY[single];
      if (country) return country;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeDomain(url: string): string {
  const COMPOUND_PUBLIC_SUFFIXES = new Set([
    'com.ar',
    'com.py',
    'com.uy',
    'com.bo',
    'com.pe',
    'com.ec',
    'com.ve',
    'com.mx',
    'com.co',
    'co.cr',
  ]);

  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.toLowerCase();
    const parts = host.split('.');
    if (parts.length >= 3) {
      const suffix2 = parts.slice(-2).join('.');
      if (COMPOUND_PUBLIC_SUFFIXES.has(suffix2)) {
        const base = parts.slice(-3).join('.');
        return base.replace(/^www\./, '');
      }
    }
    if (parts.length >= 2) {
      const base = parts.slice(-2).join('.');
      return base.replace(/^www\./, '');
    }
    return host.replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^www\./, '').split('/')[0] || url;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

/** Deriva un nombre de marca desde el dominio cuando solo se envía URL (ej: cleexs.com → Cleexs) */
function deriveBrandFromDomain(domain: string): string {
  const base = domain.split('.')[0] || domain;
  if (!base) return domain;
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

/** Si el texto parece URL/dominio (tiene punto, www, etc.), devuelve la marca derivada; sino null */
function deriveBrandIfLooksLikeDomain(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v || !v.includes('.')) return null;
  if (v.startsWith('www.')) return deriveBrandFromDomain(v.replace(/^www\./, ''));
  const parts = v.split('.');
  if (parts.length >= 2 && parts[0] && parts[0] !== 'www') return deriveBrandFromDomain(v);
  return null;
}

function buildAnalysisWithSatellite(
  analysis: object | null,
  satellite: SatelliteModuleResult | null
): object | null {
  if (!analysis && !satellite) return null;
  if (!satellite) return analysis;

  if (analysis && typeof analysis === 'object' && !Array.isArray(analysis)) {
    const base = analysis as Record<string, unknown>;
    const currentExternal =
      base.externalModules && typeof base.externalModules === 'object' && !Array.isArray(base.externalModules)
        ? (base.externalModules as Record<string, unknown>)
        : {};
    return {
      ...base,
      externalModules: {
        ...currentExternal,
        satelliteAeo: satellite,
      },
    };
  }

  return {
    externalModules: {
      satelliteAeo: satellite,
    },
  };
}

function extractSatelliteModuleFromAnalysis(analysisJson: unknown): SatelliteModuleResult | null {
  if (!analysisJson || typeof analysisJson !== 'object' || Array.isArray(analysisJson)) return null;
  const externalModules = (analysisJson as { externalModules?: unknown }).externalModules;
  if (!externalModules || typeof externalModules !== 'object' || Array.isArray(externalModules)) return null;
  const satellite = (externalModules as { satelliteAeo?: unknown }).satelliteAeo;
  if (!satellite || typeof satellite !== 'object' || Array.isArray(satellite)) return null;
  return satellite as SatelliteModuleResult;
}

const publicDiagnosticRoutes: FastifyPluginAsync = async (fastify) => {
  // Turnstile deshabilitado (URLs dinámicas de Vercel). Reactivar cuando haya dominio estable.

  // POST /api/public/diagnostic — marca y/o url (al menos uno obligatorio) + tier (freemium|gold)
  fastify.post<{
    Body: { brandName?: string; url?: string; tier?: 'freemium' | 'gold' };
  }>('/diagnostic', async (request, reply) => {
    try {
      const schema = z.object({
        brandName: z.string().max(200).optional(),
        url: z.union([z.string().max(500), z.undefined()]).optional(),
        tier: z.enum(['freemium', 'gold']).optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.errors.map((e) => e.message).join(', ') || 'Datos inválidos.',
        });
      }
      const { brandName, url, tier: requestedTier } = parsed.data;
      const trimmedBrand = (brandName ?? '').trim();
      const trimmedUrl = (url ?? '').trim();

      if (!trimmedBrand && !trimmedUrl) {
        return reply.code(400).send({
          error: 'Ingresá la marca o la URL de tu sitio (al menos uno).',
        });
      }

      let domain: string;
      let brandForRun: string;
      if (trimmedUrl) {
        domain = normalizeDomain(trimmedUrl);
        const derivedFromBrand = trimmedBrand ? deriveBrandIfLooksLikeDomain(trimmedBrand) : null;
        brandForRun = derivedFromBrand ?? (trimmedBrand || deriveBrandFromDomain(domain));
      } else {
        domain = `brand-${slugify(trimmedBrand)}-${Date.now().toString(36)}`;
        const derived = deriveBrandIfLooksLikeDomain(trimmedBrand);
        brandForRun = derived ?? trimmedBrand;
      }

      if (!process.env.OPENAI_API_KEY) {
        return reply.code(503).send({
          error: 'El servicio de análisis no está disponible. Intentá más tarde.',
        });
      }
      const defaultCountry = (process.env.PUBLIC_DIAGNOSTIC_DEFAULT_COUNTRY || 'Argentina').trim();
      const marketConfidenceMin = Number(process.env.PUBLIC_DIAGNOSTIC_MARKET_CONFIDENCE_MIN || 70);

      const rootTenant = await prisma.tenant.findFirst({
        where: { tenantCode: '000' },
      });
      if (!rootTenant) {
        fastify.log.error('Tenant root (000) no encontrado. Ejecutá prisma db seed.');
        return reply.code(500).send({
          error: 'Configuración del sistema incompleta. Verificá que se haya ejecutado el seed de la base de datos.',
        });
      }

      const tier = requestedTier === 'gold' ? 'gold' : 'freemium';
      const diagnostic = await prisma.publicDiagnostic.create({
        data: {
          brandName: brandForRun,
          domain,
          status: 'running',
          tier,
        },
      });

      setImmediate(async () => {
      try {
        const satellitePromise = trimmedUrl ? runSatelliteAnalysis(trimmedUrl) : Promise.resolve(null);
        // 1. País: por TLD del dominio si aplica (nike.com.co → Colombia), sino por búsqueda web + IA
        const countryFromTld = trimmedUrl ? getCountryFromDomain(trimmedUrl) : null;
        let searchEvidence = '';
        if (!countryFromTld) {
          searchEvidence = await fetchSearchEvidence(brandForRun);
        }
        const marketProfile = await determineMarketProfileForBrand(
          brandForRun,
          defaultCountry,
          'General',
          trimmedUrl || undefined,
          searchEvidence || undefined,
          countryFromTld || undefined
        );
        const marketCountry = countryFromTld ?? (marketProfile.confidence >= marketConfidenceMin ? marketProfile.country || defaultCountry : defaultCountry);
        const industry = marketProfile.industry || 'General';
        fastify.log.info(
          {
            diagnosticId: diagnostic.id,
            brandName: brandForRun,
            marketCountry,
            industry,
            countryFromTld: countryFromTld ?? undefined,
            usedSearch: !!searchEvidence,
            marketConfidence: marketProfile.confidence,
            marketConfidenceMin,
          },
          'Perfil de mercado (país por TLD o búsqueda+IA, industria por IA)'
        );
        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { industry },
        });

        // 2. IA elige 5 competidores
        const { competitors } = await getTop5Competitors(brandForRun, industry, marketCountry);

        // 3. Crear Brand con industria y competidores
        const brand = await prisma.brand.create({
          data: {
            tenantId: rootTenant.id,
            name: brandForRun,
            domain: trimmedUrl ? normalizeDomain(trimmedUrl) : null,
            industry,
            country: marketCountry,
          },
        });

        for (const name of competitors) {
          await prisma.competitor.create({
            data: { brandId: brand.id, name: name.trim() || 'Competidor' },
          });
        }

        // 3b. Intención automática (Urgencia vs Consideración) según industria
        const intention = getIntentionForIndustry(industry);
        const diagnosticPrompts = buildDiagnosticPrompts(
          brandForRun,
          industry,
          competitors,
          intention,
          marketCountry
        );

        // 3c. Crear versión de prompts dinámica para este diagnóstico
        const promptVersion = await prisma.promptVersion.create({
          data: {
            tenantId: rootTenant.id,
            name: `DIAG_${diagnostic.id}`,
            active: false, // Solo para este diagnóstico, no interfiere con runs del admin
          },
        });
        for (const p of diagnosticPrompts) {
          await prisma.prompt.create({
            data: {
              promptVersionId: promptVersion.id,
              name: p.name,
              promptText: p.promptText,
              active: true,
            },
          });
        }

        // 4. Crear Run y ejecutar
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const run = await prisma.run.create({
          data: {
            tenantId: rootTenant.id,
            brandId: brand.id,
            periodStart,
            periodEnd,
            runType: 'diagnostic',
            status: 'pending',
          },
        });

        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { runId: run.id },
        });

        await executeRun(run.id, { promptVersionId: promptVersion.id });

        // Run Gemini con los mismos prompts (score y métricas para Gemini)
        let runGeminiId: string | null = null;
        try {
          const runGemini = await prisma.run.create({
            data: {
              tenantId: rootTenant.id,
              brandId: brand.id,
              periodStart,
              periodEnd,
              runType: 'diagnostic_gemini',
              status: 'pending',
            },
          });
          await executeRunGemini(runGemini.id, { promptVersionId: promptVersion.id });
          runGeminiId = runGemini.id;
        } catch (geminiErr) {
          fastify.log.warn(
            { err: geminiErr, diagnosticId: diagnostic.id },
            'Run Gemini no ejecutado (sin key o error). Solo se muestra score OpenAI.'
          );
        }

        // Marcar completado de inmediato para que la UI redirija (el análisis IA va después)
        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { status: 'completed', ...(runGeminiId && { runGeminiId }) },
        });

        let analysisJson: object | null = null;
        let satelliteModule: SatelliteModuleResult | null = null;
        try {
          const fullRun = await prisma.run.findUnique({
            where: { id: run.id },
            include: {
              promptResults: {
                include: { prompt: { select: { promptText: true } } },
                orderBy: { createdAt: 'asc' },
              },
              brand: { include: { competitors: true } },
            },
          });
          const priaReport = await prisma.pRIAReport.findFirst({
            where: { runId: run.id },
            orderBy: { createdAt: 'desc' },
          });
          // PRIA puede faltar en carreras muy raras; buildRunContext tolera priaReport null (score 0).
          if (fullRun) {
            const ctx = buildRunContext({
              run: fullRun,
              priaReport,
              industry: industry || diagnostic.industry || 'General',
            });
            // Primera corrida del dominio = análisis completo: OpenAI + Gemini + perspectiva ambos (uno por uno y después juntos). Sin depender de Gold.
            const isFirstRun = await isFirstRunForDomain(diagnostic.id, diagnostic.domain);
            const analysis = await generateDiagnosticAnalysis(ctx, isFirstRun ? 'gold' : 'freemium');
            if (analysis) {
              analysisJson = analysis as object;
              if ((analysis as { tier?: string }).tier !== 'gold') {
                fastify.log.warn(
                  { diagnosticId: diagnostic.id },
                  'Gemini no disponible: solo se guardó análisis OpenAI. Configurá GEMINI_API_KEY en la API.'
                );
              }
            }
          }
        } catch (analysisErr) {
          fastify.log.warn({ err: analysisErr, diagnosticId: diagnostic.id }, 'Análisis IA no generado');
        }

        try {
          satelliteModule = await satellitePromise;
        } catch (satErr) {
          fastify.log.warn({ err: satErr, diagnosticId: diagnostic.id }, 'Módulo satélite no disponible');
        }

        const persistedAnalysis = buildAnalysisWithSatellite(analysisJson, satelliteModule);
        if (persistedAnalysis != null) {
          await prisma.publicDiagnostic.update({
            where: { id: diagnostic.id },
            data: { analysisJson: persistedAnalysis as object },
          });
          analysisJson = persistedAnalysis;
        }

        const current = await prisma.publicDiagnostic.findUnique({
          where: { id: diagnostic.id },
        });
        if (current?.email) {
          const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          try {
            if (!isEmailDisabled() && isEmailConfigured()) {
              await sendDiagnosticLink(
                current.email,
                diagnostic.id,
                baseUrl,
                analysisJson ? (analysisJson as import('../lib/email').DiagnosticAnalysisForEmail) : null
              );
              fastify.log.info({ diagnosticId: diagnostic.id, email: current.email }, 'Email enviado');
            }
          } catch (mailErr) {
            fastify.log.error({ err: mailErr, diagnosticId: diagnostic.id }, 'Error al enviar email');
          }
        }
      } catch (err) {
        fastify.log.error({ err, diagnosticId: diagnostic.id }, 'Error en diagnóstico');
        await prisma.publicDiagnostic
          .update({ where: { id: diagnostic.id }, data: { status: 'failed' } })
          .catch(() => {});
      }
    });

      return reply.code(201).send({ diagnosticId: diagnostic.id });
    } catch (err) {
      fastify.log.error({ err, body: request.body }, 'Error POST /diagnostic');
      const message = err instanceof Error ? err.message : 'Error interno';
      const isPrisma = message.includes('column') || message.includes('does not exist') || message.includes('Unknown');
      return reply.code(500).send({
        error: isPrisma
          ? 'Error de base de datos. Ejecutá en Railway: railway run npx prisma migrate deploy'
          : 'Error interno al crear el diagnóstico. Intentá de nuevo.',
      });
    }
  });

  // PATCH /api/public/diagnostic/:id — guarda email (al final del flujo)
  fastify.patch<{
    Params: { id: string };
    Body: { email: string };
  }>('/diagnostic/:id', async (request, reply) => {
    const schema = z.object({ email: z.string().email() });
    const { id } = request.params;
    const { email } = schema.parse(request.body);

    const diagnostic = await prisma.publicDiagnostic.findUnique({ where: { id } });
    if (!diagnostic) {
      return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
    }

    await prisma.publicDiagnostic.update({
      where: { id },
      data: { email },
    });

    let emailSent: boolean | null = null;
    let emailError: 'provider_rejected' | 'send_failed' | undefined;
    if (diagnostic.status === 'completed') {
      const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      try {
        if (!isEmailDisabled() && isEmailConfigured()) {
          const fresh = await prisma.publicDiagnostic.findUnique({
            where: { id },
            select: { analysisJson: true, tier: true, domain: true },
          });
          const isFirstRun = fresh ? await isFirstRunForDomain(id, fresh.domain) : false;
          const isGold = fresh?.tier === 'gold';
          const includeAnalysis = isFirstRun || isGold;
          const analysis =
            includeAnalysis &&
            fresh?.analysisJson &&
            typeof fresh.analysisJson === 'object' &&
            !Array.isArray(fresh.analysisJson)
              ? (fresh.analysisJson as import('../lib/email').DiagnosticAnalysisForEmail)
              : null;
          await sendDiagnosticLink(email, id, baseUrl, analysis);
          emailSent = true;
        } else {
          emailSent = false;
        }
      } catch (err) {
        emailSent = false;
        fastify.log.error({ err, diagnosticId: id, email }, 'Error al enviar email');
        const message = err instanceof Error ? err.message : String(err);
        emailError =
          message.includes('recipient') || message.includes('ENOTFOUND') || message.includes('refused')
            ? 'provider_rejected'
            : 'send_failed';
      }
    }

    return reply.code(200).send({ ok: true, emailSent, ...(emailError && { emailError }) });
  });

  // Fase 3: determina si es primera corrida para este dominio (ve todo) o Freemium (limitado)
  async function isFirstRunForDomain(diagnosticId: string, domain: string): Promise<boolean> {
    const firstCompleted = await prisma.publicDiagnostic.findFirst({
      where: { domain, status: 'completed' },
      orderBy: { createdAt: 'asc' },
    });
    return !!firstCompleted && firstCompleted.id === diagnosticId;
  }

  // GET /api/public/diagnostic/:id — estado, steps (industria, competidores, prompts) y resultado con Cleexs Score
  fastify.get<{ Params: { id: string }; Querystring: { tier?: string } }>('/diagnostic/:id', async (request, reply) => {
    const diagnostic = await prisma.publicDiagnostic.findUnique({
      where: { id: request.params.id },
    });
    if (!diagnostic) {
      return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
    }

    const tier =
      request.query?.tier === 'gold' || (diagnostic.tier ?? 'freemium') === 'gold' ? 'gold' : 'freemium';
    const isFirstRun = await isFirstRunForDomain(diagnostic.id, diagnostic.domain);
    const showFullReport = tier === 'gold' || isFirstRun;

    const runResultShape = {
      brandId: '' as string,
      brandName: '' as string,
      cleexsScore: 0 as number,
      competitors: [] as string[],
      brandAliases: [] as string[],
      promptResults: [] as Array<{
        category: string;
        score: number;
        promptText?: string;
        responseText?: string;
        top3Json?: Array<{ position: number; name: string; type: string; reason?: string }>;
        flags?: Record<string, boolean>;
      }>,
    };
    type RunResultType = typeof runResultShape;

    const base: {
      id: string;
      domain: string;
      brandName: string;
      industry?: string | null;
      status: string;
      tier: 'gold' | 'freemium';
      isFirstRun: boolean;
      showFullReport: boolean;
      runId?: string | null;
      steps?: Array<{ id: string; label: string; completed: boolean }>;
      progressPercent?: number;
      analysisJson?: object | null;
      satelliteModule?: SatelliteModuleResult | null;
      runResult?: RunResultType;
      runResultGemini?: RunResultType;
      trendData?: Array<{ label: string; score: number; date: string }>;
    } = {
      id: diagnostic.id,
      domain: diagnostic.domain,
      brandName: diagnostic.brandName,
      industry: diagnostic.industry,
      status: diagnostic.status,
      tier,
      isFirstRun,
      showFullReport,
      runId: diagnostic.runId,
    };

    if (diagnostic.analysisJson) {
      base.satelliteModule = extractSatelliteModuleFromAnalysis(diagnostic.analysisJson);
    }

    // 11 pasos fijos del análisis (todos deben cumplirse en el proceso)
    const DIAGNOSTIC_STEP_LABELS = [
      'Verificando acceso de IA al sitio',
      'Analizando orden para IA',
      'Midiendo claridad de respuesta',
      'Evaluando autoridad real',
      'Chequeando idioma para IA',
      'Revisando actualización de info',
      'Detectando confianza real',
      'Testeando carga y funcionamiento',
      'Rastreando menciones externas',
      'Midiendo intención cubierta',
      'Evaluando comprensión por IA',
    ];

    let steps: Array<{ id: string; label: string; completed: boolean }>;
    let progressPercent: number;

    if (diagnostic.runId && (diagnostic.status === 'running' || diagnostic.status === 'completed')) {
      const run = await prisma.run.findUnique({
        where: { id: diagnostic.runId },
        include: {
          promptResults: { select: { promptId: true }, orderBy: { createdAt: 'asc' } },
          priaReports: { take: 1, orderBy: { createdAt: 'desc' } },
          brand: { select: { name: true } },
        },
      });
      const completedCount = run?.promptResults.length ?? 0;
      const preCompleted = (!!diagnostic.industry ? 1 : 0) + (!!diagnostic.runId ? 1 : 0);
      const analysisStepsCount = DIAGNOSTIC_STEP_LABELS.length - 2;

      steps = DIAGNOSTIC_STEP_LABELS.map((label, idx) => {
        let completed: boolean;
        if (idx < 2) {
          completed = idx === 0 ? !!diagnostic.industry : !!diagnostic.runId;
        } else {
          completed = completedCount > idx - 2;
        }
        return { id: `step-${idx + 1}`, label, completed };
      });
      progressPercent = Math.round(
        ((preCompleted + Math.min(completedCount, analysisStepsCount)) / DIAGNOSTIC_STEP_LABELS.length) * 100
      );
      base.steps = steps;
      base.progressPercent = progressPercent;

      if (diagnostic.status === 'completed' && showFullReport && diagnostic.analysisJson && typeof diagnostic.analysisJson === 'object' && !Array.isArray(diagnostic.analysisJson)) {
        base.analysisJson = diagnostic.analysisJson as object;
      }

      if (run && diagnostic.status === 'completed' && run.priaReports[0]) {
        const fullRun = await prisma.run.findUnique({
          where: { id: diagnostic.runId },
          include: {
            promptResults: {
              include: {
                prompt: { include: { category: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
            brand: {
              include: { competitors: true, aliases: true },
            },
          },
        });
        if (fullRun) {
          const cleexsScore = run.priaReports[0].priaTotal;
          base.runResult = {
            brandId: fullRun.brand.id,
            brandName: fullRun.brand.name,
            cleexsScore,
            competitors: fullRun.brand.competitors.map((c) => c.name),
            brandAliases: fullRun.brand.aliases.map((a) => a.alias),
            promptResults: showFullReport
              ? fullRun.promptResults.map((pr) => ({
                  category: pr.prompt?.category?.name ?? 'General',
                  score: pr.score,
                  promptText: pr.prompt?.promptText ?? '',
                  responseText: pr.responseText,
                  top3Json: pr.top3Json as Array<{ position: number; name: string; type: string; reason?: string }>,
                  flags: (pr.flags as Record<string, boolean>) ?? {},
                }))
              : [],
          };
        }
      }

      // Run Gemini: mismo formato de runResult para score y métricas por modelo
      if (diagnostic.runGeminiId && diagnostic.status === 'completed' && showFullReport) {
        const runGemini = await prisma.run.findUnique({
          where: { id: diagnostic.runGeminiId },
          include: {
            promptResults: { select: { promptId: true }, orderBy: { createdAt: 'asc' } },
            priaReports: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        });
        if (runGemini?.status === 'completed' && runGemini.priaReports[0]) {
          const fullRunGemini = await prisma.run.findUnique({
            where: { id: diagnostic.runGeminiId },
            include: {
              promptResults: {
                include: {
                  prompt: { include: { category: true } },
                },
                orderBy: { createdAt: 'asc' },
              },
              brand: {
                include: { competitors: true, aliases: true },
              },
            },
          });
          if (fullRunGemini) {
            base.runResultGemini = {
              brandId: fullRunGemini.brand.id,
              brandName: fullRunGemini.brand.name,
              cleexsScore: runGemini.priaReports[0].priaTotal,
              competitors: fullRunGemini.brand.competitors.map((c) => c.name),
              brandAliases: fullRunGemini.brand.aliases.map((a) => a.alias),
              promptResults: fullRunGemini.promptResults.map((pr) => ({
                category: pr.prompt?.category?.name ?? 'General',
                score: pr.score,
                promptText: pr.prompt?.promptText ?? '',
                responseText: pr.responseText,
                top3Json: pr.top3Json as Array<{ position: number; name: string; type: string; reason?: string }>,
                flags: (pr.flags as Record<string, boolean>) ?? {},
              })),
            };
          }
        }
      }
    } else {
      const preCompleted = (!!diagnostic.industry ? 1 : 0) + (!!diagnostic.runId ? 1 : 0);
      steps = DIAGNOSTIC_STEP_LABELS.map((label, idx) => ({
        id: `step-${idx + 1}`,
        label,
        completed: idx < 2 && (idx === 0 ? !!diagnostic.industry : !!diagnostic.runId),
      }));
      progressPercent = Math.round((preCompleted / DIAGNOSTIC_STEP_LABELS.length) * 100);
      base.steps = steps;
      base.progressPercent = progressPercent;
    }

    // Tendencia: últimas corridas completadas del mismo dominio (promedio y N puntos)
    if (diagnostic.status === 'completed' && diagnostic.domain) {
      const lastDiagnostics = await prisma.publicDiagnostic.findMany({
        where: { domain: diagnostic.domain, status: 'completed', runId: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, runId: true, createdAt: true },
      });
      const runIds = lastDiagnostics.map((d) => d.runId).filter(Boolean) as string[];
      if (runIds.length > 0) {
        const runs = await prisma.run.findMany({
          where: { id: { in: runIds } },
          include: { priaReports: { take: 1, orderBy: { createdAt: 'desc' } } },
        });
        const scoreByRunId = new Map<string | null, number>();
        runs.forEach((r) => {
          const score = r.priaReports[0]?.priaTotal;
          if (score != null) scoreByRunId.set(r.id, score);
        });
        const chronological = [...lastDiagnostics].reverse();
        base.trendData = chronological
          .filter((d) => d.runId && scoreByRunId.has(d.runId))
          .map((d, idx) => ({
            label: `Corrida ${idx + 1}`,
            score: scoreByRunId.get(d.runId!) ?? 0,
            date: d.createdAt.toISOString(),
          }));
      }
    }

    return base;
  });
};

export default publicDiagnosticRoutes;
