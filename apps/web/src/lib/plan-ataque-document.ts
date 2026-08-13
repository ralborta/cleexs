import type { PublicDiagnostic, PublicDiagnosticSatelliteModule } from '@/lib/api';
import { buildEngineScoresFromDiagnostic } from '@/components/diagnostico/cleexs-engine-scores-panel';
import type { PlanConquistarTeaserData } from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import {
  buildLandingRoadmapTabs,
  buildPlanConquistarLandingContext,
  type PlanConquistarLandingContext,
  type RoadmapTab,
} from '@/lib/plan-conquistar-landing-context';
import { buildImmediateActionPlan, type ImmediateActionPhase } from '@/lib/plan-immediate-action';
import { buildPlanConquistarTeaserData } from '@/lib/plan-conquistar-preview';
import type { CrawlerAccessReport } from '@/lib/crawler-access';

export type PlanAtaqueSectionId =
  | 'panel'
  | 'esta-semana'
  | 'satelite'
  | 'crawlers'
  | 'kit'
  | 'comparacion'
  | 'portada'
  | 'indice'
  | 'prioridad'
  | 'competidores'
  | 'preguntas'
  | 'victorias'
  | 'contenido'
  | 'plan90'
  | 'tareas'
  | 'vision'
  | 'faq';

export type PlanAtaqueNavItem = {
  id: PlanAtaqueSectionId;
  label: string;
  group: 'gestionar' | 'documento' | 'portal';
};

export type PlanAtaqueDocument = {
  diagnosticId: string;
  runId: string | null;
  siteUrl: string;
  ctx: PlanConquistarLandingContext;
  teaser: PlanConquistarTeaserData | null;
  satelliteModule: PublicDiagnosticSatelliteModule | null;
  crawlerAccess: CrawlerAccessReport | null;
  immediatePlan: ImmediateActionPhase[];
  roadmap: RoadmapTab[];
  nav: PlanAtaqueNavItem[];
  taskList: string[];
  lostQuestions: Array<{
    title: string;
    scenario: string;
    action: string;
    score: number;
    priority: number;
    impact?: string;
    effort?: string;
  }>;
  suggestedContent: Array<{ title: string; detail: string; prompt?: string }>;
  improveNow: Array<{ label: string; score: number }>;
  defendNow: Array<{ label: string; score: number }>;
  authorityChannels: Array<{ name: string; goal: string }>;
  courseModules: string[];
  satelliteActions: Array<{
    priority: string;
    source: string;
    message: string;
    detail?: string;
    action?: string;
  }>;
};

function buildTeaserFromDiagnostic(diagnostic: PublicDiagnostic): PlanConquistarTeaserData | null {
  if (!diagnostic.runResult) return null;
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
  return buildPlanConquistarTeaserData(
    diagnostic.runResult,
    diagnostic.satelliteModule,
    `https://${diagnostic.domain.replace(/^www\./, '')}`,
    diagnostic.domainRating,
    enginesState
  );
}

/**
 * Documento completo del Plan de Ataque a partir del diagnóstico (sin IA nueva).
 */
