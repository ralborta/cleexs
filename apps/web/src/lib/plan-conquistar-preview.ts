import type {
  DomainRatingSnapshot,
  PublicDiagnosticRunResult,
  PublicDiagnosticSatelliteModule,
  PublicDiagnosticTrendPoint,
} from '@/lib/api';
import type { PlanConquistarTeaserData } from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import { buildCrawlerAccessReport } from '@/lib/crawler-access';
import { buildImmediateActionPlan } from '@/lib/plan-immediate-action';

/**
 * Construye los datos del reporte Plan Conquistar (versión bloqueada/upsell) a partir
 * del runResult real del diagnóstico gratuito. Replica la lógica del reporte del admin
 * pero sobre el shape público (PublicDiagnosticRunResult). NO toca el reporte de admin.
 */

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function isBrandEntry(entryName: string, brandName: string, aliases: string[]) {
  const entry = normalizeName(entryName);
  return entry === normalizeName(brandName) || aliases.some((a) => normalizeName(a) === entry);
}

function extractIntention(promptText?: string | null) {
  const match = (promptText || '').match(/Intención:\s*([^\(\n]+)\s*\((\d+)%\)/i);
  if (!match) return null;
  return { label: match[1].trim(), weight: Number(match[2]) };
}

function extractScenario(promptText?: string | null) {
  if (!promptText) return '';
  const lines = promptText.split('\n').map((s) => s.trim()).filter(Boolean);
  const ctx = lines[1] || '';
  return ctx.length > 160 ? `${ctx.slice(0, 157)}…` : ctx;
}

function scoreToPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n <= 1 ? n * 100 : n);
}

function impactForScore(score: number): 'Alto' | 'Medio' | 'Defensivo' {
  if (score < 35) return 'Alto';
  if (score < 65) return 'Medio';
  return 'Defensivo';
}

function effortForScore(score: number, hasCompetitor: boolean): 'Bajo' | 'Medio' | 'Alto' {
  if (score < 35 && hasCompetitor) return 'Medio';
  return 'Bajo';
}

function priorityForScore(score: number, impact: string, effort: string) {
  const gain = Math.max(0, 100 - score);
  const impactBonus = impact === 'Alto' ? 12 : impact === 'Medio' ? 6 : 0;
  const effortBonus = effort === 'Bajo' ? 8 : effort === 'Medio' ? 4 : 0;
  return Math.min(100, Math.round(gain * 0.8 + impactBonus + effortBonus));
}

const EXTERNAL_AUTHORITY_CHANNELS = [
  { name: 'Crunchbase / perfiles corporativos', goal: 'Unificar descripción, categoría, sitio y propuesta de valor en perfiles externos.' },
  { name: 'Clutch / directorios del sector', goal: 'Conseguir pruebas sociales y categorías claras donde los modelos suelen buscar validación.' },
  { name: 'Reddit / comunidades relevantes', goal: 'Aparecer en conversaciones donde usuarios preguntan por alternativas y recomendaciones.' },
  { name: 'YouTube / demos y comparativas', goal: 'Publicar respuestas concretas que puedan ser resumidas por motores de IA.' },
];

const COURSE_MODULES = [
  'Cómo funcionan las respuestas de ChatGPT y otros LLMs',
  'Qué señales hacen que una marca sea recomendada',
  'Cómo leer tu Cleexs Score sin perderte en métricas',
  'Cómo convertir intenciones débiles en páginas útiles',
  'Cómo construir comparativas que los modelos entienden',
  'Cómo usar FAQs y schema para responder mejor',
];

