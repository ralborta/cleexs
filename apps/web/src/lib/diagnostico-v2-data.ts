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
  insightFooter: string;
  leaderName: string;
};

export type DiagnosticoV2ExecutiveNarrative = {
  headline: string;
  openingLine: string;
  strengthLine: string;
  weaknessLine: string;
  competitorLine: string;
  findingsIntro: string;
  evidenceLabel: string;
  primaryActionLead: string;
};

export type DiagnosticoV2ViewModel = {
  brandName: string;
  domain: string;
  score: number;
  verdict: DiagnosticoV2Verdict;
  verdictLabel: string;
  verdictDetail: string;
  executiveNarrative: DiagnosticoV2ExecutiveNarrative;
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
  deliverables: Array<{ value: number; label: string; shortLabel: string }>;
  deliverablesIntro: string;
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

  const insight = buildQueryInsightCopy({
    promptBuckets,
    lead,
    compete,
    lose,
    leaderName,
    brandName: runResult.brandName,
    totalQueries: metrics.totalPrompts,
  });

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
    insightBody: insight.insightBody,
    insightHighlight: insight.insightHighlight,
    insightFooter: insight.insightFooter,
    leaderName,
  };
}

function buildQueryInsightCopy(input: {
  promptBuckets: Record<DiagnosticoV2QueryBucket, number>;
  lead: string[];
  compete: string[];
  lose: string[];
  leaderName: string;
  brandName: string;
  totalQueries: number;
}): { insightBody: string; insightHighlight: string; insightFooter: string } {
  const total = Math.max(input.totalQueries, 1);
  const topLose = input.lose[0];
  const topLead = input.lead[0];
  const topCompete = input.compete[0];
  const leader = input.leaderName.trim() || 'el competidor líder';

  if (input.promptBuckets.lead >= input.promptBuckets.lose && input.promptBuckets.lead >= input.promptBuckets.compete) {
    const highlight = topLead ? topLead.toLowerCase() : 'consultas de interés temprano';
    return {
      insightBody: `En ${input.promptBuckets.lead} de ${total} consultas ${input.brandName} ya compite bien, sobre todo en`,
      insightHighlight: highlight,
      insightFooter: topLose
        ? `El hueco está en ${topLose.toLowerCase()}, donde hoy suma más ${leader}.`
        : `El riesgo es ceder posición a ${leader} en comparación directa.`,
    };
  }

  if (input.promptBuckets.lose >= input.promptBuckets.compete) {
    const highlight =
      topLose && /compar|proveedor/i.test(topLose)
        ? 'comparando proveedores'
        : topLose
          ? topLose.toLowerCase()
          : 'decidiendo entre opciones';
    return {
      insightBody:
        input.promptBuckets.lose >= input.promptBuckets.lead
          ? `La mayoría de las oportunidades están en consultas donde el usuario todavía está`
          : `Perdés visibilidad en ${input.promptBuckets.lose} de ${total} consultas mientras el usuario está`,
      insightHighlight: highlight,
      insightFooter: `${leader} concentra más menciones en ese tipo de consultas hoy.`,
    };
  }

  const highlight = topCompete ? topCompete.toLowerCase() : 'consultas competitivas';
  return {
    insightBody: `En ${input.promptBuckets.compete} de ${total} consultas aparecés, pero no cerrás la recomendación en`,
    insightHighlight: highlight,
    insightFooter: `${leader} sigue llevándose la primera mención en esos casos.`,
  };
}

