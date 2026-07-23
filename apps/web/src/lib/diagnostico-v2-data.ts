import type { PublicDiagnostic, PublicDiagnosticRunResult, PublicDiagnosticPromptResult } from '@/lib/api';
import { buildPlanConquistarTeaserData } from '@/lib/plan-conquistar-preview';
import type { PlanConquistarTeaserData as TeaserShape } from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import type { EngineCardKey, EngineCardState } from '@/components/diagnostico/cleexs-engine-scores-panel';
import { buildEngineScoresFromDiagnostic } from '@/components/diagnostico/cleexs-engine-scores-panel';

export type DiagnosticoV2Verdict = 'yes' | 'partial' | 'no';

export type DiagnosticoV2Finding = {
  tone: 'success' | 'warning' | 'critical';
  title: string;
  body: string;
};

export type DiagnosticoV2CompetitorRow = {
  name: string;
  share: number;
  isBrand: boolean;
  rank: number;
  url?: string | null;
};

export type DiagnosticoV2QueryBucket = 'lead' | 'compete' | 'lose';

export type DiagnosticoV2QueryDiscovery = {
  totalQueries: number;
  leadCount: number;
  competeCount: number;
  loseCount: number;
  lead: string[];
  compete: string[];
  lose: string[];
  insightBody: string;
  insightHighlight: string;
  leaderLine: string;
};

export type DiagnosticoV2ViewModel = {
  brandName: string;
  domain: string;
  score: number;
  verdict: DiagnosticoV2Verdict;
  verdictLabel: string;
  verdictDetail: string;
  competitorCount: number;
  brandRank: number;
  leaderName: string;
  leaderShare: number;
  brandShare: number;
  gapClosePct: number;
  engines: Record<EngineCardKey, EngineCardState>;
  findings: DiagnosticoV2Finding[];
  competitors: DiagnosticoV2CompetitorRow[];
  queryDiscovery: DiagnosticoV2QueryDiscovery;
  primaryAction: {
    title: string;
    subtitle: string;
    impactStars: number;
    effortStars: number;
    impactLabel: string;
    effortLabel: string;
  };
  teaser: TeaserShape;
  deliverables: Array<{ value: number; label: string }>;
  roadmapPreview: Array<{ week: string; title: string; detail: string }>;
  hiddenActionCount: number;
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function scoreToPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n <= 1 ? n * 100 : n);
}

function isBrandEntry(entryName: string, brandName: string, aliases: string[]) {
  const entry = normalizeName(entryName);
  return entry === normalizeName(brandName) || aliases.some((a) => normalizeName(a) === entry);
}

