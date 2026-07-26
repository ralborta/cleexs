import type { PlanConquistarTeaserData } from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import type { CrawlerAccessReport } from '@/lib/crawler-access';
import type { DiagnosticoV2Finding } from '@/lib/diagnostico-v2-data';

export type PlanPhaseId = 'fundamentos' | 'optimizacion' | 'autoridad' | 'escalamiento';

export type PlanPhase = {
  id: PlanPhaseId;
  name: string;
  shortLabel: string;
  weekStart: number;
  weekEnd: number;
  subtitle: string;
  accent: 'blue' | 'purple' | 'indigo' | 'cyan';
};

export type PlanActionPriority = 'alta' | 'media' | 'baja';

export type PlanAction = {
  id: string;
  title: string;
  priority: PlanActionPriority;
  impact: 'Alto' | 'Medio' | 'Defensivo';
  effort: 'Bajo' | 'Medio' | 'Alto';
  statusNote?: string;
  detected: string;
  whyItMatters: string;
  recommendedAction: string;
  deliverable: string;
  owner: string;
  successIndicator: string;
  diagnosticLink: string;
  weekStart: number;
  weekEnd: number;
  weekRoles: Partial<Record<number, string>>;
  cleexsCanImplement?: boolean;
  ganttWeeks: boolean[];
};

export type PlanWeek = {
  week: number;
  phaseId: PlanPhaseId;
  title: string;
  objective: string;
  expectedImpact: 'alto' | 'medio' | 'bajo';
  actionIds: string[];
};

export type PlanExpectedResult = {
  label: string;
  pct: number;
  accent: 'blue' | 'purple' | 'cyan';
};

export type PersonalizedActionPlanV3 = {
  stats: {
    weeks: number;
    phases: number;
    actions: number;
    criticalAreas: number;
  };
  phases: PlanPhase[];
  weeks: PlanWeek[];
  actions: PlanAction[];
  expectedResults: PlanExpectedResult[];
};

const PHASES: PlanPhase[] = [
  {
    id: 'fundamentos',
    name: 'Fundamentos',
    shortLabel: 'S1–S3',
    weekStart: 1,
    weekEnd: 3,
    subtitle: 'Base técnica',
    accent: 'blue',
  },
  {
    id: 'optimizacion',
    name: 'Optimización',
    shortLabel: 'S4–S6',
    weekStart: 4,
    weekEnd: 6,
    subtitle: 'Contenido y estructura',
    accent: 'purple',
  },
  {
    id: 'autoridad',
    name: 'Autoridad',
    shortLabel: 'S7–S9',
    weekStart: 7,
    weekEnd: 9,
    subtitle: 'Señales de confianza',
    accent: 'indigo',
  },
  {
    id: 'escalamiento',
    name: 'Escalamiento',
    shortLabel: 'S10–S12',
    weekStart: 10,
    weekEnd: 12,
    subtitle: 'Medición y crecimiento',
    accent: 'cyan',
  },
];

function ganttRange(start: number, end: number): boolean[] {
  return Array.from({ length: 12 }, (_, i) => i + 1 >= start && i + 1 <= end);
}

function weekInRange(week: number, start: number, end: number) {
  return week >= start && week <= end;
}

function phaseForWeek(week: number): PlanPhaseId {
  if (week <= 3) return 'fundamentos';
  if (week <= 6) return 'optimizacion';
  if (week <= 9) return 'autoridad';
  return 'escalamiento';
}

const WEEK_TITLES: Record<number, string> = {
  1: 'Diagnóstico técnico inicial',
  2: 'Acceso de crawlers',
  3: 'Optimización técnica',
  4: 'Contenido estratégico · preparación',
  5: 'Contenido estratégico · implementación',
  6: 'Contenido estratégico · validación',
  7: 'Autoridad externa',
  8: 'Comparativas competitivas',
  9: 'Señales de confianza',
  10: 'Medición de avances',
  11: 'Optimización continua',
  12: 'Cierre y re-diagnóstico',
};