export function buildCompetitorLeaderInsightCopy(input: {
  brandName: string;
  brandShare: number;
  brandRank: number;
  leaderName: string;
  leaderShare: number;
}): { title: string; body: string; footer: string } {
  const leader = input.leaderName.trim() || 'Competidor líder';
  const gap = Math.max(0, input.leaderShare - input.brandShare);

  if (input.brandRank <= 1 && input.brandShare >= input.leaderShare - 0.5) {
    return {
      title: input.brandRank === 1 ? 'Vas liderando en menciones' : 'Empatás con el líder',
      body:
        input.brandRank === 1
          ? `Tu marca concentra ${input.brandShare.toFixed(1)}% de las menciones analizadas. El foco es sostenerlo en comparación y decisión.`
          : `Tu marca y ${leader} están prácticamente empatados. Una página de comparación puede inclinarte a tu favor.`,
      footer: `${input.brandName} · ${input.brandShare.toFixed(1)}% hoy.`,
    };
  }

  if (gap <= 5) {
    return {
      title: 'Estás muy cerca del líder',
      body: `Te separan solo ${gap.toFixed(1)} puntos (${input.brandShare.toFixed(1)}% vs ${input.leaderShare.toFixed(1)}%). Con las acciones correctas podés quedarte con el primer lugar.`,
      footer: `${leader} lidera hoy con ${input.leaderShare.toFixed(1)}%.`,
    };
  }

  if (gap <= 15) {
    return {
      title: 'Hay margen para alcanzar al líder',
      body: `${leader} te saca ${gap.toFixed(1)} pp (${input.leaderShare.toFixed(1)}% vs tu ${input.brandShare.toFixed(1)}%). Todavía es una brecha cerrable con contenido comparativo y autoridad.`,
      footer: `Vas ${input.brandRank}º en menciones en este análisis.`,
    };
  }

  return {
    title: 'El líder te saca ventaja clara',
    body: `${leader} concentra ${input.leaderShare.toFixed(1)}% frente a tu ${input.brandShare.toFixed(1)}%. Hay que atacar consultas de comparación y decisión con páginas concretas.`,
    footer: `Brecha actual: ${gap.toFixed(1)} puntos porcentuales.`,
  };
}

const ENGINE_LABEL: Record<EngineCardKey, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

function buildPresenceFinding(score: number, brandShare: number, mentionRate: number): DiagnosticoV2Finding {
  if (brandShare >= 45 || (brandShare >= 25 && score >= 60)) {
    return {
      tone: 'success',
      title: 'Tu marca ya aparece con fuerza',
      body: `ChatGPT te menciona en el ${brandShare.toFixed(1)}% de las respuestas relevantes (${Math.round(mentionRate)}% de las consultas analizadas).`,
    };
  }
  if (brandShare > 0 || score >= 35) {
    return {
      tone: 'success',
      title: 'Tu marca ya aparece, pero no en todas las consultas',
      body:
        brandShare > 0
          ? `ChatGPT te menciona en el ${brandShare.toFixed(1)}% de las respuestas relevantes. Todavía hay huecos en intenciones clave.`
          : `Tu Cleexs Score es ${score}, pero aparecés en pocas consultas concretas (${Math.round(mentionRate)}% de menciones).`,
    };
  }
  return {
    tone: 'critical',
    title: 'Hoy casi no aparecés en ChatGPT',
    body: `En las consultas que simulamos, tu marca casi no figura (${brandShare.toFixed(1)}% de menciones). Hay mucho terreno por ganar.`,
  };
}

function buildQueryWeaknessFinding(query: DiagnosticoV2QueryDiscovery): DiagnosticoV2Finding {
  const total = Math.max(query.totalQueries, 1);
  const loseShare = query.losePromptCount / total;
  const competeShare = query.competePromptCount / total;
  const topLose = query.lose[0];
  const topCompete = query.compete[0];

  if (query.leadPromptCount >= query.losePromptCount && query.leadPromptCount >= query.competePromptCount) {
    const leadLabel = query.lead[0] || 'consultas de interés';
    return {
      tone: 'success',
      title: 'Vas bien en consultas de interés temprano',
      body: `En ${query.leadPromptCount} de ${total} consultas analizadas liderás o competís bien (${leadLabel.toLowerCase()}). El foco ahora es sostenerlo al comparar opciones.`,
    };
  }

  if (loseShare >= 0.34 && topLose) {
    const comparison = /compar|proveedor|precio|decisi/i.test(topLose);
    return {
      tone: 'warning',
      title: comparison
        ? 'Falta contenido para quienes comparan opciones'
        : `Debilidad en ${topLose.toLowerCase()}`,
      body: `Perdés en ${query.losePromptCount} de ${total} consultas, sobre todo cuando el usuario está ${query.insightHighlight}.`,
    };
  }

  if (competeShare >= 0.34 && topCompete) {
    return {
      tone: 'warning',
      title: `Competís, pero no ganás en ${topCompete.toLowerCase()}`,
      body: `En ${query.competePromptCount} de ${total} consultas aparecés junto a ${query.leaderName}, pero no terminás de imponerte.`,
    };
  }

  if (query.funnel.top1Rate < 25 && query.funnel.mentionRate > 0) {
    return {
      tone: 'warning',
      title: 'Te mencionan, pero casi nunca quedás primero',
      body: `Solo en el ${Math.round(query.funnel.top1Rate)}% de las consultas sos la recomendación #1, aunque aparecés en el ${Math.round(query.funnel.mentionRate)}%.`,
    };
  }

  return {
    tone: 'warning',
    title: 'Hay consultas clave sin cubrir',
    body: `Detectamos ${query.queryTypeCount} tipos de consulta distintos; en ${query.losePromptCount} de ${total} todavía no ganás visibilidad suficiente.`,
  };
}

