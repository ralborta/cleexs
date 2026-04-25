/**
 * 11 pasos alineados por índice con el backend (public-diagnostic: DIAGNOSTIC_STEP_LABELS).
 * Solo la capa de copy / producto; el estado `completed` viene del API.
 *
 * Próxima iteración (opcional): alinear nombres en API con estos labels; señales parciales
 * reales en GET durante running; leer `sessionStorage` cleexs_onboarding_{id}_snapshot
 * en ver-resultado para comparar predicción vs score; endpoint de analytics;
 * screenshot del dominio (og:image) en columna visual.
 */
export const ONBOARDING_STEP_LABELS = [
  'Analizando si las IAs entienden qué hace tu empresa',
  'Detectando si tu contenido es citable por ChatGPT',
  'Evaluando la claridad de tu propuesta de valor',
  'Escaneando la estructura de tu sitio para IA',
  'Midiendo tu autoridad digital en tu categoría',
  'Buscando menciones externas relevantes',
  'Comparando tu posicionamiento vs competidores',
  'Simulando respuestas reales en ChatGPT',
  'Detectando oportunidades para aparecer en IA',
  'Analizando velocidad y accesibilidad para bots',
  'Calculando tu Cleexs Score final',
] as const;

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEP_LABELS.length;

export type SitePreviewContext = {
  brandName: string | null;
  domain: string;
  industry: string | null;
};

/**
 * Heurísticos: tono "diagnóstico en curso". Refinar cuando el API exponga señales parciales.
 */
export function getPartialInsight(
  stepIndex: number,
  ctx: SitePreviewContext
): { id: string; text: string } {
  const brand = ctx.brandName ?? 'Tu marca';
  const dom = ctx.domain ? ctx.domain.replace(/^https?:\/\//, '') : 'tu sitio';

  const pool: Record<number, { id: string; text: string }[]> = {
    0: [
      { id: 'a', text: `Mapeando cómo las IAs vinculan "${brand}" con lo que ofrecés en ${dom}.` },
    ],
    1: [
      { id: 'b', text: 'Buscando frases y bloques de tu sitio que ChatGPT podría citar tal cual.' },
    ],
    2: [
      { id: 'c', text: 'Detectando si tu propuesta de valor se entiende en 2 líneas o hace falta refuerzo.' },
    ],
    3: [
      { id: 'd', text: `Revisando encabezados, FAQs y estructura semántica frente a lectura por IA de ${dom}.` },
    ],
    4: [
      { id: 'e', text: 'Señales de autoridad: comparando tu presencia con referentes en tu nicho (heurístico).' },
    ],
    5: [
      { id: 'f', text: 'Rastreando menciones y coocurrencias de tu marca con consultas reales (parcial).' },
    ],
    6: [
      { id: 'g', text: 'Detectamos competidores con mejor frecuencia de aparición en respuestas similares (vista en curso).' },
    ],
    7: [
      { id: 'h', text: 'Generando un mock de la forma en que ChatGPT podría listar a tu competencia y a vos.' },
    ],
    8: [
      { id: 'i', text: 'Anotando huecos: consultas de tu intención donde aún no aparecés o aparecés tarde.' },
    ],
    9: [
      { id: 'j', text: 'Midiendo carga, HTML y señales de que los bots no queden atrapados en muros de login o JS.' },
    ],
    10: [
      { id: 'k', text: 'Cerrando el cálculo del Cleexs Score a partir de prompts y señales acumuladas.' },
    ],
  };

  const list = pool[stepIndex] ?? [
    { id: 'x', text: 'Consolidando señales para el informe (análisis en curso).' },
  ];
  return list[0]!;
}

const STORAGE_KEY_PREFIX = 'cleexs_onboarding_';

export function onboardingStorageKey(diagnosticId: string, suffix: string) {
  return `${STORAGE_KEY_PREFIX}${diagnosticId}_${suffix}`;
}

export function saveOnboardingSnapshot(diagnosticId: string, data: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    const key = onboardingStorageKey(diagnosticId, 'snapshot');
    const prev = window.sessionStorage.getItem(key);
    const merged = { ...(prev ? (JSON.parse(prev) as object) : {}), ...data };
    window.sessionStorage.setItem(key, JSON.stringify(merged));
  } catch {
    // ignore
  }
}
