import type { FastifyBaseLogger } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { getAppBaseUrlForPublicLinks } from '../lib/app-public-url';
import { isEmailConfigured, isEmailDisabled, sendDiagnosticLink, sendShareCleexsFollowUpEmail } from '../lib/email';
import { executeRun, executeRunGemini } from '../lib/run-executor';
import { checkEntitlement, consumeEntitlement } from '../lib/entitlements';
import { EntitlementAction, Prisma } from '@prisma/client';
import { runOutreachForRun } from '../lib/outreach';
import {
  getTop5Competitors,
  resolveBrandAnalysisContext,
  resolveCompetitorDomains,
} from '../lib/diagnostic-ai';
import { getDefaultDiagnosticIntention, buildDiagnosticPrompts } from '../lib/diagnostic-prompts';
import { buildRunContext, generateDiagnosticAnalysis } from '../lib/diagnostic-analysis';
import { runSatelliteAnalysis, deepTruncateSatelliteDetail, type SatelliteModuleResult } from '../lib/satellite-client';
import { isBuilderBotSendConfigured, sendWhatsAppMessage } from '../lib/builderbot';
import { notifyWhatsAppDiagnosticCompleted } from '../lib/whatsapp-notify';
import {
  buildWaResultUrl,
  buildWhatsAppAskUrlReply,
  buildWhatsAppCleexsFaqReply,
  buildWhatsAppCompletedReply,
  buildWhatsAppErrorReply,
  buildWhatsAppAlreadyStartedReply,
  buildWhatsAppStartedReply,
  buildWhatsAppStillRunningReply,
  buildWhatsAppTeaserLine,
  deliverWaChannelStart,
  deliverWaReplyToUser,
  extractUrlFromWhatsAppMessage,
  buildWhatsAppGreetingReply,
  isWaGreetingMessage,
  resolveWebsiteUrlFromWhatsAppMessage,
  getWaChannelDailyLimit,
  getWaCompetitorWaitMs,
  isCleexsFaqOnlyMessage,
  isPlaceholderPublicSuffixOnlyDomain,
  isWhatsAppSourceChannel,
  normalizeWaPhone,
  verifyWhatsAppChannelApiKey,
  waPlaceholderEmail,
  waRecipientFromFlowBody,
} from '../lib/whatsapp-channel';

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

/** Heurística si la IA devolvió nombre sin dominio: proponer `slug.com` para que el usuario edite en el wizard. */
function slugHostGuessFromCompetitorName(name: string): string | null {
  const s = `${name || ''}`
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48);
  if (s.length < 2) return null;
  return `${s}.com`;
}