function buildGapFinding(input: {
  score: number;
  brandShare: number;
  leaderName: string;
  leaderShare: number;
  engines: Record<EngineCardKey, EngineCardState>;
}): DiagnosticoV2Finding {
  const extraEngines: EngineCardKey[] = ['gemini', 'claude', 'perplexity'];
  const measured = extraEngines
    .map((key) => ({ key, state: input.engines[key] }))
    .filter(({ state }) => state.status === 'completed' && state.score != null)
    .map(({ key, state }) => ({ key, score: scoreToPct(state.score) }))
    .sort((a, b) => a.score - b.score);

  if (measured.length > 0) {
    const weakest = measured[0];
    const label = ENGINE_LABEL[weakest.key];
    if (weakest.score >= 55) {
      return {
        tone: 'success',
        title: `${label} también te posiciona bien`,
        body: `Tu Cleexs Score en ${label} es ${weakest.score}. Seguí reforzando contenido para mantener esa ventaja.`,
      };
    }
    if (weakest.score >= 30) {
      return {
        tone: 'warning',
        title: `${label} te posiciona a medias`,
        body: `Tu presencia en ${label} es ${weakest.score}%. Hay margen claro para ganar visibilidad sin mucho esfuerzo extra.`,
      };
    }
    return {
      tone: 'critical',
      title: `${label} casi no te recomienda`,
      body: `Tu presencia en ${label} es ${weakest.score}%. Es una oportunidad rápida si reforzás las mismas páginas que ya mejoraron ChatGPT.`,
    };
  }

  const gap = input.leaderShare - input.brandShare;
  if (gap >= 12 && input.leaderName) {
    return {
      tone: 'critical',
      title: `${input.leaderName} te supera hoy en ChatGPT`,
      body: `${input.leaderName} concentra ${input.leaderShare.toFixed(1)}% de menciones vs tu ${input.brandShare.toFixed(1)}%. Cerrar esa brecha es la palanca más directa.`,
    };
  }

  const allExtraLocked = extraEngines.every((key) => input.engines[key].status === 'locked');
  if (allExtraLocked) {
    return {
      tone: 'warning',
      title: 'Falta medir Gemini, Claude y Perplexity',
      body: 'Este informe gratuito analiza ChatGPT. Los otros motores pueden mostrar oportunidades distintas — no asumimos 0% hasta medirlos.',
    };
  }

  if (input.score < 40) {
    return {
      tone: 'critical',
      title: 'Tu visibilidad en IA todavía es baja',
      body: `Cleexs Score ${input.score}: ChatGPT rara vez te elige frente a alternativas en tu rubro.`,
    };
  }

  return {
    tone: 'warning',
    title: 'Todavía hay motores sin consolidar',
    body: 'Algunos motores no terminaron de generarse o no tienen corrida completa. Conviene completar el análisis multi-motor.',
  };
}

function buildFindings(input: {
  score: number;
  brandShare: number;
  leaderName: string;
  leaderShare: number;
  queryDiscovery: DiagnosticoV2QueryDiscovery;
  engines: Record<EngineCardKey, EngineCardState>;
}): DiagnosticoV2Finding[] {
  return [
    buildPresenceFinding(input.score, input.brandShare, input.queryDiscovery.funnel.mentionRate),
    buildQueryWeaknessFinding(input.queryDiscovery),
    buildGapFinding(input),
  ];
}

function shortenFindingLine(finding: DiagnosticoV2Finding): string {
  const bodyLead = finding.body.split(/[.!]/)[0]?.trim();
  if (bodyLead && bodyLead.length <= 110) {
    return bodyLead.endsWith('.') ? bodyLead : `${bodyLead}.`;
  }
  return finding.title.endsWith('.') ? finding.title : `${finding.title}.`;
}

