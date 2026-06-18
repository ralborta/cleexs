import type { PublicDiagnosticRunResult, PublicDiagnosticSatelliteModule } from '@/lib/api';
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

export function buildPlanConquistarTeaserData(
  runResult: PublicDiagnosticRunResult,
  satelliteModule?: PublicDiagnosticSatelliteModule | null,
  siteUrl?: string | null,
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
  };
}