export function buildPlanAtaqueDocument(diagnostic: PublicDiagnostic): PlanAtaqueDocument {
  const ctx = buildPlanConquistarLandingContext(diagnostic);
  const teaser = buildTeaserFromDiagnostic(diagnostic);
  const siteUrl = `https://${diagnostic.domain.replace(/^www\./, '')}`;
  const satelliteModule = diagnostic.satelliteModule ?? null;
  const crawlerAccess = teaser?.crawlerAccess ?? null;
  const satelliteActions = (satelliteModule?.actions ?? []).slice(0, 8);

  const opportunities = teaser?.opportunities ?? [];
  const primary = opportunities[0]
    ? {
        label: opportunities[0].title,
        score: opportunities[0].score,
        priority: opportunities[0].priority,
        intention: opportunities[0].intention,
        scenario: opportunities[0].scenario,
        action: opportunities[0].action,
      }
    : null;

  const improveNowForPlan = opportunities.slice(0, 5).map((o) => ({
    label: o.title,
    score: o.score,
    priority: o.priority,
    intention: o.intention,
    scenario: o.scenario,
    action: o.action,
  }));

  const topCompetitor = ctx.competitors[0]
    ? {
        name: ctx.competitors[0].name,
        appearances: Math.max(1, ctx.competitors.length),
        reasons: undefined as string[] | undefined,
      }
    : null;

  const immediatePlan = buildImmediateActionPlan({
    brandName: ctx.brandName,
    primaryOpportunity: primary,
    improveNow: improveNowForPlan,
    topCompetitor,
  });

  const roadmap = buildLandingRoadmapTabs(ctx);

  const lostQuestions = opportunities.slice(0, 12).map((o) => ({
    title: o.title,
    scenario: o.scenario || o.intention,
    action: o.action,
    score: o.score,
    priority: o.priority,
    impact: o.impact,
    effort: o.effort,
  }));

  const suggestedContent: Array<{ title: string; detail: string; prompt?: string }> = [];
  for (const p of teaser?.implementationPrompts?.slice(0, 6) ?? []) {
    suggestedContent.push({ title: p.title, detail: p.source, prompt: p.prompt });
  }
  for (const o of opportunities.slice(0, 6)) {
    if (suggestedContent.length >= 10) break;
    suggestedContent.push({
      title: `Pieza para: ${o.title}`,
      detail: o.action,
    });
  }
  if (!suggestedContent.length) {
    suggestedContent.push(
      {
        title: `Página de intención #1 para ${ctx.brandName}`,
        detail: 'Publicá una respuesta clara a la consulta donde hoy más perdés.',
      },
      {
        title: ctx.competitors[0]
          ? `Comparativa ${ctx.brandName} vs ${ctx.competitors[0].name}`
          : `Comparativa base de ${ctx.brandName}`,
        detail: 'Explicá cuándo conviene elegirte, con datos verificables.',
      },
      {
        title: 'FAQs accionables',
        detail: '3–5 preguntas reales de clientes con respuestas directas en el sitio.',
      }
    );
  }

  const improveNow = teaser?.improveNow ?? opportunities
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((o) => ({ label: o.title, score: o.score }));
  const defendNow = teaser?.defendNow ?? opportunities
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((o) => ({ label: o.title, score: o.score }));
  const authorityChannels = teaser?.externalAuthority ?? [];
  const courseModules = teaser?.courseModules ?? [];

  const taskList = [
    ...immediatePlan.flatMap((phase) => phase.tasks.map((t) => `${phase.range}: ${t}`)),
    ...roadmap.flatMap((tab) => tab.items.map((t) => `${tab.label}: ${t}`)),
    ...lostQuestions.slice(0, 6).map((q) => `Oportunidad: ${q.action}`),
    ...authorityChannels.slice(0, 4).map((c) => `Autoridad: ${c.name} — ${c.goal}`),
    ...satelliteActions.slice(0, 4).map((a) => `Técnico: ${a.action || a.message}`),
  ];

  const nav: PlanAtaqueNavItem[] = [
    { id: 'panel', label: 'Panel de gestión', group: 'gestionar' },
    { id: 'esta-semana', label: 'Esta semana', group: 'gestionar' },
    { id: 'satelite', label: 'Análisis AEO', group: 'gestionar' },
    { id: 'crawlers', label: 'Crawlers & robots', group: 'gestionar' },
    { id: 'kit', label: 'Kit IA (prompts)', group: 'gestionar' },
    { id: 'comparacion', label: 'Comparación', group: 'portal' },
    {
      id: 'competidores',
      label: ctx.competitors.length ? `Competidores (${ctx.competitors.length})` : 'Competidores',
      group: 'portal',
    },
    { id: 'kit', label: 'Prompts', group: 'portal' },
    { id: 'portada', label: 'Portada del plan', group: 'documento' },
    { id: 'indice', label: 'Índice', group: 'documento' },
    { id: 'prioridad', label: 'Prioridad #1', group: 'documento' },
    { id: 'preguntas', label: 'Preguntas perdidas', group: 'documento' },
    { id: 'victorias', label: 'Victorias rápidas', group: 'documento' },
    { id: 'contenido', label: 'Contenido sugerido', group: 'documento' },
    { id: 'plan90', label: 'Plan 90 días', group: 'documento' },
    { id: 'tareas', label: 'Lista de tareas', group: 'documento' },
    {
      id: 'vision',
      label: ctx.engines[0] ? `Visión IA · ${ctx.engines[0]}` : 'Visión IA',
      group: 'documento',
    },
    { id: 'faq', label: 'Preguntas frecuentes', group: 'documento' },
  ];

  return {
    diagnosticId: diagnostic.id,
    runId: diagnostic.runId?.trim() || null,
    siteUrl,
    ctx,
    teaser,
    satelliteModule,
    crawlerAccess,
    immediatePlan,
    roadmap,
    nav,
    taskList,
    lostQuestions,
    suggestedContent,
    improveNow,
    defendNow,
    authorityChannels,
    courseModules,
    satelliteActions,
  };
}
