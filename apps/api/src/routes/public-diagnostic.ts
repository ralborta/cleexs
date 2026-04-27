import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getAppBaseUrlForPublicLinks } from '../lib/app-public-url';
import { isEmailConfigured, isEmailDisabled, sendDiagnosticLink, sendShareCleexsFollowUpEmail } from '../lib/email';
import { executeRun, executeRunGemini } from '../lib/run-executor';
import { checkEntitlement, consumeEntitlement } from '../lib/entitlements';
import { EntitlementAction } from '@prisma/client';
import { runOutreachForRun } from '../lib/outreach';
import {
  determineMarketProfileForBrand,
  fetchSearchEvidence,
  getTop5Competitors,
  resolveCompetitorDomains,
} from '../lib/diagnostic-ai';
import { fetchSiteContextForDiagnostics } from '../lib/firecrawl-site-context';
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

/** Evita respuestas de varios MB en GET /diagnostic/:id (polling + JSON gigante desde Postgres). */
const MAX_PUBLIC_RESPONSE_TEXT_CHARS = 14_000;
const MAX_SATELLITE_TOOL_DETAIL_JSON_CHARS = 8_000;

function truncatePromptResponseText(text: string | null | undefined): string | undefined {
  if (text == null || text === '') return undefined;
  if (text.length <= MAX_PUBLIC_RESPONSE_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_PUBLIC_RESPONSE_TEXT_CHARS)}… [truncado]`;
}

/** Recorta `detail` por herramienta del módulo satélite en la respuesta HTTP (no altera lo guardado en DB). */
function sanitizeAnalysisJsonForPublicGet(json: unknown): object {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return json as object;
  const o = json as Record<string, unknown>;
  const ext = o.externalModules;
  if (!ext || typeof ext !== 'object' || Array.isArray(ext)) return o as object;
  const em = { ...(ext as Record<string, unknown>) };
  const sat = em.satelliteAeo;
  if (!sat || typeof sat !== 'object' || Array.isArray(sat)) return { ...o, externalModules: em } as object;
  const satObj = sat as Record<string, unknown>;
  const tools = satObj.tools;
  if (!tools || typeof tools !== 'object' || Array.isArray(tools)) return { ...o, externalModules: em } as object;
  const newTools: Record<string, unknown> = {};
  for (const [key, tool] of Object.entries(tools)) {
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) {
      newTools[key] = tool;
      continue;
    }
    const t = tool as Record<string, unknown>;
    const d = t.detail;
    if (d === undefined) {
      newTools[key] = t;
      continue;
    }
    try {
      const s = JSON.stringify(d);
      if (s.length > MAX_SATELLITE_TOOL_DETAIL_JSON_CHARS) {
        newTools[key] = {
          ...t,
          detail: {
            _truncated: true,
            _note: 'Detalle recortado en la API por tamaño; usá el análisis técnico o Cleexs Tools.',
            score: t.score,
          },
        };
      } else {
        newTools[key] = t;
      }
    } catch {
      newTools[key] = { ...t, detail: { _truncated: true } };
    }
  }
  em.satelliteAeo = { ...satObj, tools: newTools };
  return { ...o, externalModules: em } as object;
}

/** Límite blando del JSON completo al hacer UPDATE en Postgres (evita conexiones largas / resets). */
const MAX_DB_ANALYSIS_JSON_STRING_CHARS = 1_400_000;
const MAX_DB_SATELLITE_TOOL_DETAIL_CHARS = 12_000;

/**
 * Recorta análisis + satélite antes de persistir en `analysis_json`.
 * Un JSON de varios MB en un solo UPDATE suele provocar timeouts y "Connection reset by peer" en el pool.
 */
function shrinkAnalysisJsonForPersistence(input: object): object {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  } catch {
    return input;
  }

  const trimStr = (s: unknown, max: number): unknown =>
    typeof s === 'string' && s.length > max ? `${s.slice(0, max)}… [truncado al guardar]` : s;

  if (o.tier === 'gold') {
    const ao = o.analisisOpenAI as Record<string, unknown> | undefined;
    const ag = o.analisisGemini as Record<string, unknown> | undefined;
    if (ao) {
      ao.resumenEjecutivo = trimStr(ao.resumenEjecutivo, 48_000);
      ao.contextoCompetitivo = trimStr(ao.contextoCompetitivo, 16_000);
      ao.aspectosAdicionales = trimStr(ao.aspectosAdicionales, 16_000);
    }
    if (ag) {
      ag.resumenEjecutivo = trimStr(ag.resumenEjecutivo, 48_000);
      ag.contextoCompetitivo = trimStr(ag.contextoCompetitivo, 16_000);
      ag.aspectosAdicionales = trimStr(ag.aspectosAdicionales, 16_000);
    }
    o.perspectivaAmbos = trimStr(o.perspectivaAmbos, 12_000);
  } else {
    o.resumenEjecutivo = trimStr(o.resumenEjecutivo, 64_000);
    o.contextoCompetitivo = trimStr(o.contextoCompetitivo, 20_000);
    o.aspectosAdicionales = trimStr(o.aspectosAdicionales, 20_000);
  }

  const ext = o.externalModules;
  if (ext && typeof ext === 'object' && !Array.isArray(ext)) {
    const em = ext as Record<string, unknown>;
    const sat = em.satelliteAeo;
    if (sat && typeof sat === 'object' && !Array.isArray(sat)) {
      const so = { ...(sat as Record<string, unknown>) };
      const tools = so.tools;
      if (tools && typeof tools === 'object' && !Array.isArray(tools)) {
        const nt: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(tools)) {
          if (!v || typeof v !== 'object' || Array.isArray(v)) {
            nt[k] = v;
            continue;
          }
          const t = v as Record<string, unknown>;
          const d = t.detail;
          if (d !== undefined) {
            try {
              const ds = JSON.stringify(d);
              if (ds.length > MAX_DB_SATELLITE_TOOL_DETAIL_CHARS) {
                nt[k] = {
                  score: t.score,
                  error: t.error,
                  detail: {
                    _truncated: true,
                    _note: 'Recortado al guardar por tamaño.',
                  },
                };
              } else {
                nt[k] = t;
              }
            } catch {
              nt[k] = { score: t.score, error: t.error };
            }
          } else {
            nt[k] = t;
          }
        }
        so.tools = nt;
      }
      if (Array.isArray(so.actions) && so.actions.length > 150) {
        so.actions = so.actions.slice(0, 150);
      }
      em.satelliteAeo = so;
      o.externalModules = em;
    }
  }

  let str = JSON.stringify(o);
  if (str.length > MAX_DB_ANALYSIS_JSON_STRING_CHARS) {
    console.warn(
      `[public-diagnostic] analysis_json ~${str.length} chars; stripping satellite tool details for DB UPDATE`
    );
    const ext2 = o.externalModules;
    if (ext2 && typeof ext2 === 'object' && !Array.isArray(ext2)) {
      const em = ext2 as Record<string, unknown>;
      const sat = em.satelliteAeo;
      if (sat && typeof sat === 'object' && !Array.isArray(sat)) {
        const so = { ...(sat as Record<string, unknown>) };
        const tools = so.tools;
        if (tools && typeof tools === 'object' && !Array.isArray(tools)) {
          const nt: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(tools)) {
            if (!v || typeof v !== 'object' || Array.isArray(v)) {
              nt[k] = v;
              continue;
            }
            const t = v as Record<string, unknown>;
            nt[k] = {
              score: t.score,
              error: t.error,
              ...(t.detail ? { detail: { _omitted: true } } : {}),
            };
          }
          so.tools = nt;
        }
        em.satelliteAeo = so;
        o.externalModules = em;
      }
    }
    str = JSON.stringify(o);
    if (str.length > MAX_DB_ANALYSIS_JSON_STRING_CHARS) {
      o._persistNote = 'Payload recortado agresivamente por tamaño.';
    }
  }

  return o as object;
}

const VIRAL_UNLOCK_MIN = Math.max(1, Number(process.env.PUBLIC_SHARE_VIRAL_UNLOCK_MIN ?? '5') || 5);

function extractResumenTeaser(analysisJson: unknown): string {
  if (!analysisJson || typeof analysisJson !== 'object' || Array.isArray(analysisJson)) return '';
  const j = analysisJson as Record<string, unknown>;
  let text = '';
  if (typeof j.resumenEjecutivo === 'string') text = j.resumenEjecutivo;
  else if (j.analisisOpenAI && typeof j.analisisOpenAI === 'object' && !Array.isArray(j.analisisOpenAI)) {
    const ao = j.analisisOpenAI as Record<string, unknown>;
    if (typeof ao.resumenEjecutivo === 'string') text = ao.resumenEjecutivo;
  }
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= 520) return t;
  return `${t.slice(0, 517)}…`;
}

async function ensureShareSlug(diagnosticId: string): Promise<string | null> {
  const row = await prisma.publicDiagnostic.findUnique({
    where: { id: diagnosticId },
    select: { id: true, domain: true, brandName: true, shareSlug: true },
  });
  if (!row) return null;
  const currentSlug = row.shareSlug?.toLowerCase().trim();
  const isWeakCurrentSlug =
    !!currentSlug &&
    (GENERIC_TLDS.has(currentSlug) || currentSlug.length < 4 || !/^[a-z0-9-]+$/.test(currentSlug));
  if (currentSlug && !isWeakCurrentSlug) return currentSlug;

  const rawBase = row.domain.startsWith('brand-')
    ? slugify(row.brandName) || 'marca'
    : row.domain.replace(/^www\./i, '').replace(/\./g, '-');
  const brandBase = slugify(row.brandName) || 'marca';
  let base = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  if (GENERIC_TLDS.has(base) || base.length < 4) {
    base = `${brandBase}-${base || 'score'}-${row.id.slice(0, 5)}`
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 72);
  }
  if (!base) base = `score-${row.id.slice(0, 8)}`;

  for (let i = 0; i < 80; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`;
    const clash = await prisma.publicDiagnostic.findFirst({
      where: { shareSlug: candidate, NOT: { id: row.id } },
      select: { id: true },
    });
    if (!clash) {
      await prisma.publicDiagnostic.update({
        where: { id: row.id },
        data: { shareSlug: candidate },
      });
      return candidate;
    }
  }
  const fallback = `s-${row.id.slice(0, 12)}`;
  await prisma.publicDiagnostic.update({
    where: { id: row.id },
    data: { shareSlug: fallback },
  });
  return fallback;
}