function normalizeDomain(url: string): string {
  // Sufijos donde el dominio registrable incluye 3+ etiquetas (ej. colegio.edu.ar, no "edu.ar").
  const COMPOUND_PUBLIC_SUFFIXES = new Set([
    // Argentina (nic.ar): segundo nivel bajo .ar
    'com.ar',
    'edu.ar',
    'gob.ar',
    'gov.ar',
    'int.ar',
    'mil.ar',
    'net.ar',
    'org.ar',
    'tur.ar',
    'com.py',
    'com.uy',
    'com.bo',
    'com.pe',
    'com.ec',
    'com.ve',
    'com.mx',
    'gob.mx',
    'edu.mx',
    'org.mx',
    'net.mx',
    'com.co',
    'edu.co',
    'org.co',
    'net.co',
    'co.cr',
    // Reino Unido / usos típicos multi-parte
    'co.uk',
    'org.uk',
    'ac.uk',
    'gov.uk',
    'com.br',
    'edu.br',
    'org.br',
    'net.br',
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
const MAX_SATELLITE_TOOL_DETAIL_JSON_CHARS = 88_000;

function truncatePromptResponseText(text: string | null | undefined): string | undefined {
  if (text == null || text === '') return undefined;
  if (text.length <= MAX_PUBLIC_RESPONSE_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_PUBLIC_RESPONSE_TEXT_CHARS)}… [truncado]`;
}

/** Ajusta `detail` de una herramienta satélite al tope de caracteres JSON sin descartar toda la estructura. */
function fitSatelliteToolDetailToMaxJsonChars(detail: unknown, maxChars: number): Record<string, unknown> {
  let maxStr = 16_000;
  for (let q = 0; q < 18; q++) {
    const adj = deepTruncateSatelliteDetail(detail, maxStr);
    try {
      if (JSON.stringify(adj).length <= maxChars) {
        return adj as Record<string, unknown>;
      }
    } catch {
      break;
    }
    maxStr = Math.max(320, Math.floor(maxStr * 0.5));
  }
  try {
    const last = deepTruncateSatelliteDetail(detail, 320) as Record<string, unknown>;
    return {
      ...last,
      _truncated: true,
      _note: 'Detalle muy grande: se muestra una versión muy compacta.',
    };
  } catch {
    return { _truncated: true, _note: 'Detalle no serializable.' };
  }
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
          detail: fitSatelliteToolDetailToMaxJsonChars(d, MAX_SATELLITE_TOOL_DETAIL_JSON_CHARS),
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
const MAX_DB_SATELLITE_TOOL_DETAIL_CHARS = 88_000;

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
                  ...t,
                  detail: fitSatelliteToolDetailToMaxJsonChars(d, MAX_DB_SATELLITE_TOOL_DETAIL_CHARS),
                };
              } else {
                nt[k] = t;
              }
            } catch {
              nt[k] = { ...t, detail: { score: t.score, error: t.error } };
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

type PublicDiagLog = Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;

async function isFirstRunForDomain(diagnosticId: string, domain: string): Promise<boolean> {
  const firstCompleted = await prisma.publicDiagnostic.findFirst({
    where: { domain, status: 'completed' },
    orderBy: { createdAt: 'asc' },
  });
  return !!firstCompleted && firstCompleted.id === diagnosticId;
}

/**
 * Pipeline completo del diagnóstico público (Brand, Run OpenAI/Gemini, análisis, satélite, emails).
 * El análisis técnico del sitio (satélite) corre en paralelo con la corrida OpenAI (misma URL). El análisis escrito IA exige resultados OpenAI.
 * Se invoca solo tras `POST .../start` (usuario confirmó email + entre 1 y 5 competidores).
 */
async function executePublicDiagnosticPipeline(params: {
  log: PublicDiagLog;
  diagnosticId: string;
  diagnosticDomain: string;
  brandForRun: string;
  trimmedUrl: string;
  useSerp: boolean;
  defaultCountry: string;
  marketConfidenceMin: number;
  competitorRows: Array<{ name: string; domain: string; aliases: string[] }>;
  /** Canal WhatsApp: no ejecutar módulo satélite externo. */
  skipSatellite?: boolean;
  /** Canal WhatsApp: solo Cleexs core (OpenAI), sin corrida Gemini. */
  skipGemini?: boolean;
}): Promise<void> {
  const {
    log,
    diagnosticId,
    diagnosticDomain,
    brandForRun,
    trimmedUrl,
    useSerp,
    defaultCountry,
    marketConfidenceMin,
    competitorRows,
    skipSatellite = false,
    skipGemini = false,
  } = params;

  const competitorNames = competitorRows.map((c) => c.name).filter(Boolean);
  if (competitorNames.length < 1) {
    throw new Error(
      `Diagnóstico abortado: se requiere al menos 1 competidor; hay ${competitorNames.length} válidos para ${brandForRun}`
    );
  }

  const rootTenant = await prisma.tenant.findFirst({
    where: { tenantCode: '000' },
  });
  if (!rootTenant) {
    log.error('Tenant root (000) no encontrado. Ejecutá prisma db seed.');
    throw new Error('Tenant root no encontrado');
  }

  const countryFromTld = trimmedUrl ? getCountryFromDomain(trimmedUrl) : null;
  const analysisContext = await resolveBrandAnalysisContext({
    brandName: brandForRun,
    websiteUrl: trimmedUrl || undefined,
    fallbackCountry: defaultCountry,
    fallbackIndustry: 'General',
    knownCountry: countryFromTld || undefined,
    useSearchEvidence: useSerp !== false,
  });
  const marketCountry =
    countryFromTld ??
    (analysisContext.confidence >= marketConfidenceMin
      ? analysisContext.country || defaultCountry
      : defaultCountry);
  log.info(
    {
      diagnosticId,
      brandName: brandForRun,
      marketCountry,
      countryFromTld: countryFromTld ?? undefined,
      useSerp: useSerp !== false,
      verticalSummary: analysisContext.verticalSummary,
      customerSegment: analysisContext.customerSegment,
      marketConfidence: analysisContext.confidence,
      marketConfidenceMin,
    },
    'Contexto competitivo resuelto desde sitio + país (pipeline tras confirmación usuario)'
  );

  const brand = await prisma.brand.create({
    data: {
      tenantId: rootTenant.id,
      name: brandForRun,
      domain: trimmedUrl ? normalizeDomain(trimmedUrl) : null,
      industry: null,
      country: marketCountry,
      description: analysisContext.verticalSummary || null,
    },
  });

  for (const entry of competitorRows) {
    await prisma.competitor.create({
      data: {
        brandId: brand.id,
        name: entry.name.trim() || 'Competidor',
        domain: entry.domain,
        aliases: entry.aliases as unknown as Prisma.InputJsonValue,
        autoDetected: true,
        validated: true,
        discoveryReason: 'Confirmado por el usuario (diagnóstico público)',
      },
    });
  }

  const intention = getDefaultDiagnosticIntention();
  const diagnosticPrompts = buildDiagnosticPrompts(
    brandForRun,
    competitorNames,
    intention,
    marketCountry
  );

  const promptVersion = await prisma.promptVersion.create({
    data: {
      tenantId: rootTenant.id,
      name: `DIAG_${diagnosticId}`,
      active: false,
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
    where: { id: diagnosticId },
    data: { runId: run.id },
  });

  /**
   * El análisis técnico del sitio solo necesita la URL; la corrida OpenAI necesita prompts + API.
   * Ejecutar ambas en paralelo reduce el tiempo total antes de análisis IA + Gemini.
   */
  let satellitePrefetch: SatelliteModuleResult | null = null;
  const satelliteDuringRunPromise = skipSatellite
    ? Promise.resolve()
    : (async () => {
        if (!trimmedUrl) return;
        try {
          satellitePrefetch = await runSatelliteAnalysis(trimmedUrl);
        } catch (satErr) {
          log.warn({ err: satErr, diagnosticId }, 'Módulo satélite no disponible');
          satellitePrefetch = null;
        }
      })();

  await Promise.all([
    executeRun(run.id, { promptVersionId: promptVersion.id }),
    satelliteDuringRunPromise,
  ]);

  log.info(
    { diagnosticId, satelliteStarted: !skipSatellite && Boolean(trimmedUrl) },
    'executeRun y análisis técnico del sitio (si hubo URL) completados en paralelo'
  );

  await prisma.publicDiagnostic.update({
    where: { id: diagnosticId },
    data: { status: 'completed' },
  });

  setImmediate(() => {
    runOutreachForRun(rootTenant.id, run.id, { enrich: true, logger: log as FastifyBaseLogger })
      .then((outreach) => {
        log.info({ diagnosticId, runId: run.id, outreach }, 'Outreach automatico completado');
      })
      .catch((err) => {
        log.warn({ err, diagnosticId, runId: run.id }, 'Outreach automatico fallo');
      });
  });

  let analysisJson: object | null = null;
  let satelliteModule: SatelliteModuleResult | null = null;

  const runGeminiBranch = async (): Promise<void> => {
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
        where: { id: diagnosticId },
        data: { runGeminiId: runGemini.id },
      });
      await executeRunGemini(runGemini.id, { promptVersionId: promptVersion.id });
    } catch (geminiErr) {
      log.warn(
        { err: geminiErr, diagnosticId },
        'Run Gemini no ejecutado (sin key o error). Solo se muestra score OpenAI.'
      );
    }
  };

  const runAnalysisSatelliteBranch = async (): Promise<void> => {
    let analysisDone: object | null = null;
    let analysisSettled = false;
    /** Ya terminó en paralelo con `executeRun` (o null si no hubo URL / error). */
    const satelliteDone = satellitePrefetch;

    let persistChain = Promise.resolve();
    const schedulePersist = () => {
      persistChain = persistChain.then(async () => {
        if (!analysisSettled) return;
        const merged = buildAnalysisWithSatellite(analysisDone, satelliteDone);
        if (merged == null) return;
        const safe = shrinkAnalysisJsonForPersistence(merged);
        await prisma.publicDiagnostic.update({
          where: { id: diagnosticId },
          data: { analysisJson: safe },
        });
        analysisJson = safe;
        satelliteModule = extractSatelliteModuleFromAnalysis(safe);
      });
      return persistChain;
    };

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

      const runDiagnosticAnalysis = async (): Promise<object | null> => {
        if (!fullRun) return null;
        const ctx = buildRunContext({
          run: fullRun,
          priaReport,
          businessContext: analysisContext.verticalSummary,
        });
        const isFirstRun = await isFirstRunForDomain(diagnosticId, diagnosticDomain);
        const analysis = await generateDiagnosticAnalysis(ctx, isFirstRun ? 'gold' : 'freemium');
        if (analysis) {
          if ((analysis as { tier?: string }).tier !== 'gold') {
            log.warn(
              { diagnosticId },
              'Gemini no disponible: solo se guardó análisis OpenAI. Configurá GEMINI_API_KEY en la API.'
            );
          }
          return analysis as object;
        }
        return null;
      };

      await runDiagnosticAnalysis()
        .catch((err) => {
          log.warn({ err, diagnosticId }, 'Análisis IA no generado');
          return null;
        })
        .then(async (a) => {
          analysisDone = a;
          analysisSettled = true;
          await schedulePersist();
        });
      await persistChain;
    } catch (analysisErr) {
      log.warn({ err: analysisErr, diagnosticId }, 'Análisis IA / satélite: error inesperado');
    }
  };

  await Promise.all([
    skipGemini ? Promise.resolve() : runGeminiBranch(),
    runAnalysisSatelliteBranch(),
  ]);

  void ensureShareSlug(diagnosticId).catch((err) =>
    log.warn({ err, diagnosticId }, 'No se pudo asignar share_slug')
  );

  const current = await prisma.publicDiagnostic.findUnique({
    where: { id: diagnosticId },
  });
  const emailForNotify = current?.email?.trim() || '';
  const isWaPlaceholderEmail = emailForNotify.endsWith('@whatsapp.cleexs.net');
  if (emailForNotify && !isWaPlaceholderEmail) {
    const baseUrl = getAppBaseUrlForPublicLinks();
    try {
      if (!isEmailDisabled() && isEmailConfigured()) {
        await sendDiagnosticLink(
          emailForNotify,
          diagnosticId,
          baseUrl,
          analysisJson ? (analysisJson as import('../lib/email').DiagnosticAnalysisForEmail) : null
        );
        try {
          await sendShareCleexsFollowUpEmail(emailForNotify, diagnosticId, baseUrl, current!.brandName);
        } catch (shareErr) {
          log.error({ err: shareErr, diagnosticId }, 'Error al enviar email de compartir');
        }
        log.info({ diagnosticId, email: emailForNotify }, 'Email enviado');
      }
    } catch (mailErr) {
      log.error({ err: mailErr, diagnosticId }, 'Error al enviar email');
    }
  }

  if (isWhatsAppSourceChannel(current?.sourceChannel) && current?.waPhone) {
    void notifyWhatsAppDiagnosticCompleted(log as FastifyBaseLogger, diagnosticId);
  }
}

function parsePublicSetupDraft(json: unknown): {
  suggestedCompetitorUrls: string[];
  marketCountry?: string;
  useSerp?: boolean;
} | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const urls = o.suggestedCompetitorUrls;
  if (!Array.isArray(urls)) return null;
  const suggestedCompetitorUrls = urls.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  const marketCountry = typeof o.marketCountry === 'string' ? o.marketCountry : undefined;
  const useSerp = typeof o.useSerp === 'boolean' ? o.useSerp : undefined;
  return { suggestedCompetitorUrls, marketCountry, useSerp };
}

const MAX_PUBLIC_COMPETITOR_URLS = 5;

/** Entre 1 y 5 URLs no vacías → dominios únicos; null si inválido, duplicado o fuera de rango. */
function parsePublicCompetitorDomains(urls: unknown): { domains: string[]; originalUrls: string[] } | null {
  if (!Array.isArray(urls) || urls.length < 1 || urls.length > MAX_PUBLIC_COMPETITOR_URLS) return null;
  const seen = new Set<string>();
  const domains: string[] = [];
  const originalUrls: string[] = [];
  for (const raw of urls) {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed) continue;
    let host: string;
    try {
      host = normalizeDomain(trimmed);
    } catch {
      return null;
    }
    if (!host || seen.has(host)) return null;
    seen.add(host);
    domains.push(host);
    originalUrls.push(trimmed);
  }
  if (domains.length < 1 || domains.length > MAX_PUBLIC_COMPETITOR_URLS) return null;
  return { domains, originalUrls };
}

/** Variantes para matchear la respuesta del modelo con lo que cargó el usuario (parseTop3). */
function buildAliasHintsForCompetitorHost(hostRaw: string, originalUrl?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (s: string) => {
    const t = `${s}`.trim();
    if (t.length < 2) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  const host = hostRaw.trim().toLowerCase().replace(/^www\./, '');
  add(hostRaw.trim());
  add(host);
  add(`www.${host}`);
  const derived = deriveBrandFromDomain(host);
  if (derived) add(derived);
  if (originalUrl?.trim()) {
    const raw = originalUrl.trim();
    add(raw);
    try {
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const u = new URL(withScheme);
      add(u.hostname);
      add(u.host);
    } catch {
      /* ignore */
    }
  }
  return out.slice(0, 16);
}

function competitorRowsFromDomains(
  domains: string[],
  originalUrls?: string[]
): Array<{ name: string; domain: string; aliases: string[] }> {
  return domains.map((domain, i) => {
    const original = originalUrls?.[i]?.trim();
    const derived = deriveBrandFromDomain(domain) || domain.split('.')[0] || 'Competidor';
    const aliases = buildAliasHintsForCompetitorHost(domain, original);
    /** Incluye dominio en el nombre para no colapsar dos competidores con el mismo derive (p. ej. dos marcas "Fravega"). */
    const name = `${derived} (${domain})`;
    const aliasExtras = [derived, domain].filter((x) => x && !aliases.some((a) => a.toLowerCase() === x.toLowerCase()));
    return {
      name,
      domain,
      aliases: [...aliases, ...aliasExtras],
    };
  });
}

function stripSatelliteFromAnalysisJson(json: unknown): object | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = { ...(json as Record<string, unknown>) };
  const ext = o.externalModules;
  if (ext && typeof ext === 'object' && !Array.isArray(ext)) {
    const em = { ...(ext as Record<string, unknown>) };
    delete em.satelliteAeo;
    if (Object.keys(em).length === 0) delete o.externalModules;
    else o.externalModules = em;
  }
  return o as object;
}

/** Segundo intento cuando la detección inicial no devuelve URLs (p. ej. ifts1.com.ar). */
async function rescueWaCompetitorUrls(params: {
  brandForRun: string;
  trimmedUrl: string;
  domain: string;
  marketCountry: string;
}): Promise<string[]> {
  const { brandForRun, trimmedUrl, domain, marketCountry } = params;
  const rescuePass = await getTop5Competitors({
    brandName: brandForRun,
    websiteUrl: trimmedUrl,
    country: marketCountry,
    allowProbableLocalFallback: true,
  });
  const resolved = await resolveCompetitorDomains(
    rescuePass.competitors,
    marketCountry,
    undefined,
    rescuePass.verticalSummary
  );

  const ownHost = domain.toLowerCase();
  const seenHosts = new Set<string>();
  const urls: string[] = [];
  for (const c of resolved) {
    if (urls.length >= 5) break;
    let host = c.domain?.trim() || null;
    if (!host && c.name?.trim()) {
      const guess = slugHostGuessFromCompetitorName(c.name);
      if (guess) {
        try {
          host = normalizeDomain(`https://${guess}`);
        } catch {
          host = null;
        }
      }
    }
    if (!host) continue;
    try {
      host = normalizeDomain(/^https?:\/\//i.test(host) ? host : `https://${host}`);
    } catch {
      continue;
    }
    if (!host || host === ownHost || seenHosts.has(host)) continue;
    seenHosts.add(host);
    urls.push(`https://${host}`);
  }
  return urls;
}

