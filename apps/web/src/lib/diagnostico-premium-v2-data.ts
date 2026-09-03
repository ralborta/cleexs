import type { PlanConquistarTeaserData } from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import type { DiagnosticoV2Finding } from '@/lib/diagnostico-v2-data';

export type PremiumWeekTask = {
  id: string;
  label: string;
};

export type PremiumWeekItem = {
  week: number;
  label: string;
  title: string;
  theme: string;
  evidence: string;
  impact?: string;
  effort?: string;
  tasks: PremiumWeekTask[];
};

export type PremiumSituationSummary = {
  headline: string;
  intro: string;
  problems: DiagnosticoV2Finding[];
  strengths: string[];
};

const CHECKLIST_GROUPS = [
  ['Definir las 5 intenciones principales donde querés ser recomendado.', 'Crear o mejorar una página para cada intención crítica.'],
  ['Agregar FAQs claras con respuestas directas y verificables.', 'Publicar comparativas honestas contra competidores relevantes.'],
  ['Actualizar datos de marca, rubro, ubicación y propuesta de valor.', 'Sumar casos, pruebas sociales y evidencia de autoridad.'],
  ['Medir nuevamente las oportunidades de menor score.', 'Correr un nuevo diagnóstico cuando ejecutes las acciones principales.'],
] as const;

export function buildPremiumSituationSummary(input: {
  brandName: string;
  domain: string;
  score: number;
  leaderName: string;
  brandShare: number;
  leaderShare: number;
  findings: DiagnosticoV2Finding[];
  weaknesses?: string[];
  strengths?: string[];
}): PremiumSituationSummary {
  const gap =
    input.leaderShare > input.brandShare
      ? Math.round(((input.leaderShare - input.brandShare) / Math.max(input.leaderShare, 1)) * 100)
      : 0;

  return {
    headline: `Hoy ${input.brandName} no está capturando todo el tráfico de decisión en IA`,
    intro:
      gap > 0
        ? `${input.domain} tiene un Cleexs Score de ${input.score}/100. En consultas de comparación y elección, ${input.leaderName} concentra ~${input.leaderShare}% de menciones frente a ~${input.brandShare}% de tu marca. Eso significa oportunidades concretas — no un problema genérico de “SEO”.`
        : `${input.domain} tiene un Cleexs Score de ${input.score}/100. El diagnóstico detectó brechas específicas en cómo los motores de IA recomiendan tu marca frente a alternativas.`,
    problems: input.findings.filter((f) => f.tone !== 'success'),
    strengths: input.strengths?.length
      ? input.strengths
      : input.findings.filter((f) => f.tone === 'success').map((f) => f.title),
  };
}

export function buildPremiumWeeklyPlan(input: {
  brandName: string;
  leaderName: string;
  opportunities: PlanConquistarTeaserData['opportunities'];
  roadmap: PlanConquistarTeaserData['roadmap'];
}): PremiumWeekItem[] {
  const opps = [...input.opportunities].sort((a, b) => b.priority - a.priority);
  const weeks: PremiumWeekItem[] = [];

  for (let i = 0; i < 4; i++) {
    const opp = opps[i];
    const week = i + 1;
    if (opp) {
      weeks.push({
        week,
        label: `Semana ${week}`,
        title: opp.title,
        theme: opp.intention || 'Contenido de alta intención',
        evidence: opp.scenario ? `Consulta detectada: “${opp.scenario}”` : `Prioridad ${opp.priority} en el diagnóstico`,
        impact: opp.impact,
        effort: opp.effort,
        tasks: [
          { id: `w${week}-1`, label: opp.action },
          { id: `w${week}-2`, label: `Publicar o mejorar la pieza para: ${opp.title}` },
          { id: `w${week}-3`, label: `Verificar que la página responda la intención “${opp.intention}”` },
        ],
      });
    } else {
      weeks.push({
        week,
        label: `Semana ${week}`,
        title: 'Quick win de visibilidad',
        theme: 'Contenido accionable',
        evidence: 'Basado en oportunidades del diagnóstico',
        tasks: [{ id: `w${week}-1`, label: `Reforzar una página clave de ${input.brandName} con FAQs verificables` }],
      });
    }
  }

  input.roadmap.forEach((phase, index) => {
    const week = 5 + index;
    if (week > 8) return;
    weeks.push({
      week,
      label: `Semana ${week}`,
      title: phase.theme,
      theme: phase.range,
      evidence: phase.evidence,
      tasks: phase.tasks.map((task, ti) => ({ id: `w${week}-t${ti}`, label: task })),
    });
  });

  while (weeks.length < 8) {
    const week = weeks.length + 1;
    weeks.push({
      week,
      label: `Semana ${week}`,
      title: week === 7 ? `Comparativa vs ${input.leaderName}` : 'Autoridad y señales externas',
      theme: week === 7 ? 'Decisión de compra' : 'Presencia fuera del sitio',
      evidence: week === 7 ? `${input.leaderName} domina consultas comparativas` : 'Canales sugeridos en el informe',
      tasks: [
        {
          id: `w${week}-1`,
          label:
            week === 7
              ? `Publicar página honesta: ${input.brandName} vs ${input.leaderName}`
              : 'Reforzar perfiles en directorios y reseñas verificables',
        },
      ],
    });
  }

  CHECKLIST_GROUPS.forEach((group, index) => {
    const week = 9 + index;
    weeks.push({
      week,
      label: `Semana ${week}`,
      title: index === 3 ? 'Medición y siguiente corrida' : 'Implementación operativa',
      theme: index === 3 ? 'Cerrar el ciclo' : 'Checklist de ejecución',
      evidence: 'Guía operativa del plan Cleexs',
      tasks: group.map((label, ti) => ({ id: `w${week}-c${ti}`, label })),
    });
  });

  return weeks.slice(0, 12);
}