const publicDiagnosticRoutes: FastifyPluginAsync = async (fastify) => {
  // Turnstile deshabilitado (URLs dinámicas de Vercel). Reactivar cuando haya dominio estable.

  // POST /api/public/diagnostic — marca y/o url (al menos uno obligatorio) + tier (freemium|gold)
  fastify.post<{
    Body: {
      brandName?: string;
      url?: string;
      tier?: 'freemium' | 'gold';
      refCode?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    };
  }>('/diagnostic', async (request, reply) => {
    try {
      const trackingField = z
        .string()
        .trim()
        .max(120)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Formato inválido')
        .optional();
      const schema = z.object({
        brandName: z.string().max(200).optional(),
        url: z.union([z.string().max(500), z.undefined()]).optional(),
        tier: z.enum(['freemium', 'gold']).optional(),
        refCode: trackingField,
        utmSource: trackingField,
        utmMedium: trackingField,
        utmCampaign: trackingField,
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.errors.map((e) => e.message).join(', ') || 'Datos inválidos.',
        });
      }
      const { brandName, url, tier: requestedTier, refCode, utmSource, utmMedium, utmCampaign } = parsed.data;
      const trimmedBrand = (brandName ?? '').trim();
      const trimmedUrl = (url ?? '').trim();
      const visitorIdHeader = request.headers['x-visitor-id'];
      const visitorId = typeof visitorIdHeader === 'string' ? visitorIdHeader.trim() : '';

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

      if (visitorId) {
        const canGenerate = await checkEntitlement(prisma, {
          actor: { anonymousId: visitorId },
          action: EntitlementAction.score_generate,
        });
        if (!canGenerate.allowed) {
          return reply.code(403).send({
            error: canGenerate.reason || 'Límite de diagnósticos alcanzado para visitante anónimo.',
            code: canGenerate.code,
            usage: canGenerate.usage,
            limit: canGenerate.limit,
          });
        }
      }

      const diagnostic = await prisma.publicDiagnostic.create({
        data: {
          brandName: brandForRun,
          domain,
          status: 'running',
          tier,
          ...(refCode ? { refCode: refCode.toLowerCase() } : {}),
          ...(utmSource ? { utmSource: utmSource.toLowerCase() } : {}),
          ...(utmMedium ? { utmMedium: utmMedium.toLowerCase() } : {}),
          ...(utmCampaign ? { utmCampaign: utmCampaign.toLowerCase() } : {}),
        },
      });

      if (visitorId) {
        await consumeEntitlement(prisma, {
          actor: { anonymousId: visitorId },
          action: EntitlementAction.score_generate,
          dedupeKey: `anon-score-generate:${visitorId}:${diagnostic.id}`,
          metaJson: { diagnosticId: diagnostic.id, domain },
        });
      }

      setImmediate(async () => {
      try {
        // Evitar competencia de cuota/latencia con OpenAI durante el core del diagnóstico.
        // El satélite se ejecuta al final para que no degrade la corrida principal.
        // 1. País: por TLD del dominio si aplica (nike.com.co → Colombia), sino por búsqueda web + IA
        const countryFromTld = trimmedUrl ? getCountryFromDomain(trimmedUrl) : null;
        let searchEvidence = '';
        if (!countryFromTld) {
          searchEvidence = await fetchSearchEvidence(brandForRun);
        }

        let firecrawlSiteMarkdown: string | undefined;
        if (trimmedUrl) {
          const fcKey = process.env.FIRECRAWL_API_KEY;
          const fcMax = Number(process.env.PUBLIC_DIAGNOSTIC_FIRECRAWL_MAX_PAGES || 3);
          try {
            const siteCtx = await fetchSiteContextForDiagnostics(trimmedUrl, fcKey, {
              maxPages: Number.isFinite(fcMax) ? Math.min(5, Math.max(1, fcMax)) : 3,
            });
            if (siteCtx) {
              firecrawlSiteMarkdown = siteCtx.markdown;
              fastify.log.info(
                {
                  diagnosticId: diagnostic.id,
                  sourceUrls: siteCtx.sourceUrls,
                  chars: siteCtx.markdown.length,
                },
                'Firecrawl: contexto del sitio para vertical/competidores'
              );
            }
          } catch (err) {
            fastify.log.warn(
              { err, diagnosticId: diagnostic.id },
              'Firecrawl contexto sitio falló; se continúa sin crawl'
            );
          }
        }

        const marketProfile = await determineMarketProfileForBrand(
          brandForRun,
          defaultCountry,
          'General',
          trimmedUrl || undefined,
          searchEvidence || undefined,
          countryFromTld || undefined,
          firecrawlSiteMarkdown
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
            usedFirecrawlContext: !!firecrawlSiteMarkdown,
            verticalSummary: marketProfile.verticalSummary,
            customerSegment: marketProfile.customerSegment,
            marketConfidence: marketProfile.confidence,
            marketConfidenceMin,
          },
          'Perfil de mercado (país por TLD o búsqueda+IA, industria por IA + Firecrawl si aplica)'
        );
        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { industry },
        });

        // 2. IA elige 5 competidores
        const { competitors } = await getTop5Competitors(brandForRun, industry, marketCountry, {
          verticalSummary: marketProfile.verticalSummary,
          customerSegment: marketProfile.customerSegment,
        });

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

        // 3a. Resolver dominio oficial de cada competidor para habilitar outreach automatico
        // (Firecrawl/Hunter requieren dominio). Si OpenAI no lo sabe, domain queda null.
        let competitorDomainMap = new Map<string, string | null>();
        try {
          const resolved = await resolveCompetitorDomains(
            competitors,
            marketCountry,
            industry,
            marketProfile.verticalSummary
          );
          for (const entry of resolved) {
            competitorDomainMap.set(entry.name.toLowerCase(), entry.domain);
          }
          fastify.log.info(
            {
              diagnosticId: diagnostic.id,
              resolved: resolved.map((r) => ({ name: r.name, domain: r.domain })),
            },
            'Dominios de competidores resueltos'
          );
        } catch (err) {
          fastify.log.warn(
            { err, diagnosticId: diagnostic.id },
            'No se pudieron resolver dominios de competidores (se guardan sin domain)'
          );
        }

        for (const name of competitors) {
          const cleanName = name.trim() || 'Competidor';
          const domain = competitorDomainMap.get(cleanName.toLowerCase()) ?? null;
          await prisma.competitor.create({
            data: {
              brandId: brand.id,
              name: cleanName,
              domain,
              autoDetected: true,
            },
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

        // Marcar completado apenas termina OpenAI para no bloquear UX.
        // Gemini (si existe) se calcula luego en segundo plano.
        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { status: 'completed' },
        });

        // Outreach automatico: detecta competidores que ganan + busca contactos con Firecrawl y Hunter.
        // Fire-and-forget para no bloquear la UX. No envia correos, solo persiste LeadSource + LeadContact.
        setImmediate(() => {
          runOutreachForRun(rootTenant.id, run.id, { enrich: true, logger: fastify.log })
            .then((outreach) => {
              fastify.log.info(
                { diagnosticId: diagnostic.id, runId: run.id, outreach },
                'Outreach automatico completado'
              );
            })
            .catch((err) => {
              fastify.log.warn(
                { err, diagnosticId: diagnostic.id, runId: run.id },
                'Outreach automatico fallo'
              );
            });
        });

        // Run Gemini con los mismos prompts (score y métricas para Gemini), no bloqueante para la UI.
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
          await prisma.publicDiagnostic.update({
            where: { id: diagnostic.id },
            data: { runGeminiId: runGemini.id },
          });
          await executeRunGemini(runGemini.id, { promptVersionId: promptVersion.id });
        } catch (geminiErr) {
          fastify.log.warn(
            { err: geminiErr, diagnosticId: diagnostic.id },
            'Run Gemini no ejecutado (sin key o error). Solo se muestra score OpenAI.'
          );
        }

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

        if (trimmedUrl) {
          try {
            satelliteModule = await runSatelliteAnalysis(trimmedUrl);
          } catch (satErr) {
            fastify.log.warn({ err: satErr, diagnosticId: diagnostic.id }, 'Módulo satélite no disponible');
          }
        }

        const persistedAnalysis = buildAnalysisWithSatellite(analysisJson, satelliteModule);
        if (persistedAnalysis != null) {
          const safeForDb = shrinkAnalysisJsonForPersistence(persistedAnalysis);
          await prisma.publicDiagnostic.update({
            where: { id: diagnostic.id },
            data: { analysisJson: safeForDb },
          });
          analysisJson = safeForDb;
        }

        void ensureShareSlug(diagnostic.id).catch((err) =>
          fastify.log.warn({ err, diagnosticId: diagnostic.id }, 'No se pudo asignar share_slug')
        );

        const current = await prisma.publicDiagnostic.findUnique({
          where: { id: diagnostic.id },
        });
        if (current?.email) {
          const baseUrl = getAppBaseUrlForPublicLinks();
          try {
            if (!isEmailDisabled() && isEmailConfigured()) {
              await sendDiagnosticLink(
                current.email,
                diagnostic.id,
                baseUrl,
                analysisJson ? (analysisJson as import('../lib/email').DiagnosticAnalysisForEmail) : null
              );
              try {
                await sendShareCleexsFollowUpEmail(current.email, diagnostic.id, baseUrl, current.brandName);
              } catch (shareErr) {
                fastify.log.error({ err: shareErr, diagnosticId: diagnostic.id }, 'Error al enviar email de compartir');
              }
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
      const baseUrl = getAppBaseUrlForPublicLinks();
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
          try {
            await sendShareCleexsFollowUpEmail(email, id, baseUrl, diagnostic.brandName);
          } catch (shareErr) {
            fastify.log.error({ err: shareErr, diagnosticId: id }, 'Error al enviar email de compartir');
          }
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

  type ShareRunResult = {
    brandId: string;
    brandName: string;
    cleexsScore: number;
    competitors: string[];
    brandAliases: string[];
    promptResults: Array<{
      category: string;
      score: number;
      promptText?: string;
      responseText?: string;
      top3Json?: Array<{ position: number; name: string; type: string; reason?: string }>;
      flags?: Record<string, boolean>;
    }>;
  };

  async function buildShareUnlockedPayload(diagnostic: {
    id: string;
    domain: string;
    runId: string | null;
    runGeminiId: string | null;
    status: string;
    analysisJson: unknown;
  }): Promise<{
    analysisJson?: object | null;
    satelliteModule?: SatelliteModuleResult | null;
    runResult?: ShareRunResult;
    runResultGemini?: ShareRunResult;
    trendData?: Array<{ label: string; score: number; date: string }>;
  }> {
    const out: {
      analysisJson?: object | null;
      satelliteModule?: SatelliteModuleResult | null;
      runResult?: ShareRunResult;
      runResultGemini?: ShareRunResult;
      trendData?: Array<{ label: string; score: number; date: string }>;
    } = {};
    if (diagnostic.analysisJson) {
      out.satelliteModule = extractSatelliteModuleFromAnalysis(diagnostic.analysisJson);
    }
    if (diagnostic.status !== 'completed' || !diagnostic.runId) {
      return out;
    }
    if (diagnostic.analysisJson && typeof diagnostic.analysisJson === 'object' && !Array.isArray(diagnostic.analysisJson)) {
      out.analysisJson = sanitizeAnalysisJsonForPublicGet(diagnostic.analysisJson);
    }

    const runPeek = await prisma.run.findUnique({
      where: { id: diagnostic.runId },
      include: { priaReports: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
    if (runPeek?.priaReports[0]) {
      const fullRun = await prisma.run.findUnique({
        where: { id: diagnostic.runId },
        include: {
          promptResults: {
            include: { prompt: { include: { category: true } } },
            orderBy: { createdAt: 'asc' },
          },
          brand: { include: { competitors: true, aliases: true } },
        },
      });
      if (fullRun) {
        out.runResult = {
          brandId: fullRun.brand.id,
          brandName: fullRun.brand.name,
          cleexsScore: runPeek.priaReports[0].priaTotal,
          competitors: fullRun.brand.competitors.map((c) => c.name),
          brandAliases: fullRun.brand.aliases.map((a) => a.alias),
          promptResults: fullRun.promptResults.map((pr) => ({
            category: pr.prompt?.category?.name ?? 'General',
            score: pr.score,
            promptText: pr.prompt?.promptText ?? '',
            responseText: truncatePromptResponseText(pr.responseText),
            top3Json: pr.top3Json as Array<{ position: number; name: string; type: string; reason?: string }>,
            flags: (pr.flags as Record<string, boolean>) ?? {},
          })),
        };
      }
    }

    if (diagnostic.runGeminiId) {
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
              include: { prompt: { include: { category: true } } },
              orderBy: { createdAt: 'asc' },
            },
            brand: { include: { competitors: true, aliases: true } },
          },
        });
        if (fullRunGemini) {
          out.runResultGemini = {
            brandId: fullRunGemini.brand.id,
            brandName: fullRunGemini.brand.name,
            cleexsScore: runGemini.priaReports[0].priaTotal,
            competitors: fullRunGemini.brand.competitors.map((c) => c.name),
            brandAliases: fullRunGemini.brand.aliases.map((a) => a.alias),
            promptResults: fullRunGemini.promptResults.map((pr) => ({
              category: pr.prompt?.category?.name ?? 'General',
              score: pr.score,
              promptText: pr.prompt?.promptText ?? '',
              responseText: truncatePromptResponseText(pr.responseText),
              top3Json: pr.top3Json as Array<{ position: number; name: string; type: string; reason?: string }>,
              flags: (pr.flags as Record<string, boolean>) ?? {},
            })),
          };
        }
      }
    }

    if (diagnostic.domain) {
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
        out.trendData = chronological
          .filter((d) => d.runId && scoreByRunId.has(d.runId))
          .map((d, idx) => ({
            label: `Corrida ${idx + 1}`,
            score: scoreByRunId.get(d.runId!) ?? 0,
            date: d.createdAt.toISOString(),
          }));
      }
    }

    return out;
  }

  // GET /api/public/diagnostic/share/:slug — vista pública (teaser o reporte completo si gold o desbloqueo viral)
  fastify.get<{ Params: { slug: string } }>('/diagnostic/share/:slug', async (request, reply) => {
    const slug = request.params.slug.toLowerCase().trim();
    if (!slug || slug.length > 96 || !/^[a-z0-9-]+$/.test(slug)) {
      return reply.code(400).send({ error: 'Enlace inválido.' });
    }
    const row = await prisma.publicDiagnostic.findFirst({
      where: { shareSlug: slug },
      select: {
        id: true,
        domain: true,
        brandName: true,
        industry: true,
        status: true,
        tier: true,
        runId: true,
        runGeminiId: true,
      },
    });
    if (!row) {
      return reply.code(404).send({ error: 'Enlace no encontrado.' });
    }

    const visitorIdHeader = request.headers['x-visitor-id'];
    const visitorId =
      (typeof visitorIdHeader === 'string' && visitorIdHeader.trim()) ||
      (typeof request.query === 'object' &&
      request.query &&
      'visitorId' in (request.query as Record<string, unknown>) &&
      typeof (request.query as Record<string, unknown>).visitorId === 'string'
        ? ((request.query as Record<string, unknown>).visitorId as string)
        : undefined);

    if (visitorId) {
      const entitlement = await checkEntitlement(prisma, {
        actor: { anonymousId: visitorId },
        action: EntitlementAction.score_view,
        profileSlug: slug,
      });

      if (!entitlement.allowed) {
        return reply.code(403).send({
          error: entitlement.reason || 'Límite de vistas alcanzado para visitante anónimo.',
          code: entitlement.code,
          plan: entitlement.plan,
          planKey: entitlement.planKey,
          planDisplay: entitlement.planDisplay,
          usage: entitlement.usage,
          limit: entitlement.limit,
          upgradePath: '/planes',
        });
      }

      await consumeEntitlement(prisma, {
        actor: { anonymousId: visitorId },
        action: EntitlementAction.score_view,
        profileSlug: slug,
        dedupeKey: `anon-score-view:${visitorId}:${slug}`,
        metaJson: { diagnosticId: row.id, slug },
      });
    }

    const visitCount = await prisma.publicDiagnosticShareVisit.count({
      where: { diagnosticId: row.id },
    });
    const tier = row.tier === 'gold' ? 'gold' : 'freemium';
    const goldUnlocked = tier === 'gold';
    const viralUnlocked = visitCount >= VIRAL_UNLOCK_MIN;
    const shareFullUnlocked = goldUnlocked || viralUnlocked;
    let geminiStatus: 'ready' | 'running' | 'not_available' = 'not_available';

    let analysisJson: unknown = null;
    if (row.status === 'completed') {
      const j = await prisma.publicDiagnostic.findUnique({
        where: { id: row.id },
        select: { analysisJson: true },
      });
      analysisJson = j?.analysisJson ?? null;
    }

    const resumenTeaser = extractResumenTeaser(analysisJson);
    let cleexsScore: number | null = null;
    let preview:
      | {
          totalPrompts: number;
          avgPromptScore: number;
          topCategory: string | null;
          brandTop3PresencePct: number;
          competitorCount: number;
          geminiStatus: 'ready' | 'running' | 'not_available';
        }
      | null = null;
    if (row.runId && row.status === 'completed') {
      const pria = await prisma.pRIAReport.findFirst({
        where: { runId: row.runId },
        orderBy: { createdAt: 'desc' },
      });
      if (pria) cleexsScore = pria.priaTotal;

      const runForPreview = await prisma.run.findUnique({
        where: { id: row.runId },
        include: {
          promptResults: {
            include: { prompt: { include: { category: true } } },
            orderBy: { createdAt: 'asc' },
          },
          brand: { include: { competitors: true } },
        },
      });

      if (row.runGeminiId) {
        const runGemini = await prisma.run.findUnique({
          where: { id: row.runGeminiId },
          select: { status: true },
        });
        if (runGemini?.status === 'completed') geminiStatus = 'ready';
        else if (runGemini?.status === 'pending' || runGemini?.status === 'running') geminiStatus = 'running';
      }

      if (runForPreview) {
        const promptResults = runForPreview.promptResults;
        const totalPrompts = promptResults.length;
        const avgPromptScore = totalPrompts
          ? promptResults.reduce((acc, pr) => acc + (pr.score || 0), 0) / totalPrompts
          : 0;
        const categoryTotals = new Map<string, { sum: number; count: number }>();
        let brandTop3Count = 0;

        promptResults.forEach((pr) => {
          const categoryName = pr.prompt?.category?.name ?? 'General';
          const current = categoryTotals.get(categoryName) ?? { sum: 0, count: 0 };
          categoryTotals.set(categoryName, { sum: current.sum + (pr.score || 0), count: current.count + 1 });
          const entries = (pr.top3Json as Array<{ type?: string }> | null) ?? [];
          if (entries.some((e) => e?.type === 'brand')) brandTop3Count += 1;
        });

        let topCategory: string | null = null;
        let bestCategoryAvg = -1;
        categoryTotals.forEach((v, k) => {
          const avg = v.count ? v.sum / v.count : 0;
          if (avg > bestCategoryAvg) {
            bestCategoryAvg = avg;
            topCategory = k;
          }
        });

        preview = {
          totalPrompts,
          avgPromptScore,
          topCategory,
          brandTop3PresencePct: totalPrompts ? (brandTop3Count / totalPrompts) * 100 : 0,
          competitorCount: runForPreview.brand.competitors.length,
          geminiStatus,
        };
      }
    }

    const payload: Record<string, unknown> = {
      slug,
      diagnosticId: row.id,
      brandName: row.brandName,
      industry: row.industry,
      domain: row.domain,
      status: row.status,
      tier,
      cleexsScore,
      resumenTeaser,
      unlock: {
        goldUnlocked,
        viralUnlocked,
        uniqueVisitCount: visitCount,
        visitsNeeded: Math.max(0, VIRAL_UNLOCK_MIN - visitCount),
        viralUnlockMin: VIRAL_UNLOCK_MIN,
      },
      shareFullUnlocked,
      ...(preview ? { preview } : {}),
    };

    if (shareFullUnlocked && row.status === 'completed') {
      const extra = await buildShareUnlockedPayload({
        ...row,
        analysisJson,
      });
      Object.assign(payload, extra);
    }

    return payload;
  });

  fastify.post<{ Params: { slug: string }; Body: { visitorId?: string } }>(
    '/diagnostic/share/:slug/visit',
    async (request, reply) => {
      const slug = request.params.slug.toLowerCase().trim();
      const visitorSchema = z.object({ visitorId: z.string().uuid() });
      const parsed = visitorSchema.safeParse(request.body ?? {});
      if (!slug || !parsed.success) {
        return reply.code(400).send({ error: 'visitorId UUID requerido.' });
      }
      const { visitorId } = parsed.data;

      const row = await prisma.publicDiagnostic.findFirst({
        where: { shareSlug: slug },
        select: { id: true, tier: true },
      });
      if (!row) {
        return reply.code(404).send({ error: 'Enlace no encontrado.' });
      }

      await prisma.publicDiagnosticShareVisit.upsert({
        where: {
          diagnosticId_visitorId: { diagnosticId: row.id, visitorId },
        },
        create: { diagnosticId: row.id, visitorId },
        update: {},
      });

      const uniqueVisitCount = await prisma.publicDiagnosticShareVisit.count({
        where: { diagnosticId: row.id },
      });
      const tier = row.tier === 'gold' ? 'gold' : 'freemium';
      const viralUnlocked = uniqueVisitCount >= VIRAL_UNLOCK_MIN;
      const shareFullUnlocked = tier === 'gold' || viralUnlocked;

      return {
        ok: true,
        uniqueVisitCount,
        viralUnlocked,
        shareFullUnlocked,
        visitsNeeded: Math.max(0, VIRAL_UNLOCK_MIN - uniqueVisitCount),
      };
    }
  );

  // GET /api/public/diagnostic/:id — estado, steps (industria, competidores, prompts) y resultado con Cleexs Score
  fastify.get<{ Params: { id: string }; Querystring: { tier?: string } }>('/diagnostic/:id', async (request, reply) => {
    const id = request.params.id;
    // No cargar analysis_json (puede ser MB) mientras corre el job; reduce carga en Postgres y tiempo de respuesta.
    const row = await prisma.publicDiagnostic.findUnique({
      where: { id },
      select: {
        id: true,
        domain: true,
        brandName: true,
        industry: true,
        status: true,
        tier: true,
        runId: true,
        runGeminiId: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        shareSlug: true,
      },
    });
    if (!row) {
      return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
    }

    let analysisJson: unknown = null;
    if (row.status === 'completed') {
      const jsonOnly = await prisma.publicDiagnostic.findUnique({
        where: { id },
        select: { analysisJson: true },
      });
      analysisJson = jsonOnly?.analysisJson ?? null;
    }

    const diagnostic = { ...row, analysisJson };

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

    let shareSlugOut: string | null = row.shareSlug ?? null;
    if (row.status === 'completed') {
      shareSlugOut = (await ensureShareSlug(row.id)) ?? shareSlugOut;
    }

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
      runGeminiId?: string | null;
      /** Estado del run Gemini (si existe); útil para pestañas y polling en el cliente. */
      geminiRunStatus?: 'pending' | 'running' | 'completed' | 'failed' | null;
      shareSlug?: string | null;
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
      runGeminiId: diagnostic.runGeminiId ?? null,
      shareSlug: shareSlugOut,
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
        base.analysisJson = sanitizeAnalysisJsonForPublicGet(diagnostic.analysisJson);
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
                  responseText: truncatePromptResponseText(pr.responseText),
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
        base.geminiRunStatus = runGemini?.status ?? null;
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
                responseText: truncatePromptResponseText(pr.responseText),
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