function buildExecutiveNarrative(input: {
  brandName: string;
  score: number;
  verdict: DiagnosticoV2Verdict;
  brandShare: number;
  leaderName: string;
  leaderShare: number;
  brandRank: number;
  queryDiscovery: DiagnosticoV2QueryDiscovery;
  findings: DiagnosticoV2Finding[];
}): DiagnosticoV2ExecutiveNarrative {
  const leader = input.leaderName.trim() || 'tu competidor líder';
  const totalQueries = Math.max(input.queryDiscovery.totalQueries, 1);
  const strengthFinding =
    input.findings.find((f) => f.tone === 'success') ?? input.findings[0];
  const weaknessFinding =
    input.findings.find((f) => f.tone !== 'success') ?? input.findings[1] ?? input.findings[0];

  let headline: string;
  if (input.verdict === 'yes' && input.brandShare >= 25) {
    headline = `${input.brandName} ya tiene buena presencia en ChatGPT.`;
  } else if (input.verdict === 'no' || input.score < 35) {
    headline = `Hoy estás perdiendo clientes que ChatGPT les envía a ${leader}.`;
  } else {
    headline = `${input.brandName} aparece a veces, pero pierde cuando el cliente compara opciones.`;
  }

  let openingLine: string;
  if (input.queryDiscovery.losePromptCount > input.queryDiscovery.leadPromptCount) {
    openingLine = `Cuando un cliente pregunta por alternativas en tu rubro, ChatGPT recomienda más a ${leader} que a vos.`;
  } else if (input.brandRank === 1) {
    openingLine = `Liderás en menciones, pero todavía hay consultas clave donde no cerrás la recomendación.`;
  } else {
    openingLine = `Analizamos ${totalQueries} consultas reales de tus potenciales clientes y encontramos una debilidad clara frente a ${leader}.`;
  }

  const strengthLine =
    strengthFinding?.tone === 'success'
      ? shortenFindingLine(strengthFinding)
      : `Aparecés en el ${Math.round(input.queryDiscovery.funnel.mentionRate)}% de las consultas analizadas.`;

  const weaknessLine = weaknessFinding ? shortenFindingLine(weaknessFinding) : openingLine;

  const competitorLine =
    input.brandRank > 1
      ? `Eso explica por qué hoy ChatGPT recomienda más a ${leader} (${input.leaderShare.toFixed(0)}% de menciones) que a ${input.brandName} (${input.brandShare.toFixed(0)}%).`
      : `El foco ahora es sostener el liderazgo en comparación y decisión de compra.`;

  return {
    headline,
    openingLine,
    strengthLine,
    weaknessLine,
    competitorLine,
    findingsIntro: `Analizamos ${totalQueries} consultas donde tus potenciales clientes eligen proveedor. Encontramos dos patrones:`,
    evidenceLabel: 'Cleexs Score · evidencia del análisis',
    primaryActionLead: 'Si solo implementaras una acción en los próximos 30 días, haríamos esta.',
  };
}

function buildPersonalizedDeliverables(input: {
  teaser: TeaserShape;
  competitors: DiagnosticoV2CompetitorRow[];
  queryDiscovery: DiagnosticoV2QueryDiscovery;
  brandName: string;
}): {
  deliverables: DiagnosticoV2ViewModel['deliverables'];
  deliverablesIntro: string;
  hiddenActionCount: number;
} {
  const opps = input.teaser.opportunities;
  const basePrompts = input.teaser.implementationPrompts?.length ?? 0;
  const queries = Math.max(input.queryDiscovery.totalQueries, opps.length, 1);

  const actionCount = opps.length;
  const promptCount = Math.max(basePrompts, opps.filter((o) => o.score < 70).length, actionCount > 0 ? 1 : 0);
  const pagesToCreate = Math.max(
    opps.filter((o) => o.score < 65 || /compar|consider/i.test(o.intention)).length,
    actionCount > 0 ? 1 : 0,
  );
  const compareCount = input.competitors.filter((c) => !c.isBrand && c.share > 0).length;
  const quickWins = Math.max(
    opps.filter((o) => o.score < 55 && o.effort === 'Bajo').length,
    opps.filter((o) => o.score < 50).length,
    Math.min(input.teaser.improveNow.length, 3),
    actionCount > 0 ? 1 : 0,
  );

  const deliverables: DiagnosticoV2ViewModel['deliverables'] = [
    {
      value: actionCount,
      label:
        actionCount === 1
          ? 'acción priorizada de tu análisis'
          : 'acciones priorizadas de tu análisis',
      shortLabel: actionCount === 1 ? 'ACCIÓN' : 'ACCIONES',
    },
    {
      value: promptCount,
      label:
        promptCount === 1
          ? 'prompt generado para tu marca'
          : 'prompts generados para tu marca',
      shortLabel: promptCount === 1 ? 'PROMPT' : 'PROMPTS',
    },
    {
      value: pagesToCreate,
      label:
        pagesToCreate === 1
          ? 'página sugerida según tus consultas'
          : 'páginas sugeridas según tus consultas',
      shortLabel: pagesToCreate === 1 ? 'PÁGINA' : 'PÁGINAS',
    },
    {
      value: compareCount,
      label:
        compareCount === 1
          ? 'comparativa donde un competidor te gana hoy'
          : 'comparativas donde tus competidores te ganan hoy',
      shortLabel: compareCount === 1 ? 'COMPARATIVA' : 'COMPARATIVAS',
    },
    {
      value: quickWins,
      label:
        quickWins === 1
          ? 'mejora rápida para esta semana'
          : 'mejoras rápidas para esta semana',
      shortLabel: quickWins === 1 ? 'MEJORA' : 'MEJORAS',
    },
    {
      value: 1,
      label: 'roadmap de implementación de 90 días',
      shortLabel: 'ROADMAP',
    },
  ];

  const deliverablesIntro =
    actionCount > 0
      ? `En ${queries} consultas analizadas para ${input.brandName}, el motor detectó ${actionCount} ${
          actionCount === 1 ? 'acción prioritaria' : 'acciones prioritarias'
        } y armó este plan de ejecución.`
      : `Analizamos ${queries} consultas para ${input.brandName}. El plan completo ordena las oportunidades por impacto.`;

  return {
    deliverables,
    deliverablesIntro,
    hiddenActionCount: actionCount,
  };
}

