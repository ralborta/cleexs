/**
 * Cálculo compartido para el bloque “Interpretación ampliada” (portal Premium y ex–diagnóstico público).
 */

export type CorridasPromptRow = {
  score?: number;
  responseText?: string | null;
  top3Json?: Array<{ position: number; name: string; type: string }> | null;
  promptText?: string | null;
  category?: string | null;
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

const isBrandMentioned = (text: string, brandName: string, aliases: string[]) => {
  if (!text) return false;
  if (normalizeName(text).includes(normalizeName(brandName))) return true;
  return aliases.some((alias) => normalizeName(text).includes(normalizeName(alias)));
};

const isBrandEntry = (entryName: string, brandName: string, aliases: string[]) => {
  const n = normalizeName(entryName);
  if (n === normalizeName(brandName)) return true;
  return aliases.some((alias) => normalizeName(alias) === n);
};

const extractIntention = (promptText: string) => {
  const match = promptText.match(/Intención:\s*([^\(\n]+)\s*\((\d+)%\)/i);
  if (!match) return null;
  return { name: match[1].trim().toLowerCase(), weight: Number(match[2]) };
};

const normalizeIntentionKey = (value: string) => {
  const n = normalizeName(value);
  if (n.includes('urgencia')) return 'urgencia';
  if (n.includes('consideracion')) return 'consideracion';
  if (n.includes('calidad')) return 'calidad';
  if (n.includes('precio')) return 'precio';
  return null;
};

const INTENTION_LABELS: Record<string, string> = {
  urgencia: 'Urgencia',
  consideracion: 'Consideración',
  calidad: 'Calidad',
  precio: 'Precio',
};

interface ComparisonRow {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
}

function buildComparisonSummary(results: CorridasPromptRow[]): ComparisonRow[] {
  const totals = new Map<
    string,
    { name: string; type: string; count: number; positionSum: number }
  >();
  let totalEntries = 0;

  results.forEach((result) => {
    (result.top3Json || []).forEach((entry) => {
      totalEntries += 1;
      const key = `${normalizeName(entry.name)}|${entry.type}`;
      const current = totals.get(key) || {
        name: entry.name,
        type: entry.type,
        count: 0,
        positionSum: 0,
      };
      totals.set(key, {
        ...current,
        count: current.count + 1,
        positionSum: current.positionSum + entry.position,
      });
    });
  });

  return Array.from(totals.values())
    .map((row) => ({
      name: row.name,
      type: row.type,
      appearances: row.count,
      averagePosition: row.count ? row.positionSum / row.count : 0,
      share: totalEntries ? (row.count / totalEntries) * 100 : 0,
    }))
    .sort((a, b) => b.share - a.share);
}

function intentionLabelOf(category: string | null | undefined) {
  const key = normalizeIntentionKey(category ?? '');
  return (key ? INTENTION_LABELS[key] : undefined) ?? category ?? '';
}

function promptLabel(p: CorridasPromptRow) {
  const raw = (p.promptText ?? '').trim();
  if (raw) return raw.length > 110 ? `${raw.slice(0, 110).trim()}…` : raw;
  return `Prompt de ${intentionLabelOf(p.category)}`;
}

function scoreToPct0to100(score: number | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

export function computeInterpretacionAmpliada(
  prompts: CorridasPromptRow[],
  brandName: string,
  brandAliases: string[],
  cleexsScoreHint?: number | null
): { parrafos: string[]; winnerLabels: string[] } {
  const results = prompts;
  const totalPrompts = results.length;

  const parseableCount = results.filter((r) => r.top3Json && r.top3Json.length > 0).length;
  const mentionCount = results.filter((r) =>
    isBrandMentioned(r.responseText ?? '', brandName, brandAliases)
  ).length;
  const top3Count = results.filter((r) =>
    r.top3Json?.some((e) => isBrandEntry(e.name, brandName, brandAliases))
  ).length;
  const top1Count = results.filter((r) =>
    r.top3Json?.some((e) => e.position === 1 && isBrandEntry(e.name, brandName, brandAliases))
  ).length;

  const formatConfidence = totalPrompts ? Math.round((parseableCount / totalPrompts) * 100) : 0;
  const mentionRate = totalPrompts ? Math.round((mentionCount / totalPrompts) * 100) : 0;
  const top3Rate = totalPrompts ? Math.round((top3Count / totalPrompts) * 100) : 0;
  const top1Rate = totalPrompts ? Math.round((top1Count / totalPrompts) * 100) : 0;

  const intentionBuckets: Record<string, { scores: number[]; weight: number }> = {};
  results.forEach((result) => {
    const extracted = extractIntention(result.promptText || '');
    if (!extracted) return;
    const key = normalizeIntentionKey(extracted.name);
    if (!key) return;
    if (!intentionBuckets[key]) intentionBuckets[key] = { scores: [], weight: extracted.weight };
    intentionBuckets[key].scores.push(scoreToPct0to100(result.score));
  });

  const intentionScores = Object.entries(intentionBuckets).map(([key, data]) => ({
    key,
    label: INTENTION_LABELS[key] ?? key,
    score: data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    weight: data.weight,
  }));

  const weightSum = intentionScores.reduce((sum, item) => sum + item.weight, 0) || 1;
  const weightedScore = intentionScores.reduce(
    (sum, item) => sum + item.score * (item.weight / weightSum),
    0
  );
  const fallbackScore =
    results.length > 0
      ? results.reduce((sum, row) => sum + scoreToPct0to100(row.score), 0) / results.length
      : cleexsScoreHint || 0;
  const cleexsScore = intentionScores.length > 0 ? weightedScore : fallbackScore;
  const displayScore = Math.round(cleexsScore || cleexsScoreHint || 0);

  const comparisonSummary = buildComparisonSummary(results);
  const brandRow =
    comparisonSummary.find(
      (row) => row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases)
    ) || null;
  const leaderRow = comparisonSummary[0] || null;
  const leaderGapPts = leaderRow && brandRow ? leaderRow.share - brandRow.share : 0;
  const rank = brandRow ? Math.max(1, comparisonSummary.indexOf(brandRow) + 1) : 0;

  const strongestIntention = [...intentionScores].sort((a, b) => b.score - a.score)[0];
  const weakestIntention = [...intentionScores].sort((a, b) => a.score - b.score)[0];

  const leaderName = leaderRow?.name ?? '';
  const brandIsLeader =
    Boolean(brandRow && leaderRow && normalizeName(brandRow.name) === normalizeName(leaderRow.name));

  const promptBrandSignals = results.map((p) => {
    const brandTop3 = p.top3Json?.find((e) => isBrandEntry(e.name, brandName, brandAliases));
    const mentioned = isBrandMentioned(p.responseText ?? '', brandName, brandAliases);
    const leaderInTop3 = leaderName
      ? p.top3Json?.find((e) => normalizeName(e.name) === normalizeName(leaderName))
      : undefined;
    let strength = 0;
    if (brandTop3?.position === 1) strength = 3;
    else if (brandTop3?.position === 2) strength = 2;
    else if (brandTop3?.position === 3) strength = 1;
    else if (mentioned) strength = 0.5;
    return {
      label: promptLabel(p),
      strength,
    };
  });

  const winnerLabels = [...promptBrandSignals]
    .filter((s) => s.strength > 0)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map((s) => s.label);

  const interpretacionParrafos: string[] = [];
  interpretacionParrafos.push(
    totalPrompts > 0
      ? `En esta corrida simulamos ${totalPrompts} consultas a la inteligencia artificial, como si fueran usuarios reales buscando soluciones. En el ${formatConfidence}% de los casos el modelo devolvió un ranking “Top 3” suficientemente claro para medirte con precisión. El Cleexs Score ${displayScore} (0–100) resume, en promedio, qué tan fuerte es tu presencia cuando la IA recomienda marcas en esas respuestas.`
      : `Todavía no hay prompts ejecutados en esta vista. Cuando la corrida termine, acá vas a ver una lectura automática del Cleexs Score y del ranking frente a competidores.`
  );
  if (totalPrompts > 0) {
    interpretacionParrafos.push(
      brandRow && leaderRow
        ? brandIsLeader
          ? `En la comparativa por cuota en el Top 3, tu marca lidera el conjunto con ${brandRow.share.toFixed(1)}% de apariciones en las recomendaciones listadas. Eso no implica dominio absoluto en todas las consultas: conviene vigilar las intenciones donde un competidor se acerca o te supera en el gráfico de la derecha.`
          : `En la comparativa por cuota en el Top 3, estás en el puesto #${rank} entre ${Math.max(comparisonSummary.length, 1)} marcas detectadas. ${leaderRow.name} concentra ${leaderRow.share.toFixed(1)}% de esas apariciones; tu marca ${brandRow.share.toFixed(1)}%. La brecha de ${leaderGapPts.toFixed(1)} puntos indica cuánto terreno hay que recuperar con contenidos y señales AEO para que la IA te elija con similar frecuencia.`
        : `Aún no alcanzamos un ranking estable: hace falta más Top 3 parseable o más marcas comparables en las respuestas. Revisá que los prompts pidan listados explícitos y que los competidores estén bien definidos en el diagnóstico.`
    );
    interpretacionParrafos.push(
      `Menciones (${mentionRate}%): la IA te nombra en el texto aunque no te rankee. Top 3 (${top3Rate}%): aparecés entre las tres marcas recomendadas. Posición #1 (${top1Rate}%): sos la primera opción citada. Si las menciones son altas pero el Top 3 es bajo, el modelo te reconoce pero no te prioriza: ahí suele faltar prueba social, comparativas y autoridad. Si el Top 3 es alto pero el #1 es bajo, ya estás en carrera y falta empujar diferenciación.`
    );
    if (strongestIntention || weakestIntention) {
      const parts: string[] = [];
      if (strongestIntention) {
        parts.push(
          `Tu lectura más favorable es ${strongestIntention.label} (aprox. ${Math.round(strongestIntention.score)}% en los prompts donde aplica esa intención).`
        );
      }
      if (
        weakestIntention &&
        (!strongestIntention || weakestIntention.key !== strongestIntention.key)
      ) {
        parts.push(
          `El eje con más margen de mejora es ${weakestIntention.label} (aprox. ${Math.round(weakestIntention.score)}%): conviene crear contenidos que respondan explícitamente a esa intención de búsqueda.`
        );
      }
      if (parts.length) interpretacionParrafos.push(parts.join(' '));
    }
    if (formatConfidence < 70) {
      interpretacionParrafos.push(
        `Nota de confianza: solo el ${formatConfidence}% de las respuestas tuvo un formato ideal para extraer el Top 3. Mientras eso suba, las métricas pueden subestimarte o verse “planas”. Ajustar el estilo del prompt del diagnóstico suele mejorar mucho la parseabilidad.`
      );
    }
  }

  return { parrafos: interpretacionParrafos, winnerLabels };
}

export const GLOSARIO_INTERPRETACION_BLOQUES = [
  {
    title: 'Cleexs Score',
    body: 'Promedio 0–100 de tu desempeño en los prompts de esta corrida: combina posición en el Top 3, peso por intención y señales de la respuesta.',
    icon: 'sparkle' as const,
  },
  {
    title: 'Top 3 y ranking',
    body: 'Medimos qué marcas aparecen en las tres primeras recomendaciones del modelo. El ranking compara la frecuencia relativa entre marcas en esas listas.',
    icon: 'medal' as const,
  },
  {
    title: 'Intención de búsqueda',
    body: 'Agrupamos prompts por tipo de necesidad (urgencia, calidad, precio, etc.) cuando el texto del prompt lo indica. Así ves dónde ganás o perdés vs. el líder.',
    icon: 'target' as const,
  },
  {
    title: 'Funnel de presencia',
    body: 'Del total de consultas → menciones de tu marca → entradas al Top 3 → primer puesto. Las conversiones entre etapas muestran dónde se “fuga” la recomendación.',
    icon: 'trending' as const,
  },
];
