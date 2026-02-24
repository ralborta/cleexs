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
  comentariosPorIntencion: Array<{ intencion: string; comentario: string; score: number }>;
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

function buildContextForAI(ctx: RunContext): string {
  const parts: string[] = [
    `Marca: ${ctx.brandName}`,
    `Industria: ${ctx.industry || 'General'}`,
    `Cleexs Score total: ${ctx.cleexsScore}`,
    `Competidores: ${ctx.competitors.join(', ') || 'ninguno'}`,
    '',
    'Scores por intención:',
    ...ctx.intentionScores.map(
      (i) => `- ${i.label}: ${i.score.toFixed(0)} (peso ${i.weight}%)`
    ),
    '',
    'Resumen de apariciones en Top 3:',
    ...ctx.comparisonSummary.slice(0, 10).map(
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

  const systemPrompt = `Sos un analista de marketing y posicionamiento de marcas. Analizá los datos del diagnóstico y generá un informe en español. Respondé ÚNICAMENTE con un JSON válido, sin markdown ni texto extra. El JSON debe tener exactamente esta estructura:
{
  "resumenEjecutivo": "1-2 párrafos interpretando el Cleexs Score y la situación general de la marca",
  "comentariosPorIntencion": [
    { "intencion": "Urgencia", "comentario": "breve comentario", "score": 67 },
    { "intencion": "Calidad", "comentario": "breve comentario", "score": 33 },
    { "intencion": "Precio", "comentario": "breve comentario", "score": 33 }
  ],
  "fortalezas": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "debilidades": ["debilidad 1", "debilidad 2"],
  "sugerencias": ["sugerencia concreta 1", "sugerencia 2", "sugerencia 3"],
  "proximosPasos": ["próximo paso 1", "paso 2", "paso 3", "paso 4", "paso 5"]
}

Reglas: comentariosPorIntencion debe tener las mismas intenciones que aparecen en los datos. Los scores deben coincidir con los datos. Fortalezas, debilidades, sugerencias y próximos pasos deben ser concretos y accionables. Máximo 5 ítems por cada array. Todo en español.`;

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
        max_tokens: 1500,
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
      comentariosPorIntencion: Array.isArray(parsed.comentariosPorIntencion)
        ? parsed.comentariosPorIntencion.map((c) => ({
            intencion: String(c.intencion || ''),
            comentario: String(c.comentario || ''),
            score: Number(c.score) || 0,
          }))
        : [],
      fortalezas: Array.isArray(parsed.fortalezas) ? parsed.fortalezas.map(String).filter(Boolean) : [],
      debilidades: Array.isArray(parsed.debilidades) ? parsed.debilidades.map(String).filter(Boolean) : [],
      sugerencias: Array.isArray(parsed.sugerencias) ? parsed.sugerencias.map(String).filter(Boolean) : [],
      proximosPasos: Array.isArray(parsed.proximosPasos) ? parsed.proximosPasos.map(String).filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}
