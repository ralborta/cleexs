/**
 * Generación de prompts para diagnóstico público.
 * Selecciona Urgencia vs Consideración según industria y genera los 9 prompts.
 */

/** Industrias donde usar Consideración en lugar de Urgencia (decisión con tiempo) */
const INDUSTRIES_USE_CONSIDERACION = [
  'educación',
  'educacion',
  'universidad',
  'universidades',
  'cursos',
  'formación',
  'formacion',
  'banco',
  'bancos',
  'banca',
  'finanzas',
  'seguros',
  'aseguradora',
  'consultoría',
  'consultoria',
  'consultor',
  'servicios profesionales',
  'abogacía',
  'abogacia',
  'medicina',
  'salud',
  'hospital',
];

/** Pesos por defecto (suman 100) */
const DEFAULT_WEIGHTS = {
  urgencia: 30,
  consideracion: 30,
  calidad: 40,
  precio: 30,
};

export type IntentionType = 'urgencia' | 'consideracion';

/**
 * Determina si la industria debe usar Consideración en lugar de Urgencia.
 */
export function getIntentionForIndustry(industry: string): IntentionType {
  const normalized = industry
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const matches = INDUSTRIES_USE_CONSIDERACION.some((term) => normalized.includes(term));
  return matches ? 'consideracion' : 'urgencia';
}

/**
 * Contextos para cada intención (texto que va en el prompt)
 */
function getIntentionContexts(intention: IntentionType, industry: string) {
  const product = 'productos y servicios';
  const industryCtx = industry || 'tu sector';
  return {
    urgencia: {
      label: 'Urgencia',
      weight: DEFAULT_WEIGHTS.urgencia,
      context: `Necesito encontrar ${product} pronto, con entrega o respuesta inmediata.`,
    },
    consideracion: {
      label: 'Consideración',
      weight: DEFAULT_WEIGHTS.consideracion,
      context: `Estoy evaluando ${product} para ${industryCtx}. Busco una decisión informada a mediano plazo, sin urgencia inmediata.`,
    },
    calidad: {
      label: 'Calidad',
      weight: DEFAULT_WEIGHTS.calidad,
      context: `Busco la mejor calidad en ${product} para ${industryCtx}.`,
    },
    precio: {
      label: 'Precio',
      weight: DEFAULT_WEIGHTS.precio,
      context: `Busco ${product} con buen precio y valor.`,
    },
  };
}

/**
 * Genera los 9 prompts para el diagnóstico (3 intenciones × 3 tipos).
 */
export function buildDiagnosticPrompts(
  brandName: string,
  industry: string,
  competitors: string[],
  intention: IntentionType
): Array<{ name: string; promptText: string }> {
  const competitorText = competitors.length ? competitors.join(', ') : 'competidores relevantes';
  const types = ['Comparativo', 'Recomendación', 'Defensibilidad'] as const;

  const contexts = getIntentionContexts(intention, industry);
  const firstIntention = intention === 'consideracion' ? contexts.consideracion : contexts.urgencia;

  const intentions = [
    { ...firstIntention },
    { ...contexts.calidad },
    { ...contexts.precio },
  ];

  const prompts: Array<{ name: string; promptText: string }> = [];

  for (const intentionItem of intentions) {
    const prefix = `Intención: ${intentionItem.label} (${intentionItem.weight}%). Tipo:`;
    const texts: string[] = [
      `${prefix} Comparativo.\n${intentionItem.context}\nCompará y rankeá Top 3 en esta categoría. Marca medida: ${brandName}. Competidores: ${competitorText}. Respondé 1., 2., 3. con motivo breve.`,
      `${prefix} Recomendación.\n${intentionItem.context}\nSi tuvieras que recomendar para alguien con esta necesidad, ¿cuál es el Top 3? Incluí ${brandName} y ${competitorText}. Respondé 1., 2., 3. con motivo breve por cada uno.`,
      `${prefix} Defensibilidad.\n${intentionItem.context}\nEstoy considerando ${brandName}. ¿Hay alternativas mejores? Respondé con Top 3 e incluí ${competitorText}. Indicá 1., 2., 3. con motivo breve.`,
    ];
    types.forEach((tipo, i) => {
      prompts.push({
        name: `${intentionItem.label} (${intentionItem.weight}%) - ${tipo}`,
        promptText: texts[i],
      });
    });
  }

  return prompts;
}
