/**
 * Generación de prompts para diagnóstico público.
 * Mantiene intenciones simples y evita meter rubro/sector en el texto del prompt.
 */

/** Pesos por defecto (suman 100) */
const DEFAULT_WEIGHTS = {
  urgencia: 30,
  consideracion: 30,
  calidad: 40,
  precio: 30,
};

export type IntentionType = 'urgencia' | 'consideracion';

/**
 * Mantiene una intención inicial estable y genérica para no sesgar el diagnóstico por rubro.
 */
export function getIntentionForIndustry(_industry: string): IntentionType {
  return 'consideracion';
}

/**
 * Contextos para cada intención (texto que va en el prompt)
 */
function getIntentionContexts(intention: IntentionType) {
  return {
    urgencia: {
      label: 'Urgencia',
      weight: DEFAULT_WEIGHTS.urgencia,
      context: 'Necesito resolver esta necesidad rápido y con una respuesta inmediata.',
    },
    consideracion: {
      label: 'Consideración',
      weight: DEFAULT_WEIGHTS.consideracion,
      context: 'Estoy evaluando opciones y quiero comparar bien antes de decidir.',
    },
    calidad: {
      label: 'Calidad',
      weight: DEFAULT_WEIGHTS.calidad,
      context: 'Busco la opción más confiable y de mejor calidad.',
    },
    precio: {
      label: 'Precio',
      weight: DEFAULT_WEIGHTS.precio,
      context: 'Busco una opción con buen precio y valor.',
    },
  };
}

/**
 * Genera los 9 prompts para el diagnóstico (3 intenciones × 3 tipos).
 */
export function buildDiagnosticPrompts(
  brandName: string,
  _industry: string,
  competitors: string[],
  intention: IntentionType,
  country?: string
): Array<{ name: string; promptText: string }> {
  const competitorText = competitors.length ? competitors.join(', ') : 'competidores relevantes';
  const types = ['Comparativo', 'Recomendación', 'Defensibilidad'] as const;
  const countryLine = country ? `País / mercado: ${country}.` : '';

  const contexts = getIntentionContexts(intention);
  const firstIntention = intention === 'consideracion' ? contexts.consideracion : contexts.urgencia;

  const intentions = [
    { ...firstIntention },
    { ...contexts.calidad },
    { ...contexts.precio },
  ];

  const prompts: Array<{ name: string; promptText: string }> = [];

  for (const intentionItem of intentions) {
    const prefix = `Intención: ${intentionItem.label} (${intentionItem.weight}%). Tipo:`;
    const allowedBrandsLine = `Usá solo esta lista de marcas: ${brandName}${competitors.length ? `, ${competitorText}` : ''}. No agregues otras marcas.`;
    const texts: string[] = [
      `${prefix} Comparativo.\n${intentionItem.context}\n${countryLine}\nArmá un Top 3 usando solo estas marcas. Marca medida: ${brandName}. Competidores: ${competitorText}. ${allowedBrandsLine} Respondé 1., 2., 3. con motivo breve.`,
      `${prefix} Recomendación.\n${intentionItem.context}\n${countryLine}\nSi tuvieras que recomendar una opción, ¿cuál es el Top 3? Incluí ${brandName} y ${competitorText}. ${allowedBrandsLine} Respondé 1., 2., 3. con motivo breve por cada uno.`,
      `${prefix} Defensibilidad.\n${intentionItem.context}\n${countryLine}\nEstoy considerando ${brandName}. ¿Hay alternativas mejores dentro de esta lista? ${allowedBrandsLine} Indicá 1., 2., 3. con motivo breve.`,
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
