import type { PublicDiagnostic, PublicDiagnosticRunResult, PublicDiagnosticPromptResult } from '@/lib/api';
import { buildPlanConquistarTeaserData } from '@/lib/plan-conquistar-preview';
import type { PlanConquistarTeaserData as TeaserShape } from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import type { EngineCardKey, EngineCardState } from '@/components/diagnostico/cleexs-engine-scores-panel';
import { buildEngineScoresFromDiagnostic } from '@/components/diagnostico/cleexs-engine-scores-panel';
import { computeWaRunMetrics } from '@/lib/wa-run-metrics';

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
  queryTypeCount: number;
  leadPromptCount: number;
  competePromptCount: number;
  losePromptCount: number;
  lead: string[];
  compete: string[];
  lose: string[];
  funnel: {
    mentionCount: number;
    mentionRate: number;
    top3Count: number;
    top3Rate: number;
    top1Count: number;
    top1Rate: number;
    convMentionToTop3: number;
    convTop3ToFirst: number;
  };
  insightBody: string;
  insightHighlight: string;
  leaderName: string;
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

function normalizeIntentionKey(value: string) {
  const n = normalizeName(value);
  if (n.includes('urgencia')) return 'urgencia';
  if (n.includes('consideracion')) return 'consideracion';
  if (n.includes('calidad')) return 'calidad';
  if (n.includes('precio')) return 'precio';
  return null;
}

function extractIntentionFromPrompt(promptText?: string | null) {
  const match = (promptText || '').match(/Intención:\s*([^\(\n]+)\s*\((\d+)%\)/i);
  if (!match) return null;
  return { name: match[1].trim(), weight: Number(match[2]) };
}

function interpretQueryArchetype(prompt: PublicDiagnosticPromptResult): string {
  const lines = (prompt.promptText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const scenario = (lines[1] || lines[0] || '').toLowerCase();
  const blob = `${prompt.promptText || ''}\n${prompt.category || ''}`.toLowerCase();
  const haystack = `${scenario} ${blob}`;

  if (/compar|proveedor|alternativ|mejores?\s+empres|versus|\bvs\b/.test(haystack)) {
    return 'Comparación de proveedores';
  }
  if (/precio|presupuesto|costo|barato/.test(haystack)) return 'Precio y presupuesto';
  if (/marca|reputaci|confianza/.test(haystack)) return 'Consultas de marca';
  if (/calidad|confiable|mejor calidad/.test(haystack)) return 'Consultas de calidad';
  if (/servicio|soluci|implement/.test(haystack)) return 'Consultas de servicio';
  if (/informaci|qué es|caracter|especific/.test(haystack)) return 'Consultas específicas';

  const intention = extractIntentionFromPrompt(prompt.promptText);
  const key = intention ? normalizeIntentionKey(intention.name) : null;
  if (key === 'consideracion') return 'Consultas de comparación';
  if (key === 'calidad') return 'Consultas de calidad';
  if (key === 'precio') return 'Consultas de precio';
  if (key === 'urgencia') return 'Consultas urgentes';

  return 'Consultas informativas';
}

function buildQueryDiscovery(
  runResult: PublicDiagnosticRunResult,
  leaderName: string,
): DiagnosticoV2QueryDiscovery {
  const prompts = runResult.promptResults || [];
  const metrics = computeWaRunMetrics(runResult);

  const promptBuckets: Record<DiagnosticoV2QueryBucket, number> = {
    lead: 0,
    compete: 0,
    lose: 0,
  };
  const archetypeBuckets: Record<DiagnosticoV2QueryBucket, Map<string, number[]>> = {
    lead: new Map(),
    compete: new Map(),
    lose: new Map(),
  };

  for (const prompt of prompts) {
    const bucket = queryBucketForScore(prompt.score);
    promptBuckets[bucket] += 1;

    const label = interpretQueryArchetype(prompt);
    const scores = archetypeBuckets[bucket].get(label) ?? [];
    scores.push(scoreToPct(prompt.score));
    archetypeBuckets[bucket].set(label, scores);
  }

  const toSortedLabels = (bucket: DiagnosticoV2QueryBucket) =>
    Array.from(archetypeBuckets[bucket].entries())
      .sort((a, b) => {
        const avgA = a[1].reduce((sum, value) => sum + value, 0) / a[1].length;
        const avgB = b[1].reduce((sum, value) => sum + value, 0) / b[1].length;
        return avgB - avgA;
      })
      .map(([label]) => label);

  const lead = toSortedLabels('lead');
  const compete = toSortedLabels('compete');
  const lose = toSortedLabels('lose');
  const queryTypeCount = new Set(
    prompts.map((prompt) => interpretQueryArchetype(prompt)),
  ).size;

  const losingHasComparison = lose.some((label) => /compar|proveedor|precio/i.test(label));
  const insightHighlight = losingHasComparison ? 'comparando proveedores' : 'decidiendo entre opciones';

  return {
    totalQueries: metrics.totalPrompts,
    queryTypeCount,
    leadPromptCount: promptBuckets.lead,
    competePromptCount: promptBuckets.compete,
    losePromptCount: promptBuckets.lose,
    lead,
    compete,
    lose,
    funnel: {
      mentionCount: metrics.mentionCount,
      mentionRate: metrics.mentionRate,
      top3Count: metrics.top3Count,
      top3Rate: metrics.top3Rate,
      top1Count: metrics.top1Count,
      top1Rate: metrics.top1Rate,
      convMentionToTop3: metrics.convMentionToTop3,
      convTop3ToFirst: metrics.convTop3ToFirst,
    },
    insightBody:
      promptBuckets.lose >= promptBuckets.lead && promptBuckets.lose >= promptBuckets.compete
        ? 'La mayoría de las oportunidades que encontramos están en consultas donde el usuario todavía está'
        : 'Todavía hay oportunidades concretas en consultas clave de tu industria mientras el usuario está',
    insightHighlight,
    leaderName,
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
