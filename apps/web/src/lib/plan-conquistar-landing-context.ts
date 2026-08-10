import { findCountryByName } from '@cleexs/shared';
import type { PublicDiagnostic, PublicDiagnosticRunResult } from '@/lib/api';
import { buildPlanConquistarTeaserData } from '@/lib/plan-conquistar-preview';
import { buildEngineScoresFromDiagnostic } from '@/components/diagnostico/cleexs-engine-scores-panel';

export type LandingCompetitor = {
  name: string;
  domain?: string | null;
};

export type PlanConquistarLandingContext = {
  brandName: string;
  domain: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  countryIso: string | null;
  countryFlag: string | null;
  industry: string | null;
  language: string | null;
  languageLabel: string | null;
  competitors: LandingCompetitor[];
  engines: string[];
  cleexsScore: number | null;
  opportunityCount: number | null;
  topActions: string[];
  status: PublicDiagnostic['status'];
};

const LANGUAGE_LABEL: Record<string, string> = {
  es: 'Español',
  pt: 'Português',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
};

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

function hostFromUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const host = new URL(withProto).hostname.replace(/^www\./i, '');
    return host || null;
  } catch {
    return t.replace(/^www\./i, '').split('/')[0] || null;
  }
}

function brandFromHost(host: string): string {
  const base = host.split('.')[0] || host;
  const pretty: Record<string, string> = {
    playstation: 'PlayStation',
    xbox: 'Xbox',
    steampowered: 'Steam',
    nintendo: 'Nintendo',
  };
  const key = base.toLowerCase();
  if (pretty[key]) return pretty[key];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Limpia "Playstation (playstation.com)" → "PlayStation". */
export function cleanCompetitorName(raw: string, domainHint?: string | null): string {
  let name = raw.trim();
  const paren = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    name = paren[1].trim();
    domainHint = domainHint || paren[2].trim();
  }
  if (domainHint) {
    const host = hostFromUrl(domainHint);
    if (host) {
      const fromHost = brandFromHost(host);
      // Si el nombre es casi el host, preferimos el pretty del host
      if (normalizeLoose(name) === normalizeLoose(host.split('.')[0] || '') || name.length < 3) {
        return fromHost;
      }
    }
  }
  const known: Record<string, string> = {
    playstation: 'PlayStation',
    xbox: 'Xbox',
    steampowered: 'Steam',
    steam: 'Steam',
  };
  return known[normalizeLoose(name)] || name;
}