async function notifyWaChannelFailure(
  log: PublicDiagLog,
  diagnosticId: string,
  code: string,
  message: string
): Promise<void> {
  await prisma.publicDiagnostic
    .update({ where: { id: diagnosticId }, data: { status: 'failed' } })
    .catch(() => {});

  const row = await prisma.publicDiagnostic.findUnique({
    where: { id: diagnosticId },
    select: { waPhone: true, setupDraftJson: true, sourceChannel: true },
  });
  if (!row?.waPhone || !isWhatsAppSourceChannel(row.sourceChannel)) return;

  const draft =
    row.setupDraftJson && typeof row.setupDraftJson === 'object' && !Array.isArray(row.setupDraftJson)
      ? (row.setupDraftJson as { waRecipient?: string })
      : null;
  const recipient = draft?.waRecipient?.trim() || row.waPhone;
  await deliverWaReplyToUser(log, recipient, buildWhatsAppErrorReply(code, message));
}

async function runCompetitorDetectionJob(params: {
  log: PublicDiagLog;
  diagnosticId: string;
  brandForRun: string;
  trimmedUrl: string;
  domain: string;
  serp: boolean;
  defaultCountry: string;
  marketConfidenceMin: number;
}): Promise<{ suggestedCompetitorUrls: string[]; marketCountry: string; useSerp: boolean }> {
  const {
    log,
    diagnosticId,
    brandForRun,
    trimmedUrl,
    domain,
    serp,
    defaultCountry,
    marketConfidenceMin,
  } = params;

  const countryFromTld = getCountryFromDomain(trimmedUrl);
  const analysisContext = await resolveBrandAnalysisContext({
    brandName: brandForRun,
    websiteUrl: trimmedUrl,
    fallbackCountry: defaultCountry,
    fallbackIndustry: 'General',
    knownCountry: countryFromTld || undefined,
    useSearchEvidence: serp,
  });
  const marketCountry =
    countryFromTld ??
    (analysisContext.confidence >= marketConfidenceMin
      ? analysisContext.country || defaultCountry
      : defaultCountry);

  const seenHosts = new Set<string>();
  const suggestedCompetitorUrls: string[] = [];
  const ownHost = domain.toLowerCase();
  for (const c of analysisContext.competitors) {
    if (suggestedCompetitorUrls.length >= 5) break;
    const rawCandidates: string[] = [];
    const d = c.domain?.trim();
    if (d) rawCandidates.push(d);
    if (!d && c.name?.trim()) {
      const guess = slugHostGuessFromCompetitorName(c.name);
      if (guess) rawCandidates.push(guess);
    }
    for (const raw of rawCandidates) {
      if (suggestedCompetitorUrls.length >= 5) break;
      let host: string;
      try {
        const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        host = normalizeDomain(withScheme);
      } catch {
        continue;
      }
      if (!host || host === ownHost || seenHosts.has(host)) continue;
      seenHosts.add(host);
      suggestedCompetitorUrls.push(`https://${host}`);
    }
  }

  if (suggestedCompetitorUrls.length === 0) {
    log.warn(
      { diagnosticId, competitorCount: analysisContext.competitors.length },
      'Detección de competidores: ninguna URL sugerida; reintento rescue'
    );
    const rescued = await rescueWaCompetitorUrls({
      brandForRun,
      trimmedUrl,
      domain,
      marketCountry,
    });
    for (const url of rescued) {
      if (suggestedCompetitorUrls.length >= 5) break;
      suggestedCompetitorUrls.push(url);
    }
  }

  await prisma.publicDiagnostic.update({
    where: { id: diagnosticId },
    data: {
      status: 'awaiting_user',
      setupDraftJson: {
        suggestedCompetitorUrls,
        marketCountry,
        useSerp: serp,
      },
    },
  });

  return { suggestedCompetitorUrls, marketCountry, useSerp: serp };
}