function buildImplementationPrompts(
  brandName: string,
  opportunities: Array<{
    title: string;
    intention: string;
    score: number;
    priority: number;
    scenario?: string;
    action: string;
  }>,
  topCompetitor?: { name: string; appearances: number } | null,
) {
  const primary = opportunities[0];
  const weekly = opportunities.slice(0, 3);
  return [
    {
      title: 'Convertir la prioridad #1 en página',
      source: primary
        ? `Basado en: ${primary.title} · prioridad ${primary.priority} · score actual ${primary.score}`
        : 'Basado en la oportunidad prioritaria del reporte',
      prompt: primary
        ? `Actuá como consultor de AI Visibility para ${brandName}. Necesito convertir esta oportunidad prioritaria en una página publicable: "${primary.title}".${primary.scenario ? ` Escenario del usuario: "${primary.scenario}".` : ''} Intención: ${primary.intention}. Score actual: ${primary.score}/100. Acción recomendada: ${primary.action}. Proponé estructura de página, títulos H2/H3, FAQs, evidencias a incluir y un checklist de publicación.`
        : `Actuá como consultor de AI Visibility para ${brandName}. Revisá la oportunidad prioritaria del reporte y convertíla en una página publicable con estructura, FAQs, evidencias y checklist.`,
    },
    {
      title: 'Cerrar brecha contra competidor',
      source: topCompetitor
        ? `Basado en: ${topCompetitor.name} · ${topCompetitor.appearances} apariciones`
        : 'Basado en el competidor principal detectado',
      prompt: topCompetitor
        ? `Actuá como estratega de AI Visibility. Compará ${brandName} contra ${topCompetitor.name} usando un tono honesto y verificable. Explicá en qué casos conviene elegir ${brandName}, qué prueba social o datos faltan para sostener esa comparación y qué contenido deberíamos crear para que ChatGPT, Claude, Gemini y Perplexity entiendan mejor la diferencia.`
        : `Actuá como estratega de AI Visibility. Si el reporte detecta competidores relevantes, armá una comparativa honesta para ${brandName}: cuándo elegir la marca, qué pruebas faltan y qué contenido crear para mejorar recomendaciones en motores de IA.`,
    },
    {
      title: 'Tareas concretas de esta semana',
      source:
        weekly.length > 0
          ? `Basado en las prioridades: ${weekly.map((o) => `#${o.priority}`).join(', ')}`
          : 'Basado en las primeras prioridades del reporte',
      prompt:
        weekly.length > 0
          ? `Convertí estas prioridades de ${brandName} en un plan de 7 días con tareas claras, responsable sugerido y entregable final: ${weekly
              .map((o, idx) => `${idx + 1}) ${o.title} (score ${o.score}, prioridad ${o.priority}): ${o.action}`)
              .join(' | ')}. Evitá teoría: quiero acciones publicables o verificables.`
          : `Convertí las primeras prioridades del reporte de ${brandName} en un plan de 7 días con tareas claras, responsable sugerido y entregable final. Evitá teoría: quiero acciones publicables o verificables.`,
    },
  ];
}

export function buildPlanConquistarTeaserData(
  runResult: PublicDiagnosticRunResult,
  satelliteModule?: PublicDiagnosticSatelliteModule | null,
  siteUrl?: string | null,
  domainRating?: DomainRatingSnapshot | null,
): PlanConquistarTeaserData {
  const brandName = runResult.brandName;
  const aliases = runResult.brandAliases || [];
  const prompts = runResult.promptResults || [];

  const cleexsScore = scoreToPct(runResult.cleexsScore);

  const competitors = new Map<string, { name: string; appearances: number }>();
  for (const prompt of prompts) {
    for (const entry of prompt.top3Json || []) {
      if (isBrandEntry(entry.name, brandName, aliases)) continue;
      if (`${entry.type}`.toLowerCase() !== 'competitor') continue;
      const key = normalizeName(entry.name);
      const current = competitors.get(key) || { name: entry.name, appearances: 0 };
      current.appearances += 1;
      competitors.set(key, current);
    }
  }

  const opportunities = prompts
    .map((prompt) => {
      const intention = extractIntention(prompt.promptText);
      const score = scoreToPct(prompt.score);
      const firstCompetitor = (prompt.top3Json || []).find(
        (entry) => !isBrandEntry(entry.name, brandName, aliases)
      );
      const hasCompetitor = Boolean(firstCompetitor);
      const impact = impactForScore(score);
      const effort = effortForScore(score, hasCompetitor);
      const intentionLabel = intention?.label || prompt.category || 'Consulta de visibilidad';
      const title = intention
        ? `${intention.label} (${intention.weight}%) · ${prompt.category || 'Consulta'}`
        : prompt.category || 'Consulta de visibilidad';
      return {
        title,
        intention: intentionLabel,
        score,
        priority: priorityForScore(score, impact, effort),
        impact,
        effort,
        scenario: extractScenario(prompt.promptText),
        action:
          score >= 70
            ? `Sostené el liderazgo en «${intentionLabel}»: convertilo en contenido público, casos y FAQs para no perder la posición.`
            : firstCompetitor
              ? `Creá una pieza que responda mejor esta consulta y contraste de forma honesta contra ${firstCompetitor.name}.`
              : 'Creá contenido claro para esta consulta y reforzá señales de autoridad en el sitio.',
      };
    })
    .sort((a, b) => b.priority - a.priority);

  const improveNow = [...opportunities]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((o) => ({ label: o.title, score: o.score }));
  const defendNow = [...opportunities]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((o) => ({ label: o.title, score: o.score }));

  const topCompetitor = Array.from(competitors.values()).sort((a, b) => b.appearances - a.appearances)[0];
  const primary = opportunities[0];
  const improveNowForPlan = [...opportunities].sort((a, b) => a.score - b.score).slice(0, 5);

  const roadmap = buildImmediateActionPlan({
    brandName,
    primaryOpportunity: primary
      ? {
          label: primary.title,
          score: primary.score,
          priority: primary.priority,
          intention: primary.intention,
          scenario: primary.scenario,
          action: primary.action,
        }
      : null,
    improveNow: improveNowForPlan.map((o) => ({
      label: o.title,
      score: o.score,
      priority: o.priority,
      intention: o.intention,
      scenario: o.scenario,
      action: o.action,
    })),
    topCompetitor: topCompetitor
      ? { name: topCompetitor.name, appearances: topCompetitor.appearances }
      : null,
    formatOpportunity: (item) => `${item.label} (score ${item.score})`,
  });

  return {
    brandName,
    cleexsScore,
    totalOpportunities: opportunities.length,
    engineScores: {
      chatgpt: cleexsScore,
      gemini: null,
      claude: null,
      perplexity: null,
    },
    opportunities,
    improveNow,
    defendNow,
    externalAuthority: EXTERNAL_AUTHORITY_CHANNELS,
    roadmap,
    courseModules: COURSE_MODULES,
    crawlerAccess: buildCrawlerAccessReport(satelliteModule, siteUrl),
    domainRating: domainRating ?? null,
    siteUrl: siteUrl ?? null,
    implementationPrompts: buildImplementationPrompts(brandName, opportunities, topCompetitor),
  };
}

