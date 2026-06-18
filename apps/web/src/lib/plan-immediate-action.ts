export type ImmediateActionPhase = {
  range: string;
  theme: string;
  evidence: string;
  tasks: string[];
};

type OpportunityLike = {
  label: string;
  score: number;
  priority: number;
  intention: string;
  scenario?: string;
  action: string;
};

type CompetitorLike = {
  name: string;
  appearances: number;
  reasons?: string[];
};

export function buildImmediateActionPlan(input: {
  brandName: string;
  primaryOpportunity?: OpportunityLike | null;
  improveNow: OpportunityLike[];
  topCompetitor?: CompetitorLike | null;
  formatOpportunity?: (item: OpportunityLike) => string;
}): ImmediateActionPhase[] {
  const { brandName, primaryOpportunity, improveNow, topCompetitor } = input;
  const format =
    input.formatOpportunity ??
    ((item: OpportunityLike) => `${item.label} (score ${item.score}, prioridad ${item.priority})`);

  return [
    {
      range: 'Prioridad inmediata',
      theme: primaryOpportunity ? primaryOpportunity.label : 'Definir la primera acción',
      evidence: primaryOpportunity
        ? `Mayor prioridad del reporte (${primaryOpportunity.priority})`
        : 'Basado en la corrida actual',
      tasks: primaryOpportunity
        ? [
            `Publicar o mejorar una pieza para: ${format(primaryOpportunity)}`,
            primaryOpportunity.scenario
              ? `Responder en el sitio: “${primaryOpportunity.scenario}”`
              : `Cubrir la intención: ${primaryOpportunity.intention}`,
            primaryOpportunity.action,
          ]
        : ['Revisar la oportunidad con mayor prioridad cuando haya datos'],
    },
    {
      range: 'Esta semana',
      theme: 'Quick wins (menor score)',
      evidence: improveNow.length
        ? `${Math.min(3, improveNow.length)} consultas con más margen de mejora`
        : 'Sin consultas débiles detectadas',
      tasks: improveNow.length
        ? improveNow.slice(0, 3).map((item) => `Mejorar ${format(item)}`)
        : ['Sin acciones urgentes adicionales en esta corrida'],
    },
    {
      range: 'Siguiente paso',
      theme: topCompetitor ? `Comparativa vs ${topCompetitor.name}` : 'Refuerzo competitivo',
      evidence: topCompetitor
        ? `${topCompetitor.name} aparece ${topCompetitor.appearances} veces en el Top 3`
        : 'Sin competidor dominante detectado',
      tasks: topCompetitor
        ? [
            `Página honesta: ${brandName} vs ${topCompetitor.name}`,
            topCompetitor.reasons?.[0]
              ? `Responder por qué el motor menciona: ${topCompetitor.reasons[0]}`
              : `Cuándo conviene elegir ${brandName}`,
            'Sumar un caso, dato o FAQ verificable',
          ]
        : [
            `Comparativa base con competidores cargados para ${brandName}`,
            'Agregar evidencia verificable en el sitio',
          ],
    },
  ];
}