async function waitForDiagnosticStatus(
  diagnosticId: string,
  targetStatus: string,
  timeoutMs: number
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const row = await prisma.publicDiagnostic.findUnique({
      where: { id: diagnosticId },
      select: { status: true },
    });
    if (!row) return false;
    if (row.status === targetStatus) return true;
    if (row.status === 'failed') return false;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function autoStartWhatsAppDiagnostic(params: {
  log: PublicDiagLog;
  diagnosticId: string;
  waPhone: string;
  defaultCountry: string;
  marketConfidenceMin: number;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const { log, diagnosticId, waPhone, defaultCountry, marketConfidenceMin } = params;

  const ready = await waitForDiagnosticStatus(
    diagnosticId,
    'awaiting_user',
    getWaCompetitorWaitMs()
  );
  if (!ready) {
    return {
      ok: false,
      code: 'competitors_timeout',
      message: 'No pudimos detectar competidores a tiempo. Pedile al usuario que reintente en unos minutos.',
    };
  }

  const diagnostic = await prisma.publicDiagnostic.findUnique({ where: { id: diagnosticId } });
  if (!diagnostic || diagnostic.status !== 'awaiting_user') {
    return { ok: false, code: 'invalid_state', message: 'El diagnóstico no está listo para iniciar.' };
  }

  const draft = parsePublicSetupDraft(diagnostic.setupDraftJson);
  let suggested = draft?.suggestedCompetitorUrls ?? [];
  if (suggested.length < 1) {
    const trimmedUrl =
      diagnostic.domain && !diagnostic.domain.startsWith('brand-')
        ? `https://${diagnostic.domain}`
        : '';
    const marketCountry = draft?.marketCountry || defaultCountry;
    if (trimmedUrl) {
      suggested = await rescueWaCompetitorUrls({
        brandForRun: diagnostic.brandName,
        trimmedUrl,
        domain: diagnostic.domain,
        marketCountry,
      });
      if (suggested.length > 0) {
        await prisma.publicDiagnostic.update({
          where: { id: diagnosticId },
          data: {
            setupDraftJson: {
              ...(draft ?? {}),
              suggestedCompetitorUrls: suggested,
              marketCountry,
            },
          },
        });
      }
    }
  }
  if (suggested.length < 1) {
    return {
      ok: false,
      code: 'needs_competitors',
      message:
        'No pudimos detectar competidores para ese sitio. Reenviá la URL o probá con otra empresa.',
    };
  }

  const parsedUrls = parsePublicCompetitorDomains(suggested.slice(0, MAX_PUBLIC_COMPETITOR_URLS));
  if (!parsedUrls) {
    return { ok: false, code: 'needs_competitors', message: 'Competidores sugeridos inválidos.' };
  }

  const ownHost = diagnostic.domain.toLowerCase();
  if (parsedUrls.domains.some((h) => h === ownHost)) {
    return { ok: false, code: 'needs_competitors', message: 'Los competidores sugeridos coinciden con el sitio.' };
  }

  const trimmedUrl =
    diagnostic.domain && !diagnostic.domain.startsWith('brand-') ? `https://${diagnostic.domain}` : '';
  if (!trimmedUrl) {
    return { ok: false, code: 'invalid_url', message: 'URL de sitio inválida.' };
  }

  const email = waPlaceholderEmail(waPhone);
  const useSerp = draft?.useSerp ?? true;
  const competitorRows = competitorRowsFromDomains(parsedUrls.domains, parsedUrls.originalUrls);

  await prisma.publicDiagnostic.update({
    where: { id: diagnosticId },
    data: {
      email,
      status: 'running',
      setupDraftJson: {
        ...(draft ?? {}),
        confirmedCompetitorUrls: suggested,
        confirmedAt: new Date().toISOString(),
        channelAutoStart: 'whatsapp_yt',
      },
    },
  });

  try {
    await executePublicDiagnosticPipeline({
      log,
      diagnosticId,
      diagnosticDomain: diagnostic.domain,
      brandForRun: diagnostic.brandName,
      trimmedUrl,
      useSerp,
      defaultCountry,
      marketConfidenceMin,
      competitorRows,
      skipSatellite: true,
      skipGemini: true,
    });
    return { ok: true };
  } catch (err) {
    log.error({ err, diagnosticId }, 'Error en pipeline canal WhatsApp');
    await prisma.publicDiagnostic
      .update({ where: { id: diagnosticId }, data: { status: 'failed' } })
      .catch(() => {});
    return { ok: false, code: 'pipeline_failed', message: 'Error al ejecutar el diagnóstico.' };
  }
}

type WaChannelStartResult =
  | {
      ok: true;
      diagnosticId: string;
      status: string;
      resultUrl: string;
      domain: string;
      brandName: string;
      reused?: boolean;
    }
  | { ok: false; httpStatus: number; code: string; message: string };

async function startWhatsAppChannelDiagnostic(params: {
  log: PublicDiagLog;
  waPhone: string;
  waRecipient?: string;
  trimmedUrl: string;
  refCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}): Promise<WaChannelStartResult> {
  const { log, waPhone, waRecipient, trimmedUrl, refCode, utmSource, utmMedium, utmCampaign } = params;
  const recipientForSend = (waRecipient || waPhone).trim();

  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      httpStatus: 503,
      code: 'service_unavailable',
      message: 'El servicio de análisis no está disponible.',
    };
  }

  const domain = normalizeDomain(trimmedUrl);

  if (isPlaceholderPublicSuffixOnlyDomain(domain)) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'invalid_domain',
      message:
        'Enviá el dominio completo de tu sitio (ej. colegioguadalupe.edu.ar), no solo el sufijo (.edu.ar).',
    };
  }

  const dupeRecent = await prisma.publicDiagnostic.findFirst({
    where: {
      waPhone,
      domain,
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
      status: { not: 'failed' },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (dupeRecent) {
    const baseUrl = getAppBaseUrlForPublicLinks();
    return {
      ok: true,
      diagnosticId: dupeRecent.id,
      status: dupeRecent.status,
      resultUrl: buildWaResultUrl(dupeRecent.id, baseUrl),
      domain: dupeRecent.domain,
      brandName: dupeRecent.brandName,
      reused: true,
    };
  }

  // awaiting_user en WA es transitorio (auto-start); no bloquear reintentos si quedó colgado.
  const staleWaAwaiting = await prisma.publicDiagnostic.findMany({
    where: {
      waPhone,
      status: 'awaiting_user',
      sourceChannel: 'whatsapp_yt',
      createdAt: { gte: new Date(Date.now() - 25 * 60 * 1000) },
    },
    select: { id: true, setupDraftJson: true },
  });
  for (const row of staleWaAwaiting) {
    const draft = parsePublicSetupDraft(row.setupDraftJson);
    if ((draft?.suggestedCompetitorUrls?.length ?? 0) < 1) {
      await prisma.publicDiagnostic
        .update({ where: { id: row.id }, data: { status: 'failed' } })
        .catch(() => {});
    }
  }

  let inProgress = await prisma.publicDiagnostic.findFirst({
    where: {
      waPhone,
      status: { in: ['detecting_competitors', 'running'] },
      createdAt: { gte: new Date(Date.now() - 25 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (inProgress && isPlaceholderPublicSuffixOnlyDomain(inProgress.domain)) {
    await prisma.publicDiagnostic.update({
      where: { id: inProgress.id },
      data: { status: 'failed' },
    });
    inProgress = null;
  }
  if (inProgress && inProgress.domain !== domain) {
    const progressUrl = buildWaResultUrl(inProgress.id, getAppBaseUrlForPublicLinks());
    return {
      ok: false,
      httpStatus: 409,
      code: 'analysis_in_progress',
      message: `Ya estamos analizando *${inProgress.domain}*. Informe en curso: ${progressUrl}`,
    };
  }

  const dailyLimit = getWaChannelDailyLimit();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.publicDiagnostic.count({
    where: {
      waPhone,
      createdAt: { gte: since },
      status: { not: 'failed' },
    },
  });
  if (recentCount >= dailyLimit) {
    return {
      ok: false,
      httpStatus: 429,
      code: 'rate_limited',
      message: `Límite diario alcanzado (${dailyLimit} diagnósticos por número).`,
    };
  }
  const brandForRun = deriveBrandFromDomain(domain);
  const defaultCountry = (process.env.PUBLIC_DIAGNOSTIC_DEFAULT_COUNTRY || 'Argentina').trim();
  const marketConfidenceMin = Number(process.env.PUBLIC_DIAGNOSTIC_MARKET_CONFIDENCE_MIN || 70);
  const serp = true;
  const baseUrl = getAppBaseUrlForPublicLinks();

  const diagnostic = await prisma.publicDiagnostic.create({
    data: {
      brandName: brandForRun,
      domain,
      status: 'detecting_competitors',
      tier: 'freemium',
      sourceChannel: 'whatsapp_yt',
      waPhone,
      setupDraftJson: recipientForSend ? { waRecipient: recipientForSend } : undefined,
      refCode: (refCode || 'youtube_tv').toLowerCase(),
      utmSource: (utmSource || 'youtube').toLowerCase(),
      utmMedium: (utmMedium || 'whatsapp').toLowerCase(),
      utmCampaign: (utmCampaign || 'qr_tv').toLowerCase(),
    },
  });

  const diagId = diagnostic.id;
  const resultUrl = buildWaResultUrl(diagId, baseUrl);

  setImmediate(async () => {
    try {
      await runCompetitorDetectionJob({
        log,
        diagnosticId: diagId,
        brandForRun,
        trimmedUrl,
        domain,
        serp,
        defaultCountry,
        marketConfidenceMin,
      });
      const started = await autoStartWhatsAppDiagnostic({
        log,
        diagnosticId: diagId,
        waPhone,
        defaultCountry,
        marketConfidenceMin,
      });
      if (!started.ok) {
        log.warn({ diagnosticId: diagId, ...started }, 'Canal WA: auto-start no completado');
        await notifyWaChannelFailure(log, diagId, started.code, started.message);
      }
    } catch (err) {
      log.error({ err, diagnosticId: diagId }, 'Error en flujo canal WhatsApp');
      await notifyWaChannelFailure(
        log,
        diagId,
        'pipeline_failed',
        'Hubo un error al analizar tu sitio. Reenviá la URL en un mensaje nuevo.'
      );
    }
  });

  return {
    ok: true,
    diagnosticId: diagId,
    status: 'detecting_competitors',
    resultUrl,
    domain,
    brandName: brandForRun,
  };
}

async function resolveWhatsAppTeaserPayload(diagnosticId: string): Promise<
  | { ok: false; httpStatus: number; code: string; message: string }
  | {
      ok: true;
      status: string;
      domain: string;
      brandName: string;
      resultUrl: string;
      cleexsScore: number | null;
      teaserLine: string | null;
      ready: boolean;
    }
> {
  const row = await prisma.publicDiagnostic.findUnique({
    where: { id: diagnosticId },
    select: {
      id: true,
      domain: true,
      brandName: true,
      status: true,
      sourceChannel: true,
      runId: true,
      analysisJson: true,
    },
  });
  if (!row) {
    return { ok: false, httpStatus: 404, code: 'not_found', message: 'Diagnóstico no encontrado' };
  }
  if (!isWhatsAppSourceChannel(row.sourceChannel)) {
    return {
      ok: false,
      httpStatus: 403,
      code: 'forbidden',
      message: 'No es un diagnóstico del canal WhatsApp.',
    };
  }

  const baseUrl = getAppBaseUrlForPublicLinks();
  const resultUrl = buildWaResultUrl(row.id, baseUrl);

  if (row.status !== 'completed' || !row.runId) {
    return {
      ok: true,
      status: row.status,
      domain: row.domain,
      brandName: row.brandName,
      resultUrl,
      cleexsScore: null,
      teaserLine: null,
      ready: false,
    };
  }

  const run = await prisma.run.findUnique({
    where: { id: row.runId },
    include: { priaReports: { take: 1, orderBy: { createdAt: 'desc' } } },
  });
  const cleexsScore = run?.priaReports[0]?.priaTotal ?? null;
  const teaserLine = buildWhatsAppTeaserLine(cleexsScore, row.analysisJson);

  return {
    ok: true,
    status: row.status,
    domain: row.domain,
    brandName: row.brandName,
    resultUrl,
    cleexsScore,
    teaserLine,
    ready: true,
  };
}

function verifyWaChannelRequest(request: { headers: Record<string, unknown> }): boolean {
  const channelKey = request.headers['x-cleexs-channel-key'];
  const keyHeader = Array.isArray(channelKey) ? channelKey[0] : channelKey;
  return verifyWhatsAppChannelApiKey(typeof keyHeader === 'string' ? keyHeader : undefined);
}

/** Solo flow URL de BuilderBot (plugin HTTP): inicia diagnóstico si hay dominio. */
async function processWhatsAppUrlHttpRequest(params: {
  log: PublicDiagLog;
  phone: string;
  message: string;
  waRecipient?: string;
  refCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}): Promise<{
  reply: string;
  code: string;
  ready: boolean;
  diagnosticId?: string;
  resultUrl?: string;
  domain?: string;
  brandName?: string;
  status?: string;
}> {
  const { log, phone, message, waRecipient, refCode, utmSource, utmMedium, utmCampaign } = params;
  const waPhone = normalizeWaPhone(phone);
  if (!waPhone) {
    return { reply: 'No pudimos leer tu número.', code: 'invalid_phone', ready: false };
  }

  const trimmedUrl = await resolveWebsiteUrlFromWhatsAppMessage(`${message || ''}`.trim());
  if (!trimmedUrl) {
    return { reply: buildWhatsAppAskUrlReply(), code: 'no_url', ready: false };
  }

  const started = await startWhatsAppChannelDiagnostic({
    log,
    waPhone,
    waRecipient: (waRecipient || phone).trim(),
    trimmedUrl,
    refCode,
    utmSource,
    utmMedium,
    utmCampaign,
  });

  if (!started.ok) {
    return {
      reply: buildWhatsAppErrorReply(started.code, started.message),
      code: started.code,
      ready: false,
    };
  }

  const recipient = (waRecipient || phone).trim();
  await deliverWaChannelStart(
    log,
    recipient,
    started.domain,
    started.resultUrl,
    !!started.reused
  );

  const reply = started.reused
    ? buildWhatsAppAlreadyStartedReply(started.domain, started.resultUrl)
    : buildWhatsAppStartedReply(started.domain, started.resultUrl);

  return {
    reply,
    code: started.reused ? 'already_started' : 'started',
    ready: false,
    diagnosticId: started.diagnosticId,
    resultUrl: started.resultUrl,
    domain: started.domain,
    brandName: started.brandName,
    status: started.status,
  };
}

const waTrackingField = z
  .string()
  .trim()
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Formato inválido')
  .optional();

const publicDiagnosticRoutes: FastifyPluginAsync = async (fastify) => {
  // Turnstile deshabilitado (URLs dinámicas de Vercel). Reactivar cuando haya dominio estable.

  // POST /api/public/diagnostic — solo URL: detecta competidores y pasa a awaiting_user (sin consumir cupo).
  fastify.post<{
    Body: {
      brandName?: string;
      url?: string;
      tier?: 'freemium' | 'gold';
      useSerp?: boolean;
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
        useSerp: z.boolean().optional(),
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
      const { brandName, url, tier: requestedTier, useSerp, refCode, utmSource, utmMedium, utmCampaign } = parsed.data;
      const trimmedBrand = (brandName ?? '').trim();
      const trimmedUrl = (url ?? '').trim();

      if (!trimmedUrl) {
        return reply.code(400).send({
          error: 'Ingresá la URL de tu sitio.',
        });
      }

      const domain = normalizeDomain(trimmedUrl);
      const derivedFromBrand = trimmedBrand ? deriveBrandIfLooksLikeDomain(trimmedBrand) : null;
      const brandForRun = derivedFromBrand ?? (trimmedBrand || deriveBrandFromDomain(domain));

      if (!process.env.OPENAI_API_KEY) {
        return reply.code(503).send({
          error: 'El servicio de análisis no está disponible. Intentá más tarde.',
        });
      }
      const defaultCountry = (process.env.PUBLIC_DIAGNOSTIC_DEFAULT_COUNTRY || 'Argentina').trim();
      const marketConfidenceMin = Number(process.env.PUBLIC_DIAGNOSTIC_MARKET_CONFIDENCE_MIN || 70);

      const tier = requestedTier === 'gold' ? 'gold' : 'freemium';

      const diagnostic = await prisma.publicDiagnostic.create({
        data: {
          brandName: brandForRun,
          domain,
          status: 'detecting_competitors',
          tier,
          ...(refCode ? { refCode: refCode.toLowerCase() } : {}),
          ...(utmSource ? { utmSource: utmSource.toLowerCase() } : {}),
          ...(utmMedium ? { utmMedium: utmMedium.toLowerCase() } : {}),
          ...(utmCampaign ? { utmCampaign: utmCampaign.toLowerCase() } : {}),
        },
      });

      const diagId = diagnostic.id;
      const serp = useSerp !== false;

      setImmediate(async () => {
        try {
          await runCompetitorDetectionJob({
            log: fastify.log,
            diagnosticId: diagId,
            brandForRun,
            trimmedUrl,
            domain,
            serp,
            defaultCountry,
            marketConfidenceMin,
          });
        } catch (err) {
          fastify.log.error({ err, diagnosticId: diagId }, 'Error en detección de competidores');
          await prisma.publicDiagnostic
            .update({ where: { id: diagId }, data: { status: 'failed' } })
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

  // POST /api/public/diagnostic/:id/start — email + 1–5 URLs competidor; consume cupo y ejecuta pipeline.
  fastify.post<{
    Params: { id: string };
    Body: { email: string; competitorUrls: string[]; useSerp?: boolean };
  }>('/diagnostic/:id/start', async (request, reply) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        competitorUrls: z
          .array(z.string().max(500))
          .min(1)
          .max(MAX_PUBLIC_COMPETITOR_URLS)
          .refine((arr) => arr.some((s) => String(s).trim().length > 0), 'Al menos una URL de competidor.'),
        useSerp: z.boolean().optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.errors.map((e) => e.message).join(', ') || 'Datos inválidos.',
        });
      }
      const { id } = request.params;
      const { email, competitorUrls, useSerp: useSerpBody } = parsed.data;

      const diagnostic = await prisma.publicDiagnostic.findUnique({ where: { id } });
      if (!diagnostic) {
        return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
      }
      if (diagnostic.status !== 'awaiting_user') {
        return reply.code(409).send({
          error:
            diagnostic.status === 'running'
              ? 'El análisis ya está en curso.'
              : 'Este diagnóstico no está listo para iniciar. Volvé a crear uno o esperá la detección de competidores.',
        });
      }

      const parsedUrls = parsePublicCompetitorDomains(competitorUrls);
      if (!parsedUrls) {
        return reply.code(400).send({
          error: `Necesitamos entre 1 y ${MAX_PUBLIC_COMPETITOR_URLS} URLs de competidores válidas, sin repetir dominio.`,
        });
      }
      const { domains, originalUrls } = parsedUrls;

      const ownHost = diagnostic.domain.toLowerCase();
      if (domains.some((h) => h === ownHost)) {
        return reply.code(400).send({ error: 'Los competidores no pueden incluir el mismo dominio que tu sitio.' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return reply.code(503).send({
          error: 'El servicio de análisis no está disponible. Intentá más tarde.',
        });
      }

      const visitorIdHeader = request.headers['x-visitor-id'];
      const visitorId = typeof visitorIdHeader === 'string' ? visitorIdHeader.trim() : '';
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

      const draft = parsePublicSetupDraft(diagnostic.setupDraftJson);
      const useSerp = useSerpBody ?? draft?.useSerp ?? true;
      const defaultCountry = (process.env.PUBLIC_DIAGNOSTIC_DEFAULT_COUNTRY || 'Argentina').trim();
      const marketConfidenceMin = Number(process.env.PUBLIC_DIAGNOSTIC_MARKET_CONFIDENCE_MIN || 70);

      const trimmedUrl =
        diagnostic.domain && !diagnostic.domain.startsWith('brand-') ? `https://${diagnostic.domain}` : '';
      if (!trimmedUrl) {
        return reply.code(400).send({ error: 'URL de sitio inválida para este diagnóstico.' });
      }

      const competitorRows = competitorRowsFromDomains(domains, originalUrls);

      await prisma.publicDiagnostic.update({
        where: { id },
        data: {
          email,
          status: 'running',
          setupDraftJson: {
            ...(draft ?? {}),
            confirmedCompetitorUrls: competitorUrls,
            confirmedAt: new Date().toISOString(),
          },
        },
      });

      if (visitorId) {
        await consumeEntitlement(prisma, {
          actor: { anonymousId: visitorId },
          action: EntitlementAction.score_generate,
          dedupeKey: `anon-score-generate:${visitorId}:${id}`,
          metaJson: { diagnosticId: id, domain: diagnostic.domain },
        });
      }

      setImmediate(async () => {
        try {
          await executePublicDiagnosticPipeline({
            log: fastify.log,
            diagnosticId: id,
            diagnosticDomain: diagnostic.domain,
            brandForRun: diagnostic.brandName,
            trimmedUrl,
            useSerp,
            defaultCountry,
            marketConfidenceMin,
            competitorRows,
          });
        } catch (err) {
          fastify.log.error({ err, diagnosticId: id }, 'Error en diagnóstico');
          await prisma.publicDiagnostic
            .update({ where: { id }, data: { status: 'failed' } })
            .catch(() => {});
        }
      });

      return reply.code(200).send({ ok: true, diagnosticId: id });
    } catch (err) {
      fastify.log.error({ err, body: request.body }, 'Error POST /diagnostic/:id/start');
      const message = err instanceof Error ? err.message : 'Error interno';
      return reply.code(500).send({ error: message || 'Error interno.' });
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

  // POST /api/public/diagnostic/whatsapp — BuilderBot: URL + teléfono → diagnóstico auto (sin satélite)
  fastify.post<{
    Body: {
      phone: string;
      url?: string;
      message?: string;
      refCode?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    };
  }>('/diagnostic/whatsapp', async (request, reply) => {
    if (!verifyWaChannelRequest(request)) {
      return reply.code(401).send({ error: 'No autorizado', code: 'unauthorized' });
    }

    try {
      const schema = z.object({
        phone: z.string().min(8).max(32),
        url: z.string().max(500).optional(),
        message: z.string().max(2000).optional(),
        refCode: waTrackingField,
        utmSource: waTrackingField,
        utmMedium: waTrackingField,
        utmCampaign: waTrackingField,
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.errors.map((e) => e.message).join(', ') || 'Datos inválidos.',
          code: 'validation_error',
        });
      }

      const { phone, url: urlBody, message, refCode, utmSource, utmMedium, utmCampaign } = parsed.data;

      const waPhone = normalizeWaPhone(phone);
      if (!waPhone) {
        return reply.code(400).send({
          error: 'Teléfono inválido. Usá formato internacional (ej. 54911…).',
          code: 'invalid_phone',
        });
      }

      const inboundText = (urlBody?.trim() || message || '').trim();
      const trimmedUrl = extractUrlFromWhatsAppMessage(inboundText);
      if (!trimmedUrl) {
        return reply.code(400).send({
          error: 'No encontramos una URL en el mensaje.',
          code: 'no_url',
        });
      }

      const started = await startWhatsAppChannelDiagnostic({
        log: fastify.log,
        waPhone,
        trimmedUrl,
        refCode,
        utmSource,
        utmMedium,
        utmCampaign,
      });
      if (!started.ok) {
        return reply.code(started.httpStatus).send({
          error: started.message,
          code: started.code,
        });
      }

      return reply.code(201).send({
        diagnosticId: started.diagnosticId,
        status: started.status,
        resultUrl: started.resultUrl,
        domain: started.domain,
        brandName: started.brandName,
      });
    } catch (err) {
      fastify.log.error({ err, body: request.body }, 'Error POST /diagnostic/whatsapp');
      return reply.code(500).send({ error: 'Error interno.', code: 'internal_error' });
    }
  });

  const waUrlFlowBodySchema = z.object({
    from: z.union([z.string(), z.number()]).optional(),
    phone: z.string().max(32).optional(),
    recipient: z.union([z.string(), z.number()]).optional(),
    chatId: z.union([z.string(), z.number()]).optional(),
    jid: z.string().max(120).optional(),
    lid: z.union([z.string(), z.number()]).optional(),
    message: z.string().max(2000).optional(),
    body: z.string().max(2000).optional(),
    url: z.string().max(500).optional(),
    refCode: waTrackingField,
    utmSource: waTrackingField,
    utmMedium: waTrackingField,
    utmCampaign: waTrackingField,
  });

  function waMessageFromFlowBody(body: unknown): string {
    if (typeof body === 'string') return body.trim();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const o = body as { message?: string; body?: string; url?: string };
      return `${o.message ?? o.body ?? o.url ?? ''}`.trim();
    }
    return '';
  }

  function waPhoneFromFlowRequest(pathFrom: string | undefined, body: unknown): string {
    if (pathFrom?.trim()) return pathFrom.trim();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const o = body as { from?: string | number; phone?: string };
      if (o.from != null && `${o.from}`.trim()) return String(o.from).trim();
      if (o.phone?.trim()) return o.phone.trim();
    }
    return '';
  }

  async function handleWhatsAppUrlFlowHttp(
    request: { body: unknown },
    reply: { send: (p: unknown) => unknown; code: (n: number) => { send: (p: unknown) => unknown } },
    phoneFromPathOrBody: string,
    tracking?: {
      refCode?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    }
  ) {
    const parsed = waUrlFlowBodySchema.safeParse(request.body);
    const trackingFields = parsed.success ? parsed.data : {};
    const messageText = waMessageFromFlowBody(request.body);

    const recipient = waRecipientFromFlowBody(request.body) || phoneFromPathOrBody;
    const result = await processWhatsAppUrlHttpRequest({
      log: fastify.log,
      phone: phoneFromPathOrBody,
      message: messageText,
      waRecipient: recipient,
      refCode: trackingFields.refCode ?? tracking?.refCode,
      utmSource: trackingFields.utmSource ?? tracking?.utmSource,
      utmMedium: trackingFields.utmMedium ?? tracking?.utmMedium,
      utmCampaign: trackingFields.utmCampaign ?? tracking?.utmCampaign,
    });
    if (result.code !== 'started' && result.code !== 'already_started') {
      void deliverWaReplyToUser(fastify.log, recipient, result.reply);
    }
    return reply.send(result);
  }

  // POST /api/public/diagnostic/whatsapp/url — BuilderBot: from + message en body (recomendado)
  fastify.post<{ Body: Record<string, unknown> }>('/diagnostic/whatsapp/url', async (request, reply) => {
    if (!verifyWaChannelRequest(request)) {
      return reply.code(401).send({ error: 'No autorizado', code: 'unauthorized', reply: '' });
    }
    try {
      const phone = waPhoneFromFlowRequest(undefined, request.body);
      if (!phone) {
        return reply.send({
          code: 'invalid_phone',
          reply: 'No pudimos leer tu número (from).',
          ready: false,
        });
      }
      return await handleWhatsAppUrlFlowHttp(request, reply, phone);
    } catch (err) {
      fastify.log.error({ err, body: request.body }, 'Error POST /whatsapp/url');
      return reply.code(500).send({
        code: 'internal_error',
        reply: buildWhatsAppErrorReply('internal_error'),
        ready: false,
      });
    }
  });

  // POST /api/public/diagnostic/whatsapp/url/:from — alternativa: from en ruta + message en body
  fastify.post<{ Params: { from: string }; Body: Record<string, unknown> }>(
    '/diagnostic/whatsapp/url/:from',
    async (request, reply) => {
      if (!verifyWaChannelRequest(request)) {
        return reply.code(401).send({ error: 'No autorizado', code: 'unauthorized', reply: '' });
      }
      try {
        const phone = waPhoneFromFlowRequest(request.params.from, request.body);
        if (!phone) {
          return reply.send({
            code: 'invalid_phone',
            reply: 'No pudimos leer tu número (from).',
            ready: false,
          });
        }
        return await handleWhatsAppUrlFlowHttp(request, reply, phone);
      } catch (err) {
        fastify.log.error({ err, from: request.params.from, body: request.body }, 'Error POST /whatsapp/url/:from');
        return reply.code(500).send({
          code: 'internal_error',
          reply: buildWhatsAppErrorReply('internal_error'),
          ready: false,
        });
      }
    }
  );

  // POST /api/public/diagnostic/whatsapp/webhook — alternativa: phone + message en JSON (legacy)
  fastify.post<{
    Body: {
      phone: string;
      message?: string;
      url?: string;
      refCode?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    };
  }>('/diagnostic/whatsapp/webhook', async (request, reply) => {
    if (!verifyWaChannelRequest(request)) {
      return reply.code(401).send({ error: 'No autorizado', code: 'unauthorized', reply: '' });
    }

    try {
      const schema = z.object({
        phone: z.string().min(8).max(32),
        message: z.string().max(2000).optional(),
        url: z.string().max(500).optional(),
        refCode: waTrackingField,
        utmSource: waTrackingField,
        utmMedium: waTrackingField,
        utmCampaign: waTrackingField,
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.send({ code: 'validation_error', reply: buildWhatsAppAskUrlReply(), ready: false });
      }

      const { phone, message, url: urlBody, refCode, utmSource, utmMedium, utmCampaign } = parsed.data;
      return await handleWhatsAppUrlFlowHttp(request, reply, phone, {
        refCode,
        utmSource,
        utmMedium,
        utmCampaign,
      });
    } catch (err) {
      fastify.log.error({ err, body: request.body }, 'Error POST /diagnostic/whatsapp/webhook');
      return reply.code(500).send({
        code: 'internal_error',
        reply: buildWhatsAppErrorReply('internal_error'),
        ready: false,
      });
    }
  });

  // POST /api/public/whatsapp/builderbot-inbound — Webhook del proyecto BuilderBot (patrón Mis Reclamos)
  const builderbotInboundSchema = z.object({
    eventName: z.string(),
    data: z
      .object({
        body: z.union([z.string(), z.number()]).optional(),
        from: z.union([z.string(), z.number()]),
      })
      .passthrough(),
  });

  fastify.post('/whatsapp/builderbot-inbound', async (request, reply) => {
    try {
      const parsed = builderbotInboundSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, error: 'Formato inválido' });
      }

      const { eventName, data } = parsed.data;
      if (eventName !== 'message.incoming') {
        return reply.send({ ok: true, skipped: eventName });
      }

      const bodyText = data.body != null ? String(data.body).trim() : '';
      if (!bodyText || /^_event_/i.test(bodyText)) {
        return reply.send({ ok: true, skipped: 'empty_or_system_event' });
      }

      const phone = String(data.from);
      const recipient = waRecipientFromFlowBody(data) || phone;
      const trimmedUrl = extractUrlFromWhatsAppMessage(bodyText);

      if (trimmedUrl) {
        return reply.send({ ok: true, skipped: 'url_handled_by_flow' });
      }

      if (isWaGreetingMessage(bodyText)) {
        await deliverWaReplyToUser(fastify.log, recipient, buildWhatsAppGreetingReply());
        return reply.send({ ok: true, code: 'greeting' });
      }

      if (isCleexsFaqOnlyMessage(bodyText)) {
        await deliverWaReplyToUser(fastify.log, recipient, buildWhatsAppCleexsFaqReply());
        return reply.send({ ok: true, code: 'cleexs_info' });
      }

      return reply.send({ ok: true, skipped: 'no_url_entrada_flow' });
    } catch (err) {
      fastify.log.error({ err }, 'Error POST /whatsapp/builderbot-inbound');
      return reply.code(500).send({ ok: false });
    }
  });

  // GET /api/public/diagnostic/whatsapp/webhook/reply?diagnosticId= — poll opcional
  fastify.get<{ Querystring: { diagnosticId?: string } }>(
    '/diagnostic/whatsapp/webhook/reply',
    async (request, reply) => {
      if (!verifyWaChannelRequest(request)) {
        return reply.code(401).send({ error: 'No autorizado', code: 'unauthorized', reply: '' });
      }

      const diagnosticId = `${request.query.diagnosticId || ''}`.trim();
      if (!diagnosticId) {
        return reply.code(400).send({
          code: 'validation_error',
          reply: 'Falta diagnosticId.',
          ready: false,
        });
      }

      const payload = await resolveWhatsAppTeaserPayload(diagnosticId);
      if (!payload.ok) {
        return reply.code(payload.httpStatus).send({
          code: payload.code,
          reply: buildWhatsAppErrorReply(payload.code, payload.message),
          ready: false,
        });
      }

      if (payload.status === 'failed') {
        return reply.send({
          code: 'failed',
          reply: buildWhatsAppErrorReply('pipeline_failed'),
          status: payload.status,
          resultUrl: payload.resultUrl,
          ready: false,
        });
      }

      if (!payload.ready || payload.cleexsScore == null) {
        return reply.send({
          code: 'running',
          reply: buildWhatsAppStillRunningReply(payload.domain, payload.resultUrl),
          status: payload.status,
          domain: payload.domain,
          brandName: payload.brandName,
          resultUrl: payload.resultUrl,
          diagnosticId,
          ready: false,
        });
      }

      return reply.send({
        code: 'completed',
        reply: buildWhatsAppCompletedReply({
          domain: payload.domain,
          brandName: payload.brandName,
          cleexsScore: payload.cleexsScore,
          teaserLine: payload.teaserLine || buildWhatsAppTeaserLine(payload.cleexsScore, null),
          resultUrl: payload.resultUrl,
        }),
        status: payload.status,
        domain: payload.domain,
        brandName: payload.brandName,
        cleexsScore: payload.cleexsScore,
        teaserLine: payload.teaserLine,
        resultUrl: payload.resultUrl,
        diagnosticId,
        ready: true,
      });
    }
  );

  // GET /api/public/diagnostic/whatsapp/:id/teaser — poll opcional (el envío final va por API BuilderBot)
  fastify.get<{ Params: { id: string } }>('/diagnostic/whatsapp/:id/teaser', async (request, reply) => {
    if (!verifyWaChannelRequest(request)) {
      return reply.code(401).send({ error: 'No autorizado', code: 'unauthorized' });
    }

    const payload = await resolveWhatsAppTeaserPayload(request.params.id);
    if (!payload.ok) {
      return reply.code(payload.httpStatus).send({ error: payload.message, code: payload.code });
    }

    return reply.send({
      status: payload.status,
      domain: payload.domain,
      brandName: payload.brandName,
      cleexsScore: payload.cleexsScore,
      teaserLine: payload.teaserLine,
      resultUrl: payload.resultUrl,
      ready: payload.ready,
    });
  });

  type ShareRunResult = {
    brandId: string;
    brandName: string;
    cleexsScore: number;
    competitors: string[];
    competitorDetails?: Array<{ name: string; domain?: string | null }>;
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
          competitorDetails: fullRun.brand.competitors.map((c) => ({ name: c.name, domain: c.domain })),
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
            competitorDetails: fullRunGemini.brand.competitors.map((c) => ({ name: c.name, domain: c.domain })),
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
        status: true,
        tier: true,
        runId: true,
        runGeminiId: true,
        email: true,
        sourceChannel: true,
        createdAt: true,
        updatedAt: true,
        shareSlug: true,
        setupDraftJson: true,
      },
    });
    if (!row) {
      return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
    }

    const setupDraft = parsePublicSetupDraft(row.setupDraftJson);

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
    const isWaChannel = isWhatsAppSourceChannel(row.sourceChannel);
    const showFullReport = isWaChannel ? true : tier === 'gold' || isFirstRun;

    const runResultShape = {
      brandId: '' as string,
      brandName: '' as string,
      cleexsScore: 0 as number,
      competitors: [] as string[],
      competitorDetails: [] as Array<{ name: string; domain?: string | null }>,
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
      setupDraft?: {
        suggestedCompetitorUrls: string[];
        marketCountry?: string;
        useSerp?: boolean;
      } | null;
      email?: string | null;
      sourceChannel?: string | null;
      resultUrl?: string | null;
      channelView?: 'whatsapp_lite';
    } = {
      id: diagnostic.id,
      domain: diagnostic.domain,
      brandName: diagnostic.brandName,
      status: diagnostic.status,
      tier,
      isFirstRun,
      showFullReport,
      runId: diagnostic.runId,
      runGeminiId: diagnostic.runGeminiId ?? null,
      shareSlug: shareSlugOut,
      setupDraft: setupDraft ?? null,
      email:
        row.email && !row.email.endsWith('@whatsapp.cleexs.net') ? row.email : null,
      sourceChannel: row.sourceChannel ?? null,
      ...(isWaChannel
        ? {
            resultUrl: buildWaResultUrl(diagnostic.id, getAppBaseUrlForPublicLinks()),
            channelView: 'whatsapp_lite' as const,
          }
        : {}),
    };

    if (diagnostic.analysisJson && !isWaChannel) {
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
      const siteContextReady = !!diagnostic.runId || diagnostic.status === 'completed';
      const preCompleted = (siteContextReady ? 1 : 0) + (!!diagnostic.runId ? 1 : 0);
      const analysisStepsCount = DIAGNOSTIC_STEP_LABELS.length - 2;

      steps = DIAGNOSTIC_STEP_LABELS.map((label, idx) => {
        let completed: boolean;
        if (idx < 2) {
          completed = idx === 0 ? siteContextReady : !!diagnostic.runId;
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

      if (
        diagnostic.status === 'completed' &&
        showFullReport &&
        diagnostic.analysisJson &&
        typeof diagnostic.analysisJson === 'object' &&
        !Array.isArray(diagnostic.analysisJson)
      ) {
        const sanitized = sanitizeAnalysisJsonForPublicGet(diagnostic.analysisJson);
        base.analysisJson = isWaChannel
          ? (stripSatelliteFromAnalysisJson(sanitized) ?? sanitized)
          : sanitized;
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
            competitorDetails: fullRun.brand.competitors.map((c) => ({ name: c.name, domain: c.domain })),
            brandAliases: fullRun.brand.aliases.map((a) => a.alias),
            promptResults:
              showFullReport && !isWaChannel
                ? fullRun.promptResults.map((pr) => ({
                    category: pr.prompt?.category?.name ?? 'General',
                    score: pr.score,
                    promptText: pr.prompt?.promptText ?? '',
                    responseText: truncatePromptResponseText(pr.responseText),
                    top3Json: pr.top3Json as Array<{
                      position: number;
                      name: string;
                      type: string;
                      reason?: string;
                    }>,
                    flags: (pr.flags as Record<string, boolean>) ?? {},
                  }))
                : isWaChannel
                  ? fullRun.promptResults.map((pr) => ({
                      category: pr.prompt?.category?.name ?? 'General',
                      score: pr.score,
                      top3Json: pr.top3Json as Array<{
                        position: number;
                        name: string;
                        type: string;
                        reason?: string;
                      }>,
                    }))
                  : [],
          };
        }
      }

      // Run Gemini: mismo formato de runResult para score y métricas por modelo
      if (
        !isWaChannel &&
        diagnostic.runGeminiId &&
        diagnostic.status === 'completed' &&
        showFullReport
      ) {
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
              competitorDetails: fullRunGemini.brand.competitors.map((c) => ({ name: c.name, domain: c.domain })),
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
      const siteContextReady = !!diagnostic.runId || diagnostic.status === 'completed';
      const preCompleted = (siteContextReady ? 1 : 0) + (!!diagnostic.runId ? 1 : 0);
      steps = DIAGNOSTIC_STEP_LABELS.map((label, idx) => ({
        id: `step-${idx + 1}`,
        label,
        completed: idx < 2 && (idx === 0 ? siteContextReady : !!diagnostic.runId),
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
