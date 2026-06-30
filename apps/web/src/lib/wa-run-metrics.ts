import type {
  DiagnosticAnalysisJson,
  DiagnosticAnalysisSingle,
  PublicDiagnosticPromptResult,
  PublicDiagnosticRunResult,
} from '@/lib/api';
import { isDiagnosticAnalysisGold } from '@/lib/api';

export const WA_INTENTION_LABELS: Record<string, string> = {
  urgencia: 'Urgencia',
  consideracion: 'Consideración',
  calidad: 'Calidad',
  precio: 'Precio',
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

export const isBrandEntry = (entryName: string, brandName: string, aliases: string[]) => {
  const n = normalizeName(entryName);
  if (n === normalizeName(brandName)) return true;
  return aliases.some((a) => normalizeName(a) === n);
};

const isBrandMentioned = (text: string, brandName: string, aliases: string[]) => {
  if (!text) return false;
  if (normalizeName(text).includes(normalizeName(brandName))) return true;
  return aliases.some((alias) => normalizeName(text).includes(normalizeName(alias)));
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

type ComparisonRow = {
  name: string;
  type: string;
  appearances: number;
  share: number;
};

function buildComparisonSummary(results: PublicDiagnosticPromptResult[]): ComparisonRow[] {
  const totals = new Map<string, { name: string; type: string; count: number }>();
  let totalEntries = 0;

  results.forEach((result) => {
    (result.top3Json || []).forEach((entry) => {
      totalEntries += 1;
      const key = `${normalizeName(entry.name)}|${entry.type}`;
      const current = totals.get(key) || { name: entry.name, type: entry.type, count: 0 };
      totals.set(key, { ...current, count: current.count + 1 });
    });
  });

  return Array.from(totals.values())
    .map((row) => ({
      name: row.name,
      type: row.type,
      appearances: row.count,
      share: totalEntries ? (row.count / totalEntries) * 100 : 0,
    }))
    .sort((a, b) => b.share - a.share);
}

export type WaIntentionScore = { key: string; label: string; score: number };

export type WaRunMetrics = {
  displayScore: number;
  totalPrompts: number;
  formatConfidence: number;
  mentionRate: number;
  top3Rate: number;
  top1Rate: number;
  parseableCount: number;
  mentionCount: number;
  top3Count: number;
  top1Count: number;
  intentionScores: WaIntentionScore[];
  ranking: ComparisonRow[];
  brandRank: number | null;
  brandTop3Share: number;
  convMentionToTop3: number;
  convTop3ToFirst: number;
};

export function computeWaRunMetrics(
  runResult: PublicDiagnosticRunResult,
  analysisJson?: DiagnosticAnalysisJson | null
): WaRunMetrics {
  const results = runResult.promptResults || [];
  const brandName = runResult.brandName;
  const brandAliases = runResult.brandAliases || [];
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
    intentionBuckets[key].scores.push((result.score || 0) * 100);
  });

  let intentionScores: WaIntentionScore[] = Object.entries(intentionBuckets).map(([key, data]) => ({
    key,
    label: WA_INTENTION_LABELS[key] ?? key,
    score: data.scores.length ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
  }));

  const single: DiagnosticAnalysisSingle | null = analysisJson
    ? isDiagnosticAnalysisGold(analysisJson)
      ? analysisJson.analisisOpenAI
      : analysisJson
    : null;

  if (isDiagnosticAnalysisGold(analysisJson) && analysisJson.metrics?.intentionScores?.length) {
    intentionScores = analysisJson.metrics.intentionScores.map((i) => ({
      key: normalizeIntentionKey(i.label) ?? i.label.toLowerCase(),
      label: i.label,
      score: Math.round(i.score),
    }));
  } else if (single?.comentariosPorIntencion?.length) {
    intentionScores = single.comentariosPorIntencion
      .map((c) => {
        const key = normalizeIntentionKey(c.intencion) ?? c.intencion;
        return {
          key,
          label: WA_INTENTION_LABELS[key] ?? c.intencion,
          score: Math.round(c.score),
        };
      })
      .filter((x) => x.key);
  }

  intentionScores = [...intentionScores].sort((a, b) => b.score - a.score);

  const weightSum =
    Object.values(intentionBuckets).reduce((s, b) => s + b.weight, 0) ||
    intentionScores.reduce((s, i) => s + (i.score > 0 ? 25 : 0), 0) ||
    1;
  const cleexsScoreByIntention = Object.entries(intentionBuckets).reduce((s, [key, data]) => {
    const avg = data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0;
    return s + avg * (data.weight / weightSum);
  }, 0);
  const fallbackScore =
    results.length > 0
      ? results.reduce((sum, r) => sum + (r.score || 0) * 100, 0) / results.length
      : runResult.cleexsScore;
  const displayScore = Math.round(
    intentionScores.length > 0 && Object.keys(intentionBuckets).length > 0
      ? cleexsScoreByIntention
      : runResult.cleexsScore ?? fallbackScore
  );

  const ranking = buildComparisonSummary(results);
  const brandIdx = ranking.findIndex(
    (r) => r.type === 'brand' || isBrandEntry(r.name, brandName, brandAliases)
  );
  const brandRow = brandIdx >= 0 ? ranking[brandIdx] : null;

  const convMentionToTop3 = mentionCount ? Math.round((top3Count / mentionCount) * 100) : 0;
  const convTop3ToFirst = top3Count ? Math.round((top1Count / top3Count) * 100) : 0;

  return {
    displayScore,
    totalPrompts,
    formatConfidence,
    mentionRate,
    top3Rate,
    top1Rate,
    parseableCount,
    mentionCount,
    top3Count,
    top1Count,
    intentionScores,
    ranking: ranking.slice(0, 6),
    brandRank: brandIdx >= 0 ? brandIdx + 1 : null,
    brandTop3Share: brandRow?.share ?? 0,
    convMentionToTop3,
    convTop3ToFirst,
  };
}

export function shortBrandName(name: string, max = 22): string {
  const cleaned = name.replace(/\s*\([^)]+\)\s*$/, '').trim() || name;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}
