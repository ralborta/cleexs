/**
 * Genera análisis detallado con IA para el resultado del diagnóstico público.
 * Freemium: solo OpenAI (ChatGPT). Gold: OpenAI + Gemini + perspectiva combinada.
 */

import type { Run, PromptResult, PRIAReport } from '@prisma/client';
import {
  generateWithOpenAI,
  generateWithGemini,
  generatePerspectivaAmbos,
  type DiagnosticAnalysisSingle,
} from './diagnostic-analysis-providers';

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

/** Formato Freemium: un solo análisis (OpenAI) */
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

/** Formato Gold: OpenAI + Gemini + síntesis. Incluye métricas para contexto. */
export interface DiagnosticAnalysisGold {
  tier: 'gold';
  metrics: {
    cleexsScore: number;
    intentionScores: Array<{ label: string; score: number; weight: number }>;
    comparisonSummary: Array<{ name: string; type: string; appearances: number; share: number }>;
  };
  analisisOpenAI: DiagnosticAnalysisSingle;
  analisisGemini: DiagnosticAnalysisSingle;
  perspectivaAmbos: string;
}

export type DiagnosticAnalysisOutput = DiagnosticAnalysis | DiagnosticAnalysisGold;

function isGoldFormat(a: unknown): a is DiagnosticAnalysisGold {
  return typeof a === 'object' && a !== null && (a as { tier?: string }).tier === 'gold';
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

export async function generateDiagnosticAnalysis(
  ctx: RunContext,
  tier: 'freemium' | 'gold' = 'freemium'
): Promise<DiagnosticAnalysisOutput | null> {
  const contextText = buildContextForAI(ctx);

  if (tier === 'freemium') {
    const analysis = await generateWithOpenAI(contextText);
    return analysis;
  }

  // Gold: OpenAI + Gemini + perspectiva combinada
  const [openaiAnalysis, geminiAnalysis] = await Promise.all([
    generateWithOpenAI(contextText),
    generateWithGemini(contextText),
  ]);

  if (!openaiAnalysis) return null;
  if (!geminiAnalysis) {
    return openaiAnalysis as DiagnosticAnalysis;
  }

  const perspectivaAmbos = await generatePerspectivaAmbos(
    contextText,
    openaiAnalysis,
    geminiAnalysis
  );

  const goldOutput: DiagnosticAnalysisGold = {
    tier: 'gold',
    metrics: {
      cleexsScore: ctx.cleexsScore,
      intentionScores: ctx.intentionScores.map((i) => ({
        label: i.label,
        score: i.score,
        weight: i.weight,
      })),
      comparisonSummary: ctx.comparisonSummary.slice(0, 10).map((r) => ({
        name: r.name,
        type: r.type,
        appearances: r.appearances,
        share: r.share,
      })),
    },
    analisisOpenAI: openaiAnalysis,
    analisisGemini: geminiAnalysis,
    perspectivaAmbos: perspectivaAmbos || 'Ambas perspectivas coinciden en la relevancia del Cleexs Score para evaluar el posicionamiento en IA.',
  };

  return goldOutput;
}
