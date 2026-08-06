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
  country: string | null;
  countryIso: string | null;
  countryFlag: string | null;
  industry: string | null;
  competitors: LandingCompetitor[];
  engines: string[];
  cleexsScore: number | null;
  opportunityCount: number | null;
  topActions: string[];
  status: PublicDiagnostic['status'];
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
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Bandera emoji desde ISO-3166 alfa-2 (ej. BO → 🇧🇴). */
export function flagEmojiFromIso(iso: string | null | undefined): string | null {
  if (!iso || iso.length !== 2) return null;
  const code = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

function competitorsFromUrls(urls: string[] | undefined): LandingCompetitor[] {
  if (!urls?.length) return [];
  const seen = new Set<string>();
  const out: LandingCompetitor[] = [];
  for (const url of urls) {
    const domain = hostFromUrl(url);
    if (!domain) continue;
    const key = domain.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: brandFromHost(domain), domain });
  }
  return out;
}

function competitorsFromRun(run: PublicDiagnosticRunResult): LandingCompetitor[] {
  if (run.competitorDetails?.length) {
    return run.competitorDetails
      .filter((c) => c.name?.trim())
      .slice(0, 5)
      .map((c) => ({ name: c.name.trim(), domain: c.domain ?? null }));
  }
  if (run.competitors?.length) {
    return run.competitors
      .filter((name) => name?.trim())
      .slice(0, 5)
      .map((name) => ({ name: name.trim(), domain: null }));
  }
  return [];
}

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

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

  const fromUrls = competitorsFromUrls(
    draft?.confirmedCompetitorUrls?.length
      ? draft.confirmedCompetitorUrls
      : draft?.suggestedCompetitorUrls
  );
  const fromRun = diagnostic.runResult ? competitorsFromRun(diagnostic.runResult) : [];
  const competitors = fromRun.length ? fromRun : fromUrls;

  const enginesRaw = draft?.selectedEngines?.length
    ? draft.selectedEngines
    : ['chatgpt', 'gemini', 'claude', 'perplexity'];
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
    country,
    countryIso,
    countryFlag: flagEmojiFromIso(countryIso),
    industry,
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
        `Anotá cómo aparece hoy ${brand} frente a ${rival || 'tus competidores'} en ChatGPT.`,
        `Definí 1 página del sitio que responda mejor esa consulta${industryBit}.`,
      ],
    },
    {
      id: 'semana',
      label: 'Semana 1',
      title: 'Quick wins de esta semana',
      items: [
        action2 ||
          `Publicá o mejorá una pieza clara para la prioridad #1 de ${brand}.`,
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
      title: 'Mes 1 — señales que la IA entiende',
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
        `Aparecé en 1–2 fuentes externas del sector (directorios, comunidades, demos).`,
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