const WEEK_OBJECTIVES: Record<number, string> = {
  1: 'Entender barreras técnicas y de visibilidad detectadas en el diagnóstico.',
  2: 'Facilitar el acceso de crawlers de IA al sitio sin bloqueos innecesarios.',
  3: 'Asegurar que los motores de IA puedan acceder y comprender tu sitio sin barreras técnicas.',
  4: 'Priorizar las consultas de mayor impacto y preparar piezas de contenido.',
  5: 'Publicar y mejorar páginas que respondan intenciones críticas de compra.',
  6: 'Validar que el contenido nuevo mejore comprensión y citabilidad en motores.',
  7: 'Reforzar presencia en directorios, reseñas y fuentes externas verificables.',
  8: 'Publicar comparativas honestas frente al líder del sector.',
  9: 'Consolidar pruebas sociales, casos y evidencia de autoridad.',
  10: 'Medir cambios en score, menciones y oportunidades débiles.',
  11: 'Ajustar el plan según resultados parciales del mes.',
  12: 'Correr un nuevo diagnóstico y definir el siguiente ciclo de mejora.',
};

function mapPriority(impact: string, score: number): PlanActionPriority {
  if (impact === 'Alto' || score < 40) return 'alta';
  if (impact === 'Medio' || score < 65) return 'media';
  return 'baja';
}