export type PlanConquistarUpsellPreviewBundle = {
  data: PlanConquistarTeaserData;
  meta: PlanConquistarTeaserPreviewMeta;
  runResult: PublicDiagnosticRunResult;
  trendData: PublicDiagnosticTrendPoint[];
  satelliteModule: PublicDiagnosticSatelliteModule | null;
  siteUrl: string;
};

/** Datos de ejemplo para vista previa en admin (sin diagnóstico real). */
export function buildPlanConquistarTeaserDemoData(): PlanConquistarTeaserData {
  const brandName = 'Mailberry';
  const opportunities = [
    {
      title: 'Consideración (30%) · Comparativo',
      intention: 'Consideración',
      score: 12,
      priority: 88,
      impact: 'Alto' as const,
      effort: 'Bajo' as const,
      scenario: 'Estoy evaluando opciones de email marketing para mi pyme.',
      action: 'Creá una comparativa honesta contra el competidor que más aparece en ChatGPT.',
    },
    {
      title: 'Precio (30%) · Consulta directa',
      intention: 'Precio',
      score: 34,
      priority: 72,
      impact: 'Medio' as const,
      effort: 'Bajo' as const,
      scenario: '¿Cuánto cuesta una plataforma de email marketing en Argentina?',
      action: 'Publicá precios claros y FAQs sobre planes en el sitio.',
    },
    {
      title: 'Calidad (40%) · Recomendación',
      intention: 'Calidad',
      score: 58,
      priority: 55,
      impact: 'Medio' as const,
      effort: 'Bajo' as const,
      scenario: '¿Qué herramienta de email marketing recomiendan para ecommerce?',
      action: 'Sumá casos de uso y testimonios verificables por rubro.',
    },
  ];

  return {
    brandName,
    cleexsScore: 47,
    totalOpportunities: 18,
    engineScores: { chatgpt: 47, gemini: null, claude: null, perplexity: null },
    opportunities,
    improveNow: opportunities.map((o) => ({ label: o.title, score: o.score })),
    defendNow: [{ label: 'Precio (30%) · Consulta directa', score: 91 }],
    externalAuthority: EXTERNAL_AUTHORITY_CHANNELS,
    roadmap: buildImmediateActionPlan({
      brandName,
      primaryOpportunity: {
        label: opportunities[0].title,
        score: opportunities[0].score,
        priority: opportunities[0].priority,
        intention: opportunities[0].intention,
        scenario: opportunities[0].scenario,
        action: opportunities[0].action,
      },
      improveNow: opportunities.map((o) => ({
        label: o.title,
        score: o.score,
        priority: o.priority,
        intention: o.intention,
        scenario: o.scenario,
        action: o.action,
      })),
      topCompetitor: { name: 'Doppler', appearances: 9 },
    }),
    courseModules: COURSE_MODULES,
    crawlerAccess: {
      robotsFound: true,
      robotsUrl: 'https://mailberry.com/robots.txt',
      blockedCount: 1,
      recommendedRobots: 'User-agent: GPTBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /',
      verificationChecklist: [
        'Revisá GPTBot y OAI-SearchBot en logs del servidor.',
        'Validá robots.txt sin bloqueos accidentales.',
      ],
      teaserBots: [
        { name: 'GPTBot', engine: 'ChatGPT', allowed: true },
        { name: 'OAI-SearchBot', engine: 'OpenAI Search', allowed: false },
        { name: 'PerplexityBot', engine: 'Perplexity', allowed: true },
      ],
      bots: [
        { name: 'GPTBot', engine: 'ChatGPT', allowed: true },
        { name: 'OAI-SearchBot', engine: 'OpenAI Search', allowed: false },
        { name: 'PerplexityBot', engine: 'Perplexity', allowed: true },
      ],
    },
  };
}