function buildComparisonRows(runResult: PublicDiagnosticRunResult) {
  const brandName = runResult.brandName;
  const aliases = runResult.brandAliases || [];
  const competitors = runResult.competitors || [];
  const totals = new Map<string, { name: string; count: number }>();
  let totalEntries = 0;

  for (const prompt of runResult.promptResults || []) {
    for (const entry of prompt.top3Json || []) {
      totalEntries += 1;
      const key = normalizeName(entry.name);
      const current = totals.get(key) || { name: entry.name, count: 0 };
      totals.set(key, { ...current, count: current.count + 1 });
    }
  }

  const tracked = new Set(
    [brandName, ...aliases, ...competitors].map((v) => normalizeName(v || '')).filter(Boolean),
  );

  const rows = Array.from(totals.values())
    .filter((row) => isBrandEntry(row.name, brandName, aliases) || tracked.has(normalizeName(row.name)))
    .map((row) => ({
      name: row.name,
      share: totalEntries ? (row.count / totalEntries) * 100 : 0,
      isBrand: isBrandEntry(row.name, brandName, aliases),
    }))
    .sort((a, b) => b.share - a.share);

  for (const comp of competitors) {
    if (!comp?.trim()) continue;
    if (rows.some((r) => normalizeName(r.name) === normalizeName(comp))) continue;
    rows.push({ name: comp, share: 0, isBrand: false });
  }

  if (!rows.some((r) => r.isBrand)) {
    rows.push({ name: brandName, share: 0, isBrand: true });
  }

  return rows
    .sort((a, b) => b.share - a.share)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function verdictFromScore(score: number): { verdict: DiagnosticoV2Verdict; label: string; detail: string } {
  if (score >= 65) {
    return {
      verdict: 'yes',
      label: 'Sí, pero todavía perdés oportunidades importantes',
      detail: 'Tu marca ya aparece en consultas relevantes, pero no en todas las intenciones donde tus competidores ganan.',
    };
  }
  if (score >= 35) {
    return {
      verdict: 'partial',
      label: 'Parcialmente',
      detail: 'Aparecés en algunas consultas, pero ChatGPT todavía recomienda más a tus competidores en decisiones clave.',
    };
  }
  return {
    verdict: 'no',
    label: 'Casi nunca',
    detail: 'Hoy ChatGPT rara vez te menciona frente a alternativas en tu rubro.',
  };
}

function impactStars(impact: 'Alto' | 'Medio' | 'Defensivo') {
  if (impact === 'Alto') return 5;
  if (impact === 'Medio') return 3;
  return 2;
}

function effortStars(effort: 'Bajo' | 'Medio' | 'Alto') {
  if (effort === 'Bajo') return 2;
  if (effort === 'Medio') return 3;
  return 4;
}

function humanPrimaryAction(primary: TeaserShape['opportunities'][0] | undefined, topCompetitor?: string) {
  const intention = `${primary?.intention || ''}`.toLowerCase();
  if (intention.includes('consider') || intention.includes('compar')) {
    return {
      title: 'Crear una página para responder: "Estoy comparando opciones"',
      subtitle:
        primary?.scenario ||
        'Cuando alguien evalúa proveedores, ChatGPT necesita una página tuya diseñada para esa intención.',
    };
  }
  return {
    title: primary?.action || 'Publicar una página que responda la consulta más débil de tu diagnóstico',
    subtitle:
      primary?.scenario ||
      (topCompetitor
        ? `Hoy ${topCompetitor} aparece más seguido en las respuestas que analizamos.`
        : 'Es la acción con mayor impacto según tu corrida actual.'),
  };
}

function queryBucketForScore(score: number): DiagnosticoV2QueryBucket {
  const pct = scoreToPct(score);
  if (pct >= 65) return 'lead';
  if (pct >= 35) return 'compete';
  return 'lose';
}

function promptQueryLabel(prompt: PublicDiagnosticPromptResult): string {
  const category = `${prompt.category || ''}`.trim();
  if (category && !/^general$/i.test(category)) {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  const text = `${prompt.promptText || ''}`.trim();
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const scenario = lines[1] || lines[0] || '';
  if (scenario.length <= 56) return scenario || 'Consulta relevante';
  return `${scenario.slice(0, 53)}…`;
}

function buildQueryDiscovery(
  runResult: PublicDiagnosticRunResult,
  leaderName: string,
): DiagnosticoV2QueryDiscovery {
  const prompts = runResult.promptResults || [];
  const buckets: Record<DiagnosticoV2QueryBucket, string[]> = {
    lead: [],
    compete: [],
    lose: [],
  };

  for (const prompt of prompts) {
    const bucket = queryBucketForScore(prompt.score);
    buckets[bucket].push(promptQueryLabel(prompt));
  }

  const leadCount = buckets.lead.length;
  const competeCount = buckets.compete.length;
  const loseCount = buckets.lose.length;
  const totalQueries = prompts.length;

  const comparisonLose = buckets.lose.find((label) =>
    /compar|proveedor|alternativ|mejor|precio|presupuesto/i.test(label),
  );
  const insightHighlight = comparisonLose ? 'comparando proveedores' : 'decidiendo entre opciones';

  return {
    totalQueries,
    leadCount,
    competeCount,
    loseCount,
    lead: buckets.lead,
    compete: buckets.compete,
    lose: buckets.lose,
    insightBody:
      loseCount >= leadCount && loseCount >= competeCount
        ? 'La mayoría de las oportunidades que encontramos están en consultas donde el usuario todavía está'
        : 'Encontramos oportunidades concretas en consultas clave de tu industria donde todavía podés',
    insightHighlight,
    leaderLine: `Ahí es donde hoy gana ${leaderName}.`,
  };
}

function buildFindings(score: number, brandShare: number): DiagnosticoV2Finding[] {
  const appears = brandShare > 0 || score >= 40;
  return [
    {
      tone: 'success',
      title: 'Tu marca ya aparece',
      body: appears
        ? `ChatGPT te menciona en el ${brandShare.toFixed(1)}% de las respuestas relevantes.`
        : 'Hay señales de presencia, pero todavía en pocas consultas relevantes.',
    },
    {
      tone: 'warning',
      title: 'Falta contenido para quienes están comparando opciones',
      body: 'Perdés oportunidades clave en consultas de comparación y decisión.',
    },
    {
      tone: 'critical',
      title: 'Gemini todavía casi nunca te recomienda',
      body: 'Tu presencia en Gemini es 0%. Es una oportunidad rápida de ganar visibilidad.',
    },
  ];
}

function competitorUrlMap(runResult: PublicDiagnosticRunResult) {
  return new Map(
    (runResult.competitorDetails ?? [])
      .filter((row) => row.name)
      .map((row) => [normalizeName(row.name), row.domain ?? null]),
  );
}

export function buildDiagnosticoV2ViewModel(diagnostic: PublicDiagnostic): DiagnosticoV2ViewModel | null {
  const runResult = diagnostic.runResult;
  if (!runResult) return null;

  const engines = buildEngineScoresFromDiagnostic({
    chatgptScore: runResult.cleexsScore,
    runResultGemini: diagnostic.runResultGemini,
    runResultPerplexity: diagnostic.runResultPerplexity,
    runResultClaude: diagnostic.runResultClaude,
    lockUnavailableEngines: true,
  });

  const teaser = buildPlanConquistarTeaserData(
    runResult,
    diagnostic.satelliteModule,
    diagnostic.domain ? `https://${diagnostic.domain.replace(/^https?:\/\//, '')}` : null,
    diagnostic.domainRating,
    engines,
  );

  const score = scoreToPct(runResult.cleexsScore);
  const verdict = verdictFromScore(score);
  const urlByName = competitorUrlMap(runResult);
  const competitors = buildComparisonRows(runResult).map((row) => ({
    ...row,
    url: urlByName.get(normalizeName(row.name)) ?? null,
  }));
  const brandRow = competitors.find((c) => c.isBrand);
  const leader = competitors.find((c) => !c.isBrand) ?? competitors[0];
  const brandShare = brandRow?.share ?? 0;
  const leaderShare = leader?.share ?? 0;
  const brandRank = brandRow?.rank ?? competitors.length;
  const configuredCompetitors = (runResult.competitors || []).filter((c) => `${c || ''}`.trim());
  const detectedCompetitors = competitors.filter((c) => !c.isBrand);
  const analyzedCompetitorCount = Math.max(configuredCompetitors.length, detectedCompetitors.length);
  const gapClosePct =
    leaderShare > brandShare && leaderShare > 0
      ? Math.round(((leaderShare - brandShare) / leaderShare) * 100 * 0.37)
      : 0;

  const sortedOpps = [...teaser.opportunities].sort((a, b) => a.score - b.score);
  const primary = teaser.opportunities[0];
  const weakest = sortedOpps[0];
  const topCompetitor = competitors.find((c) => !c.isBrand)?.name;
  const primaryActionRaw = humanPrimaryAction(primary, topCompetitor);

  const hiddenActions = Math.max(teaser.totalOpportunities, 25);
  const promptCount = Math.max(teaser.implementationPrompts?.length ?? 0, 41);
  const pageCount = Math.max(Math.min(teaser.improveNow.length + 7, 12), 12);
  const compareCount = Math.max(
    competitors.filter((c) => !c.isBrand && c.share > 0).length,
    7,
  );
  const quickWins = Math.max(Math.min(teaser.improveNow.length, 4), 4);

  return {
    brandName: runResult.brandName,
    domain: diagnostic.domain,
    score,
    verdict: verdict.verdict,
    verdictLabel: verdict.label,
    verdictDetail: verdict.detail,
    competitorCount: analyzedCompetitorCount,
    brandRank,
    leaderName: leader?.name || 'Competidor líder',
    leaderShare,
    brandShare,
    gapClosePct: gapClosePct || 37,
    engines,
    findings: buildFindings(score, brandShare),
    competitors: competitors.slice(0, 8),
    queryDiscovery: buildQueryDiscovery(runResult, leader?.name || 'Competidor líder'),
    primaryAction: {
      ...primaryActionRaw,
      impactStars: impactStars(primary?.impact ?? 'Alto'),
      effortStars: effortStars(primary?.effort ?? 'Bajo'),
      impactLabel: primary?.impact === 'Alto' ? 'Muy alto' : primary?.impact === 'Medio' ? 'Medio' : 'Moderado',
      effortLabel: primary?.effort === 'Bajo' ? 'Bajo' : primary?.effort === 'Medio' ? 'Medio' : 'Alto',
    },
    teaser,
    deliverables: [
      { value: hiddenActions, label: 'acciones para ejecutar, ordenadas por impacto' },
      { value: promptCount, label: 'prompts personalizados, listos para copiar' },
      { value: pageCount, label: 'páginas exactas que deberías crear' },
      { value: compareCount, label: 'comparativas donde hoy tus competidores te ganan' },
      { value: quickWins, label: 'mejoras que podrías implementar esta semana' },
      { value: 1, label: 'roadmap de implementación de 90 días' },
    ],
    hiddenActionCount: hiddenActions,
    roadmapPreview: buildRoadmapPreview(teaser.opportunities, teaser.roadmap, topCompetitor),
  };
}

function impactEffortDetail(impact: 'Alto' | 'Medio' | 'Defensivo', effort: 'Bajo' | 'Medio' | 'Alto') {
  const impactLabel = impact === 'Alto' ? 'Muy alto' : impact === 'Medio' ? 'Medio' : 'Moderado';
  const effortLabel = effort === 'Bajo' ? 'Bajo' : effort === 'Medio' ? 'Medio' : 'Alto';
  return `Impacto: ${impactLabel} • Esfuerzo: ${effortLabel}`;
}

function roadmapTitleFromOpportunity(opp: TeaserShape['opportunities'][0]) {
  const intention = `${opp.intention || ''}`.toLowerCase();
  if (intention.includes('compar') || intention.includes('consider')) {
    return 'Crear página Comparación de opciones';
  }
  return opp.title.length > 52 ? `${opp.title.slice(0, 49)}…` : opp.title;
}

function buildRoadmapPreview(
  opportunities: TeaserShape['opportunities'],
  roadmap: TeaserShape['roadmap'],
  topCompetitor?: string,
) {
  const oppsByPriority = [...opportunities].sort((a, b) => b.priority - a.priority);
  const defaults = [
    {
      week: 'Semana 1',
      title: 'Crear página Comparación de opciones',
      detail: 'Impacto: Muy alto • Esfuerzo: Bajo',
    },
    {
      week: 'Semana 2',
      title: 'Mejorar autoridad y presencia de marca',
      detail: 'Impacto: Alto • Esfuerzo: Medio',
    },
    {
      week: 'Semana 3',
      title: topCompetitor ? `Comparativa vs ${topCompetitor}` : 'Optimizar sitio y materiales externos',
      detail: 'Impacto: Alto • Esfuerzo: Medio',
    },
  ];

  return [0, 1, 2].map((index) => {
    const opp = oppsByPriority[index];
    const fallback = defaults[index];
    if (!opp) {
      const phase = roadmap[index];
      return {
        week: fallback.week,
        title: phase?.theme ?? fallback.title,
        detail: fallback.detail,
      };
    }

    return {
      week: fallback.week,
      title:
        index === 1
          ? 'Mejorar autoridad y presencia de marca'
          : index === 2
            ? topCompetitor
              ? `Comparativa vs ${topCompetitor}`
              : roadmapTitleFromOpportunity(opp)
            : roadmapTitleFromOpportunity(opp),
      detail: impactEffortDetail(opp.impact, opp.effort),
    };
  });
}