export function buildPersonalizedActionPlanV3(input: {
  brandName: string;
  leaderName: string;
  domain: string;
  findings: DiagnosticoV2Finding[];
  opportunities: PlanConquistarTeaserData['opportunities'];
  roadmap: PlanConquistarTeaserData['roadmap'];
  crawlerAccess?: CrawlerAccessReport | null;
}): PersonalizedActionPlanV3 {
  const criticalAreas = Math.max(input.findings.filter((f) => f.tone !== 'success').length, 3);
  const topOpps = [...input.opportunities].sort((a, b) => b.priority - a.priority);
  const blockedBots = input.crawlerAccess?.blockedCount ?? input.crawlerAccess?.bots.filter((b) => !b.allowed).length ?? 0;
  const crawlerNote =
    blockedBots > 0
      ? `${blockedBots} motores presentan restricciones de acceso`
      : 'Revisar reglas de acceso en robots.txt';

  const actions: PlanAction[] = [
    {
      id: 'crawlers',
      title: 'Permitir acceso de crawlers de IA',
      priority: 'alta',
      impact: 'Alto',
      effort: 'Bajo',
      statusNote: crawlerNote,
      detected:
        blockedBots > 0
          ? `Detectamos ${blockedBots} bots de IA con acceso restringido o bloqueado en robots.txt.`
          : 'El diagnóstico recomienda validar reglas de acceso para crawlers de IA en el sitio.',
      whyItMatters:
        'Si los crawlers no pueden leer el sitio, los motores no indexan ni citan tu marca con la misma profundidad.',
      recommendedAction: 'Revisar robots.txt y reglas de firewall; permitir user-agents de IA relevantes.',
      deliverable: 'robots.txt actualizado + checklist de acceso validado',
      owner: 'Desarrollador web / SEO técnico',
      successIndicator: 'Crawlers de IA acceden con HTTP 200 a páginas clave',
      diagnosticLink: 'Relacionado con acceso de crawlers en el informe técnico',
      weekStart: 1,
      weekEnd: 2,
      weekRoles: { 1: 'Diagnóstico', 2: 'Implementación' },
      cleexsCanImplement: true,
      ganttWeeks: ganttRange(1, 2),
    },
    {
      id: 'structured-data',
      title: 'Implementar datos estructurados',
      priority: 'alta',
      impact: 'Alto',
      effort: 'Medio',
      statusNote: 'Schema incompleto en páginas clave',
      detected: 'Faltan marcados estructurados que ayuden a los motores a interpretar productos y FAQs.',
      whyItMatters: 'Mejora comprensión semántica y aumenta chances de respuesta precisa en consultas de IA.',
      recommendedAction: 'Agregar JSON-LD de Organization, Product/Service y FAQ en landings prioritarias.',
      deliverable: 'Schema validado en Search Console / Rich Results Test',
      owner: 'Desarrollador web',
      successIndicator: 'Páginas clave pasan validación de schema sin errores críticos',
      diagnosticLink: 'Vinculado a oportunidades de comprensión del sitio',
      weekStart: 2,
      weekEnd: 3,
      weekRoles: { 2: 'Auditoría', 3: 'Implementación' },
      cleexsCanImplement: true,
      ganttWeeks: ganttRange(2, 3),
    },
    {
      id: 'index-validation',
      title: 'Validar indexación en motores de IA',
      priority: 'media',
      impact: 'Medio',
      effort: 'Bajo',
      detected: 'No hay evidencia reciente de cómo cada motor interpreta las URLs principales.',
      whyItMatters: 'Confirma que los cambios técnicos se reflejan en cómo responden ChatGPT, Gemini y otros.',
      recommendedAction: 'Probar URLs clave con herramientas AXP/satélite y registrar diferencias por motor.',
      deliverable: 'Informe de indexación por motor',
      owner: 'SEO / marketing digital',
      successIndicator: 'Motores devuelven contenido coherente con la versión optimizada',
      diagnosticLink: 'Score por motor en Cleexs',
      weekStart: 3,
      weekEnd: 3,
      weekRoles: { 3: 'Validación' },
      ganttWeeks: ganttRange(3, 3),
    },
    {
      id: 'strategic-content',
      title: 'Crear contenido orientado a preguntas relevantes',
      priority: 'alta',
      impact: 'Alto',
      effort: 'Medio',
      statusNote: topOpps[0]?.scenario ? `Consulta: “${topOpps[0].scenario.slice(0, 60)}…”` : undefined,
      detected:
        topOpps[0]?.action ??
        'Hay consultas de alta intención donde la marca aparece poco o no aparece en top recomendaciones.',
      whyItMatters: 'Es donde se decide la compra: comparaciones, alternativas y “mejor opción para…”.',
      recommendedAction: topOpps[0]?.action ?? 'Publicar páginas que respondan las intenciones críticas del diagnóstico.',
      deliverable: '2–3 piezas nuevas o mejoradas con FAQs verificables',
      owner: 'Contenido / marketing',
      successIndicator: 'Mejora en score de consultas objetivo en próximo diagnóstico',
      diagnosticLink: topOpps[0]?.title ?? 'Oportunidades priorizadas',
      weekStart: 4,
      weekEnd: 6,
      weekRoles: { 4: 'Preparación', 5: 'Implementación', 6: 'Validación' },
      ganttWeeks: ganttRange(4, 6),
    },
    {
      id: 'comparison-page',
      title: `Comparativa vs ${input.leaderName}`,
      priority: 'alta',
      impact: 'Alto',
      effort: 'Medio',
      detected: `${input.leaderName} concentra mayor share en consultas comparativas del diagnóstico.`,
      whyItMatters: 'Las IAs usan páginas comparativas honestas para recomendar en decisiones finales.',
      recommendedAction: `Publicar página “${input.brandName} vs ${input.leaderName}” con criterios verificables.`,
      deliverable: 'Landing comparativa indexable',
      owner: 'Contenido / producto',
      successIndicator: 'La marca aparece en consultas de comparación simuladas',
      diagnosticLink: 'Sección competidores del diagnóstico',
      weekStart: 4,
      weekEnd: 5,
      weekRoles: { 4: 'Investigación', 5: 'Publicación' },
      cleexsCanImplement: true,
      ganttWeeks: ganttRange(4, 5),
    },
    {
      id: 'intent-pages',
      title: 'Páginas por intención crítica',
      priority: 'media',
      impact: 'Medio',
      effort: 'Medio',
      detected: 'Varias intenciones del funnel tienen score bajo en el mapa de ejecución.',
      whyItMatters: 'Cada intención sin respuesta clara es una fuga de demanda hacia competidores.',
      recommendedAction: 'Crear o mejorar una URL por intención priorizada (consideración, comparación, decisión).',
      deliverable: 'Mapa URL ↔ intención documentado',
      owner: 'Contenido / SEO',
      successIndicator: 'Cobertura de top 5 intenciones con página dedicada',
      diagnosticLink: 'Mapa de ejecución · Mejorar ahora',
      weekStart: 5,
      weekEnd: 7,
      weekRoles: { 5: 'Priorización', 6: 'Producción', 7: 'Refuerzo' },
      ganttWeeks: ganttRange(5, 7),
    },
    {
      id: 'external-authority',
      title: 'Autoridad y menciones externas',
      priority: 'media',
      impact: 'Medio',
      effort: 'Medio',
      detected: 'Señales externas (directorios, reseñas, comunidades) están subaprovechadas.',
      whyItMatters: 'Los motores cruzan fuentes externas para validar recomendaciones.',
      recommendedAction: 'Actualizar perfiles en directorios del rubro y sumar reseñas/casos verificables.',
      deliverable: 'Listado de fuentes externas actualizadas',
      owner: 'Marketing / PR digital',
      successIndicator: 'Perfiles clave alineados con propuesta de valor y categoría',
      diagnosticLink: 'Autoridad externa sugerida',
      weekStart: 7,
      weekEnd: 10,
      weekRoles: { 7: 'Auditoría', 8: 'Ejecución', 9: 'Refuerzo', 10: 'Validación' },
      cleexsCanImplement: true,
      ganttWeeks: ganttRange(7, 10),
    },
    {
      id: 'trust-signals',
      title: 'Pruebas sociales y confianza',
      priority: 'media',
      impact: 'Medio',
      effort: 'Bajo',
      detected: 'Faltan casos, testimonios o datos verificables en páginas de decisión.',
      whyItMatters: 'Aumenta credibilidad cuando un motor resume por qué recomendar tu marca.',
      recommendedAction: 'Incorporar casos, métricas y FAQs con respuestas directas en landings clave.',
      deliverable: 'Bloque de prueba social en home y páginas de producto',
      owner: 'Marketing',
      successIndicator: 'Páginas de decisión incluyen evidencia verificable',
      diagnosticLink: 'Hallazgos de consideración y calidad',
      weekStart: 8,
      weekEnd: 9,
      weekRoles: { 8: 'Recolección', 9: 'Publicación' },
      ganttWeeks: ganttRange(8, 9),
    },
    {
      id: 'measurement',
      title: 'Medición y mejora continua',
      priority: 'media',
      impact: 'Defensivo',
      effort: 'Bajo',
      detected: 'Sin baseline reciente post-implementación para comparar avances.',
      whyItMatters: 'Permite demostrar ROI del plan y priorizar el siguiente ciclo.',
      recommendedAction: 'Registrar scores Cleexs, oportunidades débiles y share vs competidores.',
      deliverable: 'Dashboard de seguimiento mensual',
      owner: 'Marketing / growth',
      successIndicator: 'Mejora documentada en al menos 2 métricas clave',
      diagnosticLink: 'Cleexs Score y oportunidades',
      weekStart: 10,
      weekEnd: 12,
      weekRoles: { 10: 'Medición', 11: 'Ajustes', 12: 'Informe' },
      ganttWeeks: ganttRange(10, 12),
    },
    {
      id: 're-diagnostic',
      title: 'Nuevo diagnóstico Cleexs',
      priority: 'baja',
      impact: 'Defensivo',
      effort: 'Bajo',
      detected: 'Ciclo de 12 semanas completado; conviene re-medir desde cero.',
      whyItMatters: 'Valida si las acciones movieron menciones, score y posición vs competidores.',
      recommendedAction: 'Correr diagnóstico completo y comparar con baseline inicial.',
      deliverable: 'Informe comparativo antes/después',
      owner: 'Responsable de cuenta',
      successIndicator: 'Score y share mejoran vs diagnóstico inicial',
      diagnosticLink: `Diagnóstico original de ${input.domain}`,
      weekStart: 12,
      weekEnd: 12,
      weekRoles: { 12: 'Cierre' },
      ganttWeeks: ganttRange(12, 12),
    },
  ];

  // Enrich from roadmap phases if available
  input.roadmap.forEach((phase, idx) => {
    const action = actions[idx + 3];
    if (!action) return;
    if (phase.evidence) action.detected = phase.evidence;
    if (phase.tasks[0]) action.recommendedAction = phase.tasks[0];
  });

  const weeks: PlanWeek[] = Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    const actionIds = actions.filter((a) => weekInRange(week, a.weekStart, a.weekEnd)).map((a) => a.id);
    return {
      week,
      phaseId: phaseForWeek(week),
      title: WEEK_TITLES[week] ?? `Semana ${week}`,
      objective: WEEK_OBJECTIVES[week] ?? 'Ejecutar acciones planificadas del roadmap.',
      expectedImpact: week <= 3 ? 'alto' : week <= 6 ? 'alto' : week <= 9 ? 'medio' : 'medio',
      actionIds,
    };
  });

  return {
    stats: {
      weeks: 12,
      phases: 4,
      actions: actions.length,
      criticalAreas,
    },
    phases: PHASES,
    weeks,
    actions,
    expectedResults: [
      { label: 'Acceso técnico', pct: blockedBots > 0 ? 35 : 70, accent: 'blue' },
      { label: 'Comprensión del sitio', pct: 45, accent: 'purple' },
      { label: 'Capacidad de citación', pct: 40, accent: 'cyan' },
    ],
  };
}

export function getActionsForWeek(plan: PersonalizedActionPlanV3, week: number): PlanAction[] {
  const weekRow = plan.weeks.find((w) => w.week === week);
  if (!weekRow) return [];
  return weekRow.actionIds
    .map((id) => plan.actions.find((a) => a.id === id))
    .filter((a): a is PlanAction => Boolean(a));
}

export function getPhaseForWeek(plan: PersonalizedActionPlanV3, week: number): PlanPhase {
  const phaseId = phaseForWeek(week);
  return plan.phases.find((p) => p.id === phaseId)!;
}