function competitorUrlMap(runResult: PublicDiagnosticRunResult) {
  return new Map(
    (runResult.competitorDetails ?? [])
      .filter((row) => row.name)
      .map((row) => [normalizeName(row.name), row.domain ?? null]),
  );
}

export function buildDiagnosticoV2ViewModel(
  diagnostic: PublicDiagnostic,
  options?: { unlockEngines?: boolean },
): DiagnosticoV2ViewModel | null {
  const runResult = diagnostic.runResult;
  if (!runResult) return null;

  const engines = buildEngineScoresFromDiagnostic({
    chatgptScore: runResult.cleexsScore,
    runResultGemini: diagnostic.runResultGemini,
    runResultPerplexity: diagnostic.runResultPerplexity,
    runResultClaude: diagnostic.runResultClaude,
    runGeminiId: diagnostic.runGeminiId,
    runPerplexityId: diagnostic.runPerplexityId,
    runClaudeId: diagnostic.runClaudeId,
    lockUnavailableEngines: !options?.unlockEngines,
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

  const queryDiscovery = buildQueryDiscovery(runResult, leader?.name || 'Competidor líder');
  const findings = buildFindings({
    score,
    brandShare,
    leaderName: leader?.name || 'Competidor líder',
    leaderShare,
    queryDiscovery,
    engines,
  });
  const executiveNarrative = buildExecutiveNarrative({
    brandName: runResult.brandName,
    score,
    verdict: verdict.verdict,
    brandShare,
    leaderName: leader?.name || 'Competidor líder',
    leaderShare,
    brandRank,
    queryDiscovery,
    findings,
  });

  const sortedOpps = [...teaser.opportunities].sort((a, b) => a.score - b.score);
  const primary = teaser.opportunities[0];
  const weakest = sortedOpps[0];
  const topCompetitor = competitors.find((c) => !c.isBrand)?.name;
  const primaryActionRaw = humanPrimaryAction(primary, topCompetitor);

  const { deliverables, deliverablesIntro, hiddenActionCount } = buildPersonalizedDeliverables({
    teaser,
    competitors,
    queryDiscovery,
    brandName: runResult.brandName,
  });

  return {
    brandName: runResult.brandName,
    domain: diagnostic.domain,
    score,
    verdict: verdict.verdict,
    verdictLabel: verdict.label,
    verdictDetail: verdict.detail,
    executiveNarrative,
    competitorCount: analyzedCompetitorCount,
    brandRank,
    leaderName: leader?.name || 'Competidor líder',
    leaderShare,
    brandShare,
    gapClosePct: gapClosePct || 37,
    engines,
    findings,
    competitors: competitors.slice(0, 8),
    queryDiscovery,
    primaryAction: {
      ...primaryActionRaw,
      impactStars: impactStars(primary?.impact ?? 'Alto'),
      effortStars: effortStars(primary?.effort ?? 'Bajo'),
      impactLabel: primary?.impact === 'Alto' ? 'Muy alto' : primary?.impact === 'Medio' ? 'Medio' : 'Moderado',
      effortLabel: primary?.effort === 'Bajo' ? 'Bajo' : primary?.effort === 'Medio' ? 'Medio' : 'Alto',
    },
    teaser,
    deliverables,
    deliverablesIntro,
    hiddenActionCount,
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