function normalizeLoose(v: string) {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Bandera emoji desde ISO-3166 alfa-2 (ej. BO → 🇧🇴). */
export function flagEmojiFromIso(iso: string | null | undefined): string | null {
  if (!iso || iso.length !== 2) return null;
  const code = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

function registrableKey(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, '');
  const parts = h.split('.').filter(Boolean);
  if (parts.length <= 2) return h;
  // ej. foo.com.ar / foo.com.br → últimos 3; foo.co.uk similar
  const last = parts[parts.length - 1];
  const mid = parts[parts.length - 2];
  if (last.length === 2 && mid.length <= 3) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

function isSameBrandDomain(candidateHost: string, brandDomain: string): boolean {
  const a = registrableKey(candidateHost);
  const b = registrableKey(hostFromUrl(brandDomain) || brandDomain);
  return Boolean(a && b && a === b);
}

function competitorsFromUrls(
  urls: string[] | undefined,
  brandDomain: string,
  nameByDomain?: Map<string, string>
): LandingCompetitor[] {
  if (!urls?.length) return [];
  const seen = new Set<string>();
  const out: LandingCompetitor[] = [];
  for (const url of urls) {
    const domain = hostFromUrl(url);
    if (!domain) continue;
    if (isSameBrandDomain(domain, brandDomain)) continue;
    const key = registrableKey(domain);
    if (seen.has(key)) continue;
    seen.add(key);
    const fromRun = nameByDomain?.get(key);
    out.push({
      name: fromRun ? cleanCompetitorName(fromRun, domain) : brandFromHost(domain),
      domain,
    });
    if (out.length >= 5) break;
  }
  return out;
}

function competitorsFromRun(
  run: PublicDiagnosticRunResult,
  brandDomain: string
): LandingCompetitor[] {
  if (run.competitorDetails?.length) {
    return run.competitorDetails
      .filter((c) => c.name?.trim())
      .filter((c) => {
        if (!c.domain) return true;
        const host = hostFromUrl(c.domain);
        return !host || !isSameBrandDomain(host, brandDomain);
      })
      .slice(0, 5)
      .map((c) => ({
        name: cleanCompetitorName(c.name, c.domain),
        domain: c.domain ?? null,
      }));
  }
  if (run.competitors?.length) {
    return run.competitors
      .filter((name) => name?.trim())
      .slice(0, 5)
      .map((name) => ({ name: cleanCompetitorName(name), domain: null }));
  }
  return [];
}

/** Mapa dominio→nombre real del run para no inventar solo desde el host. */
function nameMapFromRun(run: PublicDiagnosticRunResult | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!run?.competitorDetails?.length) return map;
  for (const c of run.competitorDetails) {
    if (!c.domain || !c.name?.trim()) continue;
    const host = hostFromUrl(c.domain);
    if (!host) continue;
    map.set(registrableKey(host), c.name.trim());
  }
  return map;
}

export function formatCompetitorList(names: string[]): string | null {
  if (!names.length) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/**
 * Contexto de landing priorizando datos del onboarding (setupDraft).
 * El run del diagnóstico solo complementa score/acciones y rivales si faltan URLs.
 */
export function buildPlanConquistarLandingContext(
  diagnostic: PublicDiagnostic
): PlanConquistarLandingContext {
  const draft = diagnostic.setupDraft;
  const countryRaw =
    draft?.confirmedCountry?.trim() ||
    draft?.suggestedCountry?.trim() ||
    draft?.marketCountry?.trim() ||
    null;
  const countryRow = findCountryByName(countryRaw);
  const countryIso = countryRow?.iso ?? null;
  const country = countryRow?.name ?? countryRaw;
  const industry =
    draft?.confirmedIndustry?.trim() || draft?.suggestedIndustry?.trim() || null;
  const language = draft?.selectedLanguage?.trim() || null;
  const languageLabel = language ? LANGUAGE_LABEL[language] || language : null;

  // Onboarding primero; nombres del run si el dominio coincide; nunca incluir dominio propio
  const nameByDomain = nameMapFromRun(diagnostic.runResult);
  const fromOnboarding = competitorsFromUrls(
    draft?.confirmedCompetitorUrls?.length
      ? draft.confirmedCompetitorUrls
      : draft?.suggestedCompetitorUrls,
    diagnostic.domain,
    nameByDomain
  );
  const fromRun = diagnostic.runResult
    ? competitorsFromRun(diagnostic.runResult, diagnostic.domain)
    : [];
  const competitors = fromOnboarding.length ? fromOnboarding : fromRun;

  const enginesRaw = draft?.selectedEngines?.length
    ? draft.selectedEngines
    : ['chatgpt'];
  const engines = enginesRaw.map((e) => ENGINE_LABEL[e.toLowerCase()] || e);

  let cleexsScore: number | null = null;
  let opportunityCount: number | null = null;
  let topActions: string[] = [];

  if (diagnostic.runResult) {
    const enginesState = buildEngineScoresFromDiagnostic({
      chatgptScore: diagnostic.runResult.cleexsScore,
      runResultGemini: diagnostic.runResultGemini,
      runResultPerplexity: diagnostic.runResultPerplexity,
      runResultClaude: diagnostic.runResultClaude,
      geminiRunStatus: diagnostic.geminiRunStatus,
      perplexityRunStatus: diagnostic.perplexityRunStatus,
      claudeRunStatus: diagnostic.claudeRunStatus,
      runGeminiId: diagnostic.runGeminiId,
      runPerplexityId: diagnostic.runPerplexityId,
      runClaudeId: diagnostic.runClaudeId,
      lockUnavailableEngines: true,
    });
    const teaser = buildPlanConquistarTeaserData(
      diagnostic.runResult,
      diagnostic.satelliteModule,
      `https://${diagnostic.domain.replace(/^www\./, '')}`,
      diagnostic.domainRating,
      enginesState
    );
    cleexsScore = teaser.cleexsScore;
    opportunityCount = teaser.totalOpportunities;
    topActions = teaser.opportunities.slice(0, 4).map((o) => o.action);
  }

  return {
    brandName: diagnostic.brandName,
    domain: diagnostic.domain.replace(/^www\./, ''),
    firstName: draft?.firstName?.trim() || null,
    lastName: draft?.lastName?.trim() || null,
    country,
    countryIso,
    countryFlag: flagEmojiFromIso(countryIso),
    industry,
    language,
    languageLabel,
    competitors,
    engines,
    cleexsScore,
    opportunityCount,
    topActions,
    status: diagnostic.status,
  };
}

export type RoadmapTabId = 'hora' | 'semana' | 'd30' | 'd60' | 'd90';

export type RoadmapTab = {
  id: RoadmapTabId;
  label: string;
  title: string;
  items: string[];
};

export function buildLandingRoadmapTabs(ctx: PlanConquistarLandingContext): RoadmapTab[] {
  const brand = ctx.brandName;
  const rival = ctx.competitors[0]?.name;
  const industryBit = ctx.industry ? ` en ${ctx.industry}` : '';
  const countryBit = ctx.country ? ` (${ctx.country})` : '';
  const enginesBit = ctx.engines.slice(0, 2).join(' y ') || 'ChatGPT';

  const action1 = ctx.topActions[0];
  const action2 = ctx.topActions[1];
  const action3 = ctx.topActions[2];

  return [
    {
      id: 'hora',
      label: 'Primera hora',
      title: `Arranque inmediato para ${brand}`,
      items: [
        action1 ||
          `Revisá el diagnóstico de ${brand}${countryBit} y marcá la intención más débil.`,
        `Anotá cómo aparece hoy ${brand} frente a ${rival || 'tus competidores'} en ${enginesBit}.`,
        `Definí 1 página del sitio que responda mejor esa consulta${industryBit}.`,
      ],
    },
    {
      id: 'semana',
      label: 'Semana 1',
      title: 'Quick wins de esta semana',
      items: [
        action2 || `Publicá o mejorá una pieza clara para la prioridad #1 de ${brand}.`,
        action3 ||
          `Sumá 3 FAQs verificables sobre lo que preguntan los clientes de ${brand}.`,
        rival
          ? `Borrador honesto: ${brand} vs ${rival} (cuándo conviene cada uno).`
          : `Armá una comparativa base con los competidores cargados para ${brand}.`,
      ],
    },
    {
      id: 'd30',
      label: '30 días',
      title: ctx.country
        ? `Mes 1 — señales que ${enginesBit} entiende en ${ctx.country}`
        : 'Mes 1 — señales que la IA entiende',
      items: [
        `Publicá 2–3 piezas que cubran intenciones con bajo score de ${brand}.`,
        `Unificá descripción, rubro y propuesta de valor en el sitio y perfiles externos.`,
        rival
          ? `Cerrá brechas evidentes vs ${rival} con datos, casos o prueba social.`
          : `Sumá evidencia verificable (casos, datos, testimonios) en el sitio.`,
      ],
    },
    {
      id: 'd60',
      label: '60 días',
      title: 'Mes 2 — autoridad y cobertura',
      items: [
        `Ampliá cobertura a intenciones secundarias detectadas para ${brand}.`,
        `Aparecé en 1–2 fuentes externas del sector${industryBit || ''}.`,
        `Reforzá comparativas y FAQs con contenido actualizado y citables.`,
      ],
    },
    {
      id: 'd90',
      label: '90 días',
      title: 'Mes 3 — medir y reforzar',
      items: [
        `Re-análisis Cleexs a los ~75 días para ver el avance de ${brand}.`,
        `Duplicá lo que mejoró el score; descartá lo que no movió la aguja.`,
        `Planificá el siguiente ciclo de 90 días con las nuevas oportunidades.`,
      ],
    },
  ];
}