type Top3Entry = { position: number; name: string; type: string; reason?: string };

export type PlanConquistarAdminRunDetail = {
  id: string;
  brand: {
    id?: string;
    name: string;
    domain?: string | null;
    competitors?: Array<{ id: string; name: string; domain?: string | null }>;
    aliases?: Array<{ id: string; alias: string }>;
  };
  promptResults: Array<{
    score: number;
    responseText: string;
    top3Json: unknown;
    prompt?: {
      promptText?: string;
      category?: { name?: string } | null;
    };
  }>;
  priaReports?: Array<{ priaTotal: number }>;
};

type PlanConquistarAdminContext = {
  ok: boolean;
  diagnostic: { id: string; domain: string; brandName: string } | null;
  satelliteModule: PublicDiagnosticSatelliteModule | null;
  trendData?: PublicDiagnosticTrendPoint[];
  domainRating?: DomainRatingSnapshot | null;
};

function normalizePromptScore(score: number) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n : n / 100;
}

function top3Entries(value: unknown): Top3Entry[] {
  return Array.isArray(value) ? (value as Top3Entry[]) : [];
}

export function adminRunToPublicRunResult(run: PlanConquistarAdminRunDetail): PublicDiagnosticRunResult {
  const prompts = run.promptResults || [];
  const cleexsScore =
    run.priaReports?.[0]?.priaTotal ??
    (prompts.length ? prompts.reduce((sum, p) => sum + scoreToPct(p.score), 0) / prompts.length : 0);

  return {
    brandId: run.brand.id,
    brandName: run.brand.name,
    cleexsScore: Math.round(cleexsScore),
    competitors: run.brand.competitors?.map((c) => c.name) ?? [],
    competitorDetails: run.brand.competitors?.map((c) => ({ name: c.name, domain: c.domain })) ?? [],
    brandAliases: run.brand.aliases?.map((a) => a.alias) ?? [],
    promptResults: prompts.map((pr) => ({
      category: pr.prompt?.category?.name ?? 'General',
      score: normalizePromptScore(pr.score),
      promptText: pr.prompt?.promptText ?? '',
      responseText: pr.responseText ?? '',
      top3Json: top3Entries(pr.top3Json),
    })),
  };
}

export type PlanConquistarTeaserPreviewMeta = {
  brandName: string;
  domain: string | null;
  diagnosticId: string | null;
  runId: string;
};

export async function loadPlanConquistarUpsellPreviewBundle(runId: string): Promise<PlanConquistarUpsellPreviewBundle> {
  const [runRes, contextRes] = await Promise.all([
    fetch(`/api/admin-ui/plan-conquistar/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' }),
    fetch(`/api/admin-ui/plan-conquistar/runs/${encodeURIComponent(runId)}/context`, { cache: 'no-store' }),
  ]);
  if (!runRes.ok) {
    const body = await runRes.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Error ${runRes.status}`);
  }
  const run = (await runRes.json()) as PlanConquistarAdminRunDetail;
  const context = contextRes.ok ? ((await contextRes.json()) as PlanConquistarAdminContext) : null;
  const domain = context?.diagnostic?.domain ?? run.brand.domain ?? null;
  const siteUrl =
    context?.satelliteModule?.targetUrl ||
    (domain && !domain.startsWith('brand-') ? `https://${domain.replace(/^https?:\/\//, '')}` : '');
  const runResult = adminRunToPublicRunResult(run);

  return {
    data: buildPlanConquistarTeaserData(
      runResult,
      context?.satelliteModule,
      siteUrl,
      context?.domainRating,
    ),
    meta: {
      brandName: run.brand.name,
      domain,
      diagnosticId: context?.diagnostic?.id ?? null,
      runId,
    },
    runResult,
    trendData: context?.trendData ?? [],
    satelliteModule: context?.satelliteModule ?? null,
    siteUrl,
  };
}

/** @deprecated Usar loadPlanConquistarUpsellPreviewBundle */
export async function loadPlanConquistarTeaserFromAdminRun(runId: string) {
  const bundle = await loadPlanConquistarUpsellPreviewBundle(runId);
  return { data: bundle.data, meta: bundle.meta };
}
