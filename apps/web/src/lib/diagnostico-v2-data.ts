import type { PublicDiagnostic, PublicDiagnosticRunResult } from '@/lib/api';
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
  roadmapPreview: Array<{ week: string; task: string }>;
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

function buildFindings(
  score: number,
  brandShare: number,
  primary: TeaserShape['opportunities'][0] | undefined,
  weakest: TeaserShape['opportunities'][0] | undefined,
): DiagnosticoV2Finding[] {
  const appears = brandShare > 0 || score >= 40;
  return [
    {
      tone: 'success',
      title: 'Tu marca ya aparece',
      body: appears
        ? `En las consultas simuladas, tu marca aparece en el ${brandShare.toFixed(1)}% de las respuestas analizadas.`
        : 'Hay señales de presencia, pero todavía en pocas consultas relevantes.',
    },
    {
      tone: 'warning',
      title: 'Falta contenido para quienes están comparando opciones',
      body: weakest
        ? `La consulta «${weakest.intention}» tiene score ${weakest.score}/100. Ahí se pierden oportunidades de decisión.`
        : 'No hay páginas claras para intenciones de comparación y elección de proveedor.',
    },
    {
      tone: 'critical',
      title: 'Gemini todavía casi nunca te recomienda',
      body: 'En el diagnóstico gratuito solo medimos ChatGPT. Los otros motores se desbloquean con Plan Conquistar.',
    },
  ];
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
  const competitors = buildComparisonRows(runResult);
  const brandRow = competitors.find((c) => c.isBrand);
  const leader = competitors[0];
  const brandShare = brandRow?.share ?? 0;
  const leaderShare = leader?.share ?? 0;
  const brandRank = brandRow?.rank ?? competitors.length;
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
    competitorCount: Math.max((runResult.competitors || []).length, competitors.length - 1),
    brandRank,
    leaderName: leader?.name || 'Competidor líder',
    leaderShare,
    brandShare,
    gapClosePct: gapClosePct || 37,
    engines,
    findings: buildFindings(score, brandShare, primary, weakest),
    competitors: competitors.slice(0, 8),
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
    roadmapPreview: teaser.roadmap.slice(0, 3).map((phase, i) => ({
      week: `Semana ${i + 1}`,
      task: phase.theme,
    })),
  };
}
