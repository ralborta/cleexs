/**
 * Genera análisis detallado con IA para el resultado del diagnóstico público.
 * Fase 2: resumen ejecutivo, comentarios por intención, fortalezas, debilidades, sugerencias, próximos pasos.
 */

import type { Run, PromptResult, PRIAReport } from '@prisma/client';

const normalizeName = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

function extractIntention(promptText: string): { name: string; weight: number } | null {
  const match = promptText.match(/Intención:\s*([^\(\n]+)\s*\((\d+)%\)/i);
  if (!match) return null;
  return { name: match[1].trim().toLowerCase(), weight: Number(match[2]) };
}

function normalizeIntentionKey(value: string): string | null {
  const n = normalizeName(value);
  if (n.includes('urgencia')) return 'urgencia';
  if (n.includes('consideracion')) return 'consideracion';
  if (n.includes('calidad')) return 'calidad';
  if (n.includes('precio')) return 'precio';
  return null;
}

const INTENTION_LABELS: Record<string, string> = {
  urgencia: 'Urgencia',
  consideracion: 'Consideración',
  calidad: 'Calidad',
  precio: 'Precio',
};

export interface RunContextInput {
  run: Run & {
    promptResults: (PromptResult & { prompt: { promptText: string | null } | null })[];
    brand: { name: string; competitors: { name: string }[] };
  };
  priaReport: PRIAReport | null;
  industry: string;
}

export function buildRunContext(input: RunContextInput): RunContext {
  const { run, priaReport, industry } = input;
  const cleexsScore = priaReport?.priaTotal ?? 0;
  const results = run.promptResults;
  const brandName = run.brand.name;
  const competitors = run.brand.competitors.map((c) => c.name);

  const intentionBuckets: Record<string, { scores: number[]; weight: number }> = {};
  results.forEach((r) => {
    const extracted = extractIntention(r.prompt?.promptText || '');
    if (!extracted) return;
    const key = normalizeIntentionKey(extracted.name);
    if (!key) return;
    if (!intentionBuckets[key]) intentionBuckets[key] = { scores: [], weight: extracted.weight };
    intentionBuckets[key].scores.push((r.score || 0) * 100);
  });
  const intentionScores = Object.entries(intentionBuckets).map(([key, data]) => ({
    key,
    label: INTENTION_LABELS[key] || key,
    score: data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    weight: data.weight,
  }));

  const totals = new Map<string, { name: string; type: string; count: number; positionSum: number; sampleReason?: string }>();
  let totalEntries = 0;
  results.forEach((r) => {
    const top3 = (r.top3Json as Array<{ name: string; type: string; position: number; reason?: string }>) || [];
    top3.forEach((entry) => {
      totalEntries += 1;
      const key = `${normalizeName(entry.name)}|${entry.type}`;
      const current = totals.get(key) || { name: entry.name, type: entry.type, count: 0, positionSum: 0 };
      totals.set(key, {
        ...current,
        count: current.count + 1,
        positionSum: current.positionSum + entry.position,
        sampleReason: current.sampleReason || entry.reason,
      });
    });
  });
  const comparisonSummary = Array.from(totals.values())
    .map((row) => ({
      name: row.name,
      type: row.type,
      appearances: row.count,
      averagePosition: row.count ? row.positionSum / row.count : 0,
      share: totalEntries ? (row.count / totalEntries) * 100 : 0,
      sampleReason: row.sampleReason?.replace(/\*+/g, '').trim(),
    }))
    .sort((a, b) => b.appearances - a.appearances);

  return {
    brandName,
    industry: industry || 'General',
    cleexsScore,
    competitors,
    intentionScores,
    comparisonSummary,
  };
}

export interface DiagnosticAnalysis {
  resumenEjecutivo: string;
  contextoCompetitivo?: string;
  comentariosPorIntencion: Array<{
    intencion: string;
    score: number;
    comentario: string;
    interpretacion?: string;
  }>;
  aspectosAdicionales?: string;
  fortalezas: string[];
  debilidades: string[];
  sugerencias: string[];
  proximosPasos: string[];
}

interface RunContext {
  brandName: string;
  industry: string;
  cleexsScore: number;
  competitors: string[];
  intentionScores: Array<{ key: string; label: string; score: number; weight: number }>;
  comparisonSummary: Array<{
    name: string;
    type: string;
    appearances: number;
    averagePosition: number;
    share: number;
    sampleReason?: string;
  }>;
}

const INTENTION_DESCRIPTIONS: Record<string, string> = {
  urgencia:
    'Mide cuán bien la IA recomienda la marca cuando el usuario busca algo urgente o inmediato (ej. delivery, reserva ahora, respuesta rápida).',
  consideracion:
    'Mide cuán bien la IA recomienda la marca cuando el usuario está evaluando con tiempo (ej. educación, banco, seguro, decisión a mediano plazo).',
  calidad:
    'Mide el posicionamiento cuando el usuario prioriza la mejor calidad en el mercado.',
  precio:
    'Mide cómo aparece la marca cuando el usuario busca buen precio, valor o relación calidad-precio.',
};

function buildContextForAI(ctx: RunContext): string {
  const parts: string[] = [
    `Marca: ${ctx.brandName}`,
    `Industria: ${ctx.industry || 'General'}`,
    `Cleexs Score total: ${ctx.cleexsScore} (0-100, mayor = mejor posicionamiento en IA)`,
    `Competidores evaluados: ${ctx.competitors.join(', ') || 'ninguno'}`,
    '',
    'Scores por intención de búsqueda (qué mide cada una):',
    ...ctx.intentionScores.map((i) => {
      const desc = INTENTION_DESCRIPTIONS[i.key];
      return `- ${i.label}: ${i.score.toFixed(0)} (peso ${i.weight}%)${desc ? ` — ${desc}` : ''}`;
    }),
    '',
    'Resumen de apariciones en Top 3 de las IAs:',
    ...ctx.comparisonSummary.slice(0, 15).map(
      (r) =>
        `- ${r.name} (${r.type}): ${r.appearances} apariciones, posición media ${r.averagePosition.toFixed(2)}, ${r.share.toFixed(1)}% del Top 3${r.sampleReason ? `. Motivo ejemplo: ${r.sampleReason}` : ''}`
    ),
  ];
  return parts.join('\n');
}

export async function generateDiagnosticAnalysis(ctx: RunContext): Promise<DiagnosticAnalysis | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const contextText = buildContextForAI(ctx);

  const systemPrompt = `Sos un analista senior de marketing digital y posicionamiento de marcas ante la IA. Tu rol es explicar de forma CLARA y EXTENSA los resultados del diagnóstico para que cualquier persona entienda qué significan y qué hacer.

IMPORTANTE: Escribí de forma explicativa y didáctica. Cada sección debe ser extensa y clara. Evitá frases cortas o telegráficas. El receptor debe entender el contexto, el significado de cada métrica y las implicaciones prácticas.

Generá un informe ÚNICAMENTE como JSON válido, sin markdown ni texto extra. Estructura:

{
  "resumenEjecutivo": "3-4 párrafos extensos. Explicá: qué mide el Cleexs Score, qué implica el valor obtenido para esta marca, cómo se compara con un posicionamiento ideal, y qué dice esto sobre cómo las IAs (ChatGPT, etc.) recomiendan a la marca vs competidores. Usá lenguaje accesible.",
  "contextoCompetitivo": "1-2 párrafos explicando cómo se posiciona la marca frente a sus competidores en las respuestas de las IAs. Mencioná qué competidores aparecen más, en qué contextos, y qué patrones ves. Sed concreto con los datos del Top 3.",
  "comentariosPorIntencion": [
    {
      "intencion": "Urgencia",
      "score": 67,
      "comentario": "2-3 oraciones explicando qué significa este score: cómo la IA recomienda a la marca cuando el usuario busca algo urgente. Contextualizá con la industria.",
      "interpretacion": "1 párrafo adicional sobre implicaciones prácticas: qué implica para la estrategia, en qué momento de búsqueda la marca está mejor o peor posicionada."
    }
  ],
  "aspectosAdicionales": "1-2 párrafos sobre otros aspectos relevantes: consistencia de aparición, visibilidad general, defensibilidad ante preguntas tipo '¿hay algo mejor que X?', patrones que notás en los motivos dados por la IA.",
  "fortalezas": ["Cada ítem: oración completa y explicativa (no solo 'Buena visibilidad' sino 'La marca tiene buena visibilidad en búsquedas de X porque...'). 4-6 ítems."],
  "debilidades": ["Idem: oraciones completas que expliquen el problema y por qué importa. 4-6 ítems."],
  "sugerencias": ["Cada una: sugerencia concreta + breve explicación del porqué y el impacto esperado. 4-6 ítems."],
  "proximosPasos": ["Pasos numerables y accionables, cada uno explicado en 1-2 oraciones. 5-7 pasos."]
}

REGLAS:
- comentariosPorIntencion: incluir EXACTAMENTE las intenciones que aparecen en los datos (Urgencia, Consideración, Calidad, Precio según corresponda). Scores deben coincidir con los datos. comentario + interpretacion deben ser extensos y claros.
- Todos los textos en español, tono profesional pero accesible.
- No uses markdown (**) dentro de los strings.
- Sed específico con la marca y la industria, no genérico.`;

  const userPrompt = `Analizá este diagnóstico y generá el informe JSON:\n\n${contextText}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 4500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const json = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) throw new Error(json?.error?.message || 'OpenAI error');

    const content = json?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned) as DiagnosticAnalysis;

    if (!parsed.resumenEjecutivo || !Array.isArray(parsed.fortalezas)) {
      return null;
    }

    return {
      resumenEjecutivo: String(parsed.resumenEjecutivo || ''),
      contextoCompetitivo:
        typeof parsed.contextoCompetitivo === 'string' ? parsed.contextoCompetitivo.trim() : undefined,
      comentariosPorIntencion: Array.isArray(parsed.comentariosPorIntencion)
        ? parsed.comentariosPorIntencion.map((c) => ({
            intencion: String(c.intencion || ''),
            comentario: String(c.comentario || ''),
            score: Number(c.score) || 0,
            interpretacion:
              typeof (c as { interpretacion?: string }).interpretacion === 'string'
                ? (c as { interpretacion?: string }).interpretacion!.trim()
                : undefined,
          }))
        : [],
      aspectosAdicionales:
        typeof parsed.aspectosAdicionales === 'string' ? parsed.aspectosAdicionales.trim() : undefined,
      fortalezas: Array.isArray(parsed.fortalezas) ? parsed.fortalezas.map(String).filter(Boolean) : [],
      debilidades: Array.isArray(parsed.debilidades) ? parsed.debilidades.map(String).filter(Boolean) : [],
      sugerencias: Array.isArray(parsed.sugerencias) ? parsed.sugerencias.map(String).filter(Boolean) : [],
      proximosPasos: Array.isArray(parsed.proximosPasos) ? parsed.proximosPasos.map(String).filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}
