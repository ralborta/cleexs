'use client';

import { useState } from 'react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PublicDiagnosticRunResult, PublicDiagnosticPromptResult, PublicDiagnosticTrendPoint } from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  Zap,
  Award,
  DollarSign,
  BarChart3,
  CheckCircle2,
  AtSign,
  TrendingUp,
  Trophy,
  Info,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

type DetailCardId = 'ranking' | 'cleexs' | 'intention' | 'metrics' | 'comparisons';

function DetailPopup({
  title,
  icon,
  body,
  examplePrompt,
  totalPrompts,
  onClose,
}: {
  title: string;
  icon?: React.ReactNode;
  body: React.ReactNode;
  examplePrompt?: string;
  totalPrompts?: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 ring-1 ring-slate-200">
              <CleexsMark className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {icon && <span className="flex shrink-0 text-slate-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
              <h3 className="truncate text-lg font-bold text-slate-900">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700">
          <div className="space-y-4">{body}</div>
          {examplePrompt && (
            <div className="mt-6 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="font-medium text-slate-700">
                Ejemplo de uno de los prompts del análisis
                {totalPrompts != null && (
                  <span className="ml-1 font-normal text-slate-500">
                    (el análisis utiliza {totalPrompts} prompts distintos que exploran distintas intenciones y contextos)
                  </span>
                )}
              </p>
              <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-600 border border-slate-100">
                {examplePrompt}
              </pre>
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <ChevronUp className="h-4 w-4" />
            Volver al resumen
          </button>
        </div>
      </div>
    </div>
  );
}

function CardDetailButton({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 pr-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      >
        <span className="flex items-center gap-1.5">
          <Info className="h-4 w-4 text-slate-400" />
          Detalle
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

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
  return aliases.some((a) => normalizeName(text).includes(normalizeName(a)));
};

const isBrandEntry = (entryName: string, brandName: string, aliases: string[]) => {
  const n = normalizeName(entryName);
  if (n === normalizeName(brandName)) return true;
  return aliases.some((a) => normalizeName(a) === n);
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

const INTENTION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  urgencia: { label: 'Urgencia', icon: <Zap className="h-4 w-4 text-amber-500" /> },
  consideracion: { label: 'Consideración', icon: <BarChart3 className="h-4 w-4 text-slate-500" /> },
  calidad: { label: 'Calidad', icon: <Award className="h-4 w-4 text-violet-500" /> },
  precio: { label: 'Precio', icon: <DollarSign className="h-4 w-4 text-emerald-500" /> },
};

interface ComparisonRow {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
  sampleReason?: string;
}

function buildComparisonSummary(results: PublicDiagnosticPromptResult[]): ComparisonRow[] {
  const sanitizeReason = (r?: string) => {
    const s = (r || '').replace(/\*+/g, '').trim();
    return s.length >= 2 ? s : undefined;
  };
  const totals = new Map<
    string,
    { name: string; type: string; count: number; positionSum: number; sampleReason?: string }
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
      const reason = sanitizeReason(entry.reason) || sanitizeReason(current.sampleReason);
      totals.set(key, {
        ...current,
        count: current.count + 1,
        positionSum: current.positionSum + entry.position,
        sampleReason: reason || current.sampleReason,
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
      sampleReason: row.sampleReason,
    }))
    .sort((a, b) => b.appearances - a.appearances);
}

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Gauge semicircular 0–100 con zonas roja/amarilla/verde */
function GaugeScore({ value, size = 140 }: { value: number; size?: number }) {
  const v = Math.min(100, Math.max(0, value));
  const r = size / 2 - 8;
  const stroke = 12;
  const circumference = Math.PI * r;
  const offset = circumference - (v / 100) * circumference;
  const color = v >= 70 ? '#22c55e' : v >= 45 ? '#eab308' : '#ef4444';
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`} className="overflow-visible">
        <defs>
          <linearGradient id="gaugeBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="45%" stopColor="#eab308" />
            <stop offset="70%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path
          d={`M ${8} ${size / 2} A ${r} ${r} 0 0 1 ${size - 8} ${size / 2}`}
          fill="none"
          stroke="url(#gaugeBg)"
          strokeWidth={stroke}
          strokeLinecap="round"
          opacity={0.25}
        />
        <path
          d={`M ${8} ${size / 2} A ${r} ${r} 0 0 1 ${size - 8} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span className="text-2xl font-bold tabular-nums text-slate-800">{Math.round(v)}</span>
      </div>
    </div>
  );
}

/** Funnel: Menciones → Top 3 → #1 */
function FunnelSteps({ mention, top3, top1 }: { mention: number; top3: number; top1: number }) {
  const steps = [
    { label: 'Menciones', value: mention, gradient: 'from-slate-400 to-slate-500' },
    { label: 'Top 3', value: top3, gradient: 'from-sky-400 to-sky-600' },
    { label: 'Posición #1', value: top1, gradient: 'from-violet-500 to-violet-700' },
  ];
  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs font-semibold text-slate-700">{s.label}</span>
          <div className="flex-1 overflow-hidden rounded-lg bg-slate-100 shadow-inner">
            <div
              className={cn('h-7 rounded-lg bg-gradient-to-r transition-all duration-700', s.gradient)}
              style={{ width: `${Math.min(100, s.value)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-slate-800">{s.value}%</span>
        </div>
      ))}
    </div>
  );
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'alto';
  if (score >= 45) return 'medio';
  return 'bajo';
}

export function ReporteModerno({
  runResult,
  brandName,
  trendData,
  runResultChatGPT,
  runResultGemini,
}: {
  runResult: PublicDiagnosticRunResult;
  brandName: string;
  trendData?: PublicDiagnosticTrendPoint[];
  runResultChatGPT?: PublicDiagnosticRunResult;
  runResultGemini?: PublicDiagnosticRunResult;
}) {
  const [detailOpen, setDetailOpen] = useState<DetailCardId | null>(null);
  const [resumenExpanded, setResumenExpanded] = useState<Set<string>>(new Set());
  const toggleResumen = (id: string) => {
    setResumenExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const closeDetail = () => setDetailOpen(null);

  const results = runResult.promptResults || [];
  const brandAliases = runResult.brandAliases || [];
  const totalPrompts = results.length;
  const examplePromptText = results[0]?.promptText ?? undefined;

  const parseableCount = results.filter((r) => r.top3Json && r.top3Json.length > 0).length;
  const mentionCount = results.filter((r) => isBrandMentioned(r.responseText ?? '', brandName, brandAliases)).length;
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
  const intentionScores = Object.entries(intentionBuckets).map(([key, data]) => ({
    key,
    score: data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    weight: data.weight,
  }));
  const weightSum = intentionScores.reduce((s, i) => s + i.weight, 0) || 1;
  const cleexsScoreByIntention = intentionScores.reduce(
    (s, i) => s + i.score * (i.weight / weightSum),
    0
  );
  const fallbackScore =
    results.length > 0
      ? results.reduce((s, r) => s + (r.score || 0) * 100, 0) / results.length
      : 0;
  const cleexsScore = intentionScores.length > 0 ? cleexsScoreByIntention : fallbackScore;
  const displayScore = (cleexsScore || runResult.cleexsScore) ?? 0;

  const comparisonSummary = buildComparisonSummary(results);
  const leaderRow = comparisonSummary[0];
  const secondRow = comparisonSummary[1];
  const brandRow = comparisonSummary.find((r) => r.type === 'brand' || isBrandEntry(r.name, brandName, brandAliases));
  const competitorsUsed =
    runResult.competitors?.length > 0
      ? runResult.competitors
      : Array.from(new Set(comparisonSummary.filter((r) => r.type === 'competitor').map((r) => r.name)));
  const competitorLeader = comparisonSummary.find((r) => r.type === 'competitor');
  const strongestIntention = [...intentionScores].sort((a, b) => b.score - a.score)[0];
  const weakestIntention = [...intentionScores].sort((a, b) => a.score - b.score)[0];
  const metricsAvg = Math.round((formatConfidence + mentionRate + top3Rate + top1Rate) / 4);

  // Completitud: % de entradas Top 3 que tienen motivo/justificación
  let totalEntries = 0;
  let entriesWithReason = 0;
  results.forEach((r) => {
    (r.top3Json || []).forEach((e) => {
      totalEntries += 1;
      if (e.reason && e.reason.trim().length >= 3) entriesWithReason += 1;
    });
  });
  const completenessPct = totalEntries ? Math.round((entriesWithReason / totalEntries) * 100) : 0;

  // Consistencia: cuando hay ChatGPT y Gemini, % de prompts donde coinciden en #1
  let consistencyPct = 0;
  let consistencyCount = 0;
  let consistencyTotal = 0;
  if (runResultChatGPT && runResultGemini) {
    const prA = runResultChatGPT.promptResults || [];
    const prB = runResultGemini.promptResults || [];
    const minLen = Math.min(prA.length, prB.length);
    for (let i = 0; i < minLen; i++) {
      const topA = prA[i]?.top3Json || [];
      const topB = prB[i]?.top3Json || [];
      const brand1A = topA.find((e) => e.position === 1)?.name;
      const brand1B = topB.find((e) => e.position === 1)?.name;
      if (brand1A && brand1B) {
        consistencyTotal += 1;
        if (normalizeName(brand1A) === normalizeName(brand1B)) consistencyCount += 1;
      }
    }
    consistencyPct = consistencyTotal ? Math.round((consistencyCount / consistencyTotal) * 100) : 0;
  }

  const metricsBase = [
    { label: 'Confianza de formato', value: formatConfidence, detail: `${parseableCount}/${totalPrompts} parseable`, icon: CheckCircle2 },
    { label: 'Mención de marca', value: mentionRate, detail: `${mentionCount}/${totalPrompts} respuestas`, icon: AtSign },
    { label: 'Aparición en Top 3', value: top3Rate, detail: `${top3Count}/${totalPrompts} en Top 3`, icon: TrendingUp },
    { label: 'Posición #1', value: top1Rate, detail: `${top1Count}/${totalPrompts} en primer lugar`, icon: Trophy },
    { label: 'Profundidad de respuesta', value: completenessPct, detail: `${entriesWithReason}/${totalEntries} con motivo`, icon: Info },
  ];
  const metricsConsistency =
    runResultChatGPT && runResultGemini
      ? [{ label: 'Consistencia ChatGPT↔Gemini', value: consistencyPct, detail: `${consistencyCount}/${consistencyTotal} prompts coinciden en #1`, icon: BarChart3 }]
      : [];
  const metrics = [...metricsBase, ...metricsConsistency];
  const bottleneckMetric = [...metrics].sort((a, b) => a.value - b.value)[0];

  // Matriz por intención: intención → marca → % share en esos prompts
  const intentionMatrix: Record<string, Record<string, number>> = {};
  results.forEach((r) => {
    const extracted = extractIntention(r.promptText || '');
    const key = extracted ? normalizeIntentionKey(extracted.name) : null;
    if (!key) return;
    if (!intentionMatrix[key]) intentionMatrix[key] = {};
    (r.top3Json || []).forEach((e) => {
      const n = e.name.trim();
      if (!n) return;
      intentionMatrix[key]![n] = (intentionMatrix[key]![n] ?? 0) + 1;
    });
  });
  const promptsPerIntention: Record<string, number> = {};
  Object.keys(intentionBuckets).forEach((k) => {
    promptsPerIntention[k] = intentionBuckets[k]!.scores.length * 3;
  });
  const intentionMatrixPct: Record<string, Record<string, number>> = {};
  Object.keys(intentionMatrix).forEach((intKey) => {
    const total = promptsPerIntention[intKey] || 1;
    intentionMatrixPct[intKey] = {};
    Object.keys(intentionMatrix[intKey]!).forEach((brand) => {
      intentionMatrixPct[intKey]![brand] = (intentionMatrix[intKey]![brand]! / total) * 100;
    });
  });

  // Datos para comparativo directo (barras)
  const topForBars = comparisonSummary.slice(0, 6);
  const barData = topForBars.map((row) => ({
    name: isBrandEntry(row.name, brandName, brandAliases) ? 'Tu marca' : row.name,
    value: row.share,
    isBrand: row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases),
  }));

  // Resumen ejecutivo y 3 acciones prioritarias (derivado de datos)
  const gapToLeader = competitorLeader && brandRow ? Math.max(0, (competitorLeader.share || 0) - (brandRow.share || 0)) : 0;
  const resumenEjecutivo =
    brandRow && leaderRow
      ? `${brandName} tiene ${brandRow.share.toFixed(1)}% de presencia en el Top 3 de las recomendaciones de IA.`
        + (leaderRow.name !== brandRow.name ? ` El líder es ${leaderRow.name} con ${leaderRow.share.toFixed(1)}%.` : '')
        + ` Cleexs Score: ${Math.round(displayScore)} (nivel ${scoreLabel(displayScore)}).`
        + (strongestIntention && weakestIntention
          ? ` Mejor desempeño en ${INTENTION_LABELS[strongestIntention.key]?.label ?? strongestIntention.key} (${Math.round(strongestIntention.score)}%), menor en ${INTENTION_LABELS[weakestIntention.key]?.label ?? weakestIntention.key} (${Math.round(weakestIntention.score)}%).`
          : '')
      : `${brandName}: no hay suficientes datos para un resumen. Completá más prompts para obtener métricas comparables.`;

  const accionesPrioritarias: string[] = [];
  if (bottleneckMetric && bottleneckMetric.value < 70) {
    accionesPrioritarias.push(`Mejorar ${bottleneckMetric.label.toLowerCase()} (actual: ${bottleneckMetric.value}%)`);
  }
  if (weakestIntention && weakestIntention.score < 50) {
    accionesPrioritarias.push(`Reforzar presencia en consultas de ${INTENTION_LABELS[weakestIntention.key]?.label ?? weakestIntention.key} (${Math.round(weakestIntention.score)}%)`);
  }
  if (gapToLeader > 0 && competitorLeader) {
    accionesPrioritarias.push(`Reducir distancia con ${competitorLeader.name} (brecha actual: ${gapToLeader.toFixed(1)} pts en Top 3)`);
  }
  if (accionesPrioritarias.length === 0) {
    accionesPrioritarias.push('Mantener el nivel actual de posicionamiento');
    if (top1Rate < 50) accionesPrioritarias.push('Aumentar apariciones en posición #1');
  }
  const top3Acciones = accionesPrioritarias.slice(0, 3);

  // Datos para Radar (Tu marca vs líder por intención)
  const leaderName = leaderRow?.name ?? '';
  const radarData =
    intentionScores.length > 0 && Object.keys(intentionMatrixPct).length > 0
      ? Object.keys(intentionMatrixPct).map((intKey) => {
          const meta = INTENTION_LABELS[intKey];
          const brandKey = Object.keys(intentionMatrixPct[intKey]!).find((k) => isBrandEntry(k, brandName, brandAliases));
          const brandVal = brandKey ? intentionMatrixPct[intKey]![brandKey]! : 0;
          const leaderVal = leaderName ? (intentionMatrixPct[intKey]![leaderName] ?? 0) : 0;
          return {
            intencion: meta?.label ?? intKey,
            tuMarca: Math.round(brandVal),
            lider: Math.round(leaderVal),
            fullMark: 100,
          };
        })
      : [];

  // Datos para Bubble (X=% Top 3, Y=% #1 por marca)
  const top1ByBrand = new Map<string, number>();
  results.forEach((r) => {
    (r.top3Json || []).forEach((e) => {
      if (e.position === 1 && e.name) {
        const key = normalizeName(e.name);
        top1ByBrand.set(key, (top1ByBrand.get(key) ?? 0) + 1);
      }
    });
  });
  const bubbleData = comparisonSummary.slice(0, 6).map((row) => {
    const isBrand = row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases);
    const count1 = isBrand ? results.filter((r) => r.top3Json?.some((e) => e.position === 1 && isBrandEntry(e.name, brandName, brandAliases))).length : (top1ByBrand.get(normalizeName(row.name)) ?? 0);
    const pct1 = totalPrompts ? (count1 / totalPrompts) * 100 : 0;
    return {
      name: isBrand ? 'Tu marca' : row.name,
      x: row.share,
      y: pct1,
      z: row.appearances,
      isBrand,
    };
  });

  // Datos para Treemap (cuota de voz)
  const treemapData = comparisonSummary.slice(0, 6).map((row) => ({
    name: isBrandEntry(row.name, brandName, brandAliases) ? 'Tu marca' : row.name,
    size: row.share,
    isBrand: row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases),
  }));

  // Datos para Barras apiladas por intención (Tu marca vs líder)
  const stackedData =
    Object.keys(intentionMatrixPct).length > 0
      ? Object.entries(intentionMatrixPct).map(([intKey, row]) => {
          const meta = INTENTION_LABELS[intKey];
          const brandKey = Object.keys(row).find((k) => isBrandEntry(k, brandName, brandAliases));
          const brandVal = brandKey ? row[brandKey]! : 0;
          const leaderVal = leaderName ? (row[leaderName] ?? 0) : 0;
          return {
            intencion: meta?.label ?? intKey,
            tuMarca: Math.round(brandVal),
            lider: Math.round(leaderVal),
          };
        })
      : [];

  return (
    <div className="space-y-8">
      {/* Fila superior: 3 cards — sombra de color por tarjeta, estilo RankIA */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Card 1 — Ranking de marcas — sombra azul */}
        <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-blue-50/40 to-white shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Ranking de marcas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {results.length > 0 && comparisonSummary.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 bg-slate-50">
                      <TableHead className="h-9 text-xs font-semibold text-slate-600">#</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Marca</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600">Score</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600">% Top 3</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonSummary.slice(0, 6).map((row, idx) => (
                      <TableRow key={`${row.name}-${row.type}`} className="border-slate-50">
                        <TableCell className="py-2 text-xs text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="py-2">
                          <span className="text-sm font-medium text-slate-800">{row.name}</span>
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm font-semibold text-slate-700">
                          {row.averagePosition.toFixed(1)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm text-slate-600">{row.share.toFixed(0)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-slate-500">Sin datos de ranking.</p>
            )}
            <CardDetailButton onOpen={() => setDetailOpen('ranking')} />
          </CardContent>
        </Card>

        {/* Card 2 — Cleexs Score: número dentro del recuadro — sombra violeta */}
        <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-violet-50/40 to-white shadow-sm">
          <CardHeader className="pb-1 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Award className="h-4 w-4 text-violet-500" />
              Cleexs Score
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              {intentionScores.length > 0 ? 'Ponderado por intención' : 'Promedio de la corrida'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-violet-50/60 to-primary-50/60 p-4 shadow-inner">
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-600">Cleexs Score</span>
              <GaugeScore value={displayScore} size={160} />
              <span className="mt-1 text-xs text-slate-500">Indicador 0–100 de recomendación en IA</span>
            </div>
            {trendData && trendData.length >= 1 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Tendencia
                  {trendData.length >= 2 && (
                    <span className="ml-2 text-slate-500">
                      (promedio: {Math.round(trendData.reduce((a, p) => a + p.score, 0) / trendData.length)})
                    </span>
                  )}
                </p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [Math.round(v), 'Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="rgb(139, 92, 246)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
                {trendData.length === 1 && (
                  <p className="text-xs text-slate-500">Más diagnósticos del mismo sitio completarán la tendencia.</p>
                )}
              </div>
            )}
            <CardDetailButton onOpen={() => setDetailOpen('cleexs')} />
          </CardContent>
        </Card>

        {/* Card 3 — Por intención — sombra ámbar */}
        <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-amber-50/40 to-white shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Zap className="h-4 w-4 text-amber-500" />
              Por intención
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {intentionScores.length === 0 && results.length > 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50/60 p-3">
                <BarChart3 className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-700">General {runResult.cleexsScore?.toFixed(0) ?? '—'}</span>
              </div>
            ) : (
              intentionScores.map((item) => {
                const meta = INTENTION_LABELS[item.key];
                const score = Math.round(item.score);
                return (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {meta?.icon ?? null}
                        <span className="text-sm font-medium text-slate-700">{meta?.label ?? item.key}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{score}%</span>
                    </div>
                    <ProgressBar value={score} className="bg-amber-100" />
                  </div>
                );
              })
            )}
            {intentionScores.length >= 1 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-600">Comparación rápida</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={intentionScores.map((item) => ({
                      name: INTENTION_LABELS[item.key]?.label ?? item.key,
                      value: Math.round(item.score),
                    }))}
                    margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, '%']} />
                    <Bar dataKey="value" fill="rgb(245, 158, 11)" radius={[4, 4, 0, 0]} name="%" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <CardDetailButton onOpen={() => setDetailOpen('intention')} />
          </CardContent>
        </Card>
      </div>

      {/* Línea central — texto comparativo con un toque de color */}
      <p className="text-center text-sm font-medium text-slate-600">
        Compará tu Cleexs Score con tus principales competidores.
      </p>

      {/* Fila inferior: 2 cards — sombra de color cada una */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 4 — Métricas — sombra esmeralda */}
        <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50/40 to-white shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Métricas del análisis
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Coherencia, visibilidad y ranking en esta corrida
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {metrics.map((m, idx) => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-100 text-xs font-semibold text-emerald-700">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-700">{m.label}</span>
                    <span className="shrink-0 text-sm font-bold text-emerald-700">{m.value}%</span>
                  </div>
                  <ProgressBar value={m.value} className="h-2 bg-emerald-100" />
                </div>
              </div>
            ))}
            <CardDetailButton onOpen={() => setDetailOpen('metrics')} />
          </CardContent>
        </Card>

        {/* Card 5 — Comparaciones — sombra índigo */}
        <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50/40 to-white shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Comparaciones y sugerencias
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Marca medida: <span className="font-semibold text-indigo-700">{runResult.brandName}</span>
              {competitorsUsed.length > 0 && ` · Competidores: ${competitorsUsed.slice(0, 3).join(', ')}${competitorsUsed.length > 3 ? '…' : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {results.length > 0 && comparisonSummary.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 bg-slate-50">
                      <TableHead className="text-xs font-semibold text-slate-600">Marca</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Tipo</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600">Apar.</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-slate-600">% Top 3</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonSummary.map((row) => (
                      <TableRow key={`${row.name}-${row.type}`} className="border-slate-50">
                        <TableCell className="py-2">
                          <span className="text-sm font-medium text-slate-800">{row.name}</span>
                        </TableCell>
                        <TableCell className="py-2">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              row.type === 'brand'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {row.type === 'brand' ? 'marca' : 'competidor'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm text-slate-600">{row.appearances}</TableCell>
                        <TableCell className="py-2 text-right text-sm text-slate-600">{row.share.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-slate-500">No hay Top 3 parseado.</p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Definí industria o tipo de producto para sugerencias más relevantes.
            </p>
            <CardDetailButton onOpen={() => setDetailOpen('comparisons')} />
          </CardContent>
        </Card>
      </div>

      {/* Comparativo directo + Matriz por intención */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Comparativo directo: barras Tu marca vs competidores */}
        <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-sky-50/40 to-white shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <BarChart3 className="h-4 w-4 text-sky-500" />
              Comparativo directo
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              % Top 3: tu marca vs competidores
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 40)}>
                <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 24, left: 4, bottom: 8 }} barCategoryGap="12%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" unit="%" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fontWeight: 500 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => [`${Number(v).toFixed(1)}%`, '% Top 3']}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} name="% Top 3" maxBarSize={32}>
                    {barData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.isBrand ? 'rgb(14, 165, 233)' : 'rgb(148, 163, 184)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">Sin datos para comparativo.</p>
            )}
          </CardContent>
        </Card>

        {/* Matriz por intención */}
        <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-teal-50/40 to-white shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Zap className="h-4 w-4 text-teal-500" />
              Matriz por intención
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              % de presencia por tipo de consulta
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {Object.keys(intentionMatrixPct).length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 bg-slate-50">
                      <TableHead className="text-xs font-semibold text-slate-600">Intención</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600">Tu marca</TableHead>
                      {topForBars
                        .filter((r) => !isBrandEntry(r.name, brandName, brandAliases))
                        .slice(0, 3)
                        .map((r) => (
                          <TableHead key={r.name} className="text-right text-xs font-semibold text-slate-600">
                            {r.name}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(intentionMatrixPct).map(([intKey, row]) => {
                      const meta = INTENTION_LABELS[intKey];
                      const brandKey = Object.keys(row).find((k) => isBrandEntry(k, brandName, brandAliases));
                      const brandVal = brandKey ? row[brandKey]! : 0;
                      return (
                        <TableRow key={intKey} className="border-slate-50">
                          <TableCell className="py-2 text-xs font-medium text-slate-700">
                            {meta?.label ?? intKey}
                          </TableCell>
                          <TableCell className="py-2">
                            <span
                              className={cn(
                                'inline-flex min-w-[3rem] justify-end rounded px-1.5 py-0.5 text-xs font-semibold',
                                brandVal >= 50 ? 'bg-teal-100 text-teal-800' : brandVal >= 25 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {brandVal.toFixed(0)}%
                            </span>
                          </TableCell>
                          {topForBars
                            .filter((r) => !isBrandEntry(r.name, brandName, brandAliases))
                            .slice(0, 3)
                            .map((r) => {
                              const val = row[r.name] ?? 0;
                              return (
                                <TableCell key={r.name} className="py-2 text-right">
                                  <span
                                    className={cn(
                                      'inline-flex min-w-[3rem] justify-end rounded px-1.5 py-0.5 text-xs',
                                      val >= 50 ? 'bg-teal-50 text-teal-700' : val >= 25 ? 'bg-amber-50 text-amber-700' : 'text-slate-500'
                                    )}
                                  >
                                    {val.toFixed(0)}%
                                  </span>
                                </TableCell>
                              );
                            })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">Sin datos por intención.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen ejecutivo y 3 acciones prioritarias */}
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Award className="h-4 w-4 text-primary-500" />
            Resumen y próximos pasos
          </CardTitle>
          <CardDescription>Resumen ejecutivo y acciones prioritarias derivadas de los datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-600">{resumenEjecutivo}</p>
          {top3Acciones.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">3 acciones prioritarias</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
                {top3Acciones.map((acc, i) => (
                  <li key={i}>{acc}</li>
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calidad de datos: Consistencia y Completitud */}
      {(runResultChatGPT && runResultGemini) || totalEntries > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {runResultChatGPT && runResultGemini && (
            <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-50/40 to-white shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                  <BarChart3 className="h-4 w-4 text-fuchsia-500" />
                  Consistencia ChatGPT ↔ Gemini
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  % de prompts donde ambos modelos coinciden en el #1
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-fuchsia-50/60 p-4">
                    <span className="text-sm font-medium text-slate-700">Coincidencia en #1</span>
                    <span className="text-2xl font-bold text-fuchsia-600">{consistencyPct}%</span>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={[{ name: 'Coinciden', value: consistencyPct }, { name: 'Difieren', value: 100 - consistencyPct }]} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" unit="%" />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} stroke="#64748b" />
                      <Tooltip formatter={(v: number) => [`${Number(v).toFixed(0)}%`, '']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {[{ name: 'Coinciden', value: consistencyPct }, { name: 'Difieren', value: 100 - consistencyPct }].map((entry, idx) => (
                          <Cell key={idx} fill={entry.name === 'Coinciden' ? 'rgb(192, 132, 252)' : 'rgb(226, 232, 240)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-500">{consistencyCount} de {consistencyTotal} prompts con mismo #1</p>
                </div>
              </CardContent>
            </Card>
          )}
          {totalEntries > 0 && (
            <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-lime-50/40 to-white shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                  <Info className="h-4 w-4 text-lime-600" />
                  Profundidad de respuesta
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  % de entradas Top 3 con motivo/justificación
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-lime-50/60 p-4">
                    <span className="text-sm font-medium text-slate-700">Entradas con motivo</span>
                    <span className="text-2xl font-bold text-lime-600">{completenessPct}%</span>
                  </div>
                  <div className="overflow-hidden rounded-lg bg-lime-100 shadow-inner">
                    <div
                      className="h-3 rounded-lg bg-gradient-to-r from-lime-400 to-lime-600 transition-all duration-600"
                      style={{ width: `${Math.min(100, completenessPct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{entriesWithReason} de {totalEntries} entradas con justificación</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* 6 nuevos gráficos: Funnel, Radar, Bubble, Treemap, Barras apiladas */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-slate-800">Visualizaciones adicionales</h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 1. Funnel */}
          <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-rose-50/40 to-white shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <TrendingUp className="h-4 w-4 text-rose-500" />
                Funnel de presencia
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Menciones → Top 3 → Posición #1
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <FunnelSteps mention={mentionRate} top3={top3Rate} top1={top1Rate} />
            </CardContent>
          </Card>

          {/* 2. Radar */}
          <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-cyan-50/40 to-white shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <BarChart3 className="h-4 w-4 text-cyan-500" />
                Radar: Tu marca vs líder
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                % por intención
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {radarData.length > 0 && leaderName ? (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="intencion" tick={{ fontSize: 11, fill: '#475569' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Radar name="Tu marca" dataKey="tuMarca" stroke="rgb(14, 165, 233)" fill="rgb(14, 165, 233)" fillOpacity={0.45} strokeWidth={2.5} />
                    <Radar name={leaderName || 'Líder'} dataKey="lider" stroke="rgb(100, 116, 139)" fill="rgb(100, 116, 139)" fillOpacity={0.35} strokeWidth={2} />
                    <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span className="text-slate-700">{value}</span>} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Sin datos por intención para radar.</p>
              )}
            </CardContent>
          </Card>

          {/* 3. Bubble */}
          <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-50/40 to-white shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <TrendingUp className="h-4 w-4 text-fuchsia-500" />
                Posicionamiento (Top 3 vs #1)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Eje X: % Top 3 · Eje Y: % #1 · Tamaño: apariciones
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {bubbleData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" dataKey="x" name="% Top 3" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis type="number" dataKey="y" name="% #1" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number, _name: string, props: { payload?: { name: string; x: number; y: number } } | undefined) => {
                        const p = props?.payload;
                        if (p) return [`${p.name}: ${p.x.toFixed(1)}% Top 3, ${p.y.toFixed(1)}% #1`, ''];
                        return [v?.toFixed(1) ?? '', ''];
                      }}
                      labelFormatter={() => ''}
                    />
                    <Scatter name="Marcas" data={bubbleData} fill="rgb(148, 163, 184)">
                      {bubbleData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isBrand ? 'rgb(14, 165, 233)' : 'rgb(148, 163, 184)'} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Sin datos para bubble.</p>
              )}
            </CardContent>
          </Card>

          {/* 4. Treemap / Cuota de voz (barras horizontales proporcionales) */}
          <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-lime-50/40 to-white shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <BarChart3 className="h-4 w-4 text-lime-500" />
                Cuota de voz
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Proporción de cada marca en el Top 3
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {treemapData.length > 0 ? (
                <div className="space-y-3">
                  {treemapData.map((d) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-xs font-semibold text-slate-700">{d.name}</span>
                      <div className="flex-1 overflow-hidden rounded-lg bg-slate-100 shadow-inner">
                        <div
                          className={cn('h-7 rounded-lg transition-all duration-600', d.isBrand ? 'bg-gradient-to-r from-sky-400 to-sky-600' : 'bg-gradient-to-r from-slate-400 to-slate-500')}
                          style={{ width: `${Math.min(100, d.size)}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-slate-800">{d.size.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Sin datos para cuota de voz.</p>
              )}
            </CardContent>
          </Card>

          {/* 5. Barras agrupadas por intención (Tu marca vs líder lado a lado) */}
          <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-orange-50/40 to-white shadow-sm lg:col-span-2">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                <Zap className="h-4 w-4 text-orange-500" />
                Comparativo por intención
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Tu marca vs líder en cada tipo de consulta
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {stackedData.length > 0 && leaderName ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stackedData} layout="vertical" margin={{ top: 8, right: 24, left: 70, bottom: 8 }} barCategoryGap="20%" barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" />
                    <YAxis type="category" dataKey="intencion" width={65} tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [`${v}%`, '']}
                      labelFormatter={(l) => l}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="tuMarca" fill="rgb(14, 165, 233)" radius={[0, 4, 4, 0]} name="Tu marca" maxBarSize={28} />
                    <Bar dataKey="lider" fill="rgb(100, 116, 139)" radius={[0, 4, 4, 0]} name={leaderName} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Sin datos por intención.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-800">Resumen del análisis</CardTitle>
          <CardDescription>Explicación concreta de cada punto. Expandí para ver el detalle.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {/* Cleexs Score destacado (jerarquía principal) */}
            <div className="rounded-xl border-2 border-violet-200 bg-violet-50/60 p-4 md:col-span-2 md:row-span-1 order-first">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Cleexs Score</p>
                  <p className="mt-1 text-3xl font-bold text-violet-700">{Math.round(displayScore)}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Nivel {scoreLabel(displayScore)} · {top3Rate}% Top 3 · {top1Rate}% en #1
                  </p>
                  {resumenExpanded.has('cleexs') && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Este score resume qué tan competitiva es la marca en escenarios de recomendación reales. Para subirlo: mejorar frecuencia de aparición y posicionamiento en primeros lugares.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleResumen('cleexs')}
                  className="shrink-0 text-xs font-medium text-violet-600 hover:text-violet-800"
                >
                  {resumenExpanded.has('cleexs') ? 'Ver menos' : 'Ver más'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Ranking de marcas</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{leaderRow ? `${leaderRow.share.toFixed(0)}%` : '—'}</p>
              <p className="mt-1 text-sm text-slate-600">
                {leaderRow ? `${leaderRow.name} lidera${secondRow ? ` (+${Math.max(0, leaderRow.share - secondRow.share).toFixed(1)} pts vs ${secondRow.name})` : ''}` : 'Sin datos.'}
              </p>
              {resumenExpanded.has('ranking') && (
                <p className="mt-2 text-sm text-slate-600">
                  Refleja cuánta presencia acumuló cada marca en las recomendaciones. Brecha amplia = dominancia estable.
                </p>
              )}
              <button type="button" onClick={() => toggleResumen('ranking')} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800">
                {resumenExpanded.has('ranking') ? 'Ver menos' : 'Ver más'}
              </button>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Por intención</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">
                {strongestIntention && weakestIntention ? `${Math.round(strongestIntention.score - weakestIntention.score)} pts` : '—'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {strongestIntention && weakestIntention
                  ? `Mejor: ${INTENTION_LABELS[strongestIntention.key]?.label ?? strongestIntention.key} (${Math.round(strongestIntention.score)}%) · Menor: ${INTENTION_LABELS[weakestIntention.key]?.label ?? weakestIntention.key} (${Math.round(weakestIntention.score)}%)`
                  : 'Sin datos por intención.'}
              </p>
              {resumenExpanded.has('intention') && (
                <p className="mt-2 text-sm text-slate-600">
                  La brecha muestra dónde conectás mejor y dónde perdés tracción. Priorizá optimizar la intención más débil.
                </p>
              )}
              <button type="button" onClick={() => toggleResumen('intention')} className="mt-2 text-xs font-medium text-amber-600 hover:text-amber-800">
                {resumenExpanded.has('intention') ? 'Ver menos' : 'Ver más'}
              </button>
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Métricas del análisis</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{metricsAvg}%</p>
              <p className="mt-1 text-sm text-slate-600">
                Promedio {metricsAvg}% · Cuello de botella: {bottleneckMetric.label.toLowerCase()} ({bottleneckMetric.value}%)
              </p>
              {resumenExpanded.has('metrics') && (
                <p className="mt-2 text-sm text-slate-600">
                  Combina formato, visibilidad y performance. Si el cuello de botella mejora, arrastra al resto.
                </p>
              )}
              <button type="button" onClick={() => toggleResumen('metrics')} className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-800">
                {resumenExpanded.has('metrics') ? 'Ver menos' : 'Ver más'}
              </button>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Comparaciones</p>
              <p className="mt-1 text-2xl font-bold text-indigo-700">
                {competitorLeader ? `${Math.max(0, (competitorLeader.share || 0) - (brandRow?.share || 0)).toFixed(1)} pts` : '—'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {competitorLeader ? `${competitorLeader.name} ${competitorLeader.share.toFixed(1)}% · Tu marca ${brandRow?.share.toFixed(1) ?? '—'}%` : 'Sin comparaciones.'}
              </p>
              {resumenExpanded.has('comparisons') && (
                <p className="mt-2 text-sm text-slate-600">
                  Distancia competitiva real: quién captura mayor cuota de preferencia en las respuestas de IA.
                </p>
              )}
              <button type="button" onClick={() => toggleResumen('comparisons')} className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800">
                {resumenExpanded.has('comparisons') ? 'Ver menos' : 'Ver más'}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Popup de detalle: explicación larga + ejemplo de prompt */}
      {detailOpen && (
        <DetailPopup
          icon={
            detailOpen === 'ranking'
              ? <BarChart3 className="h-5 w-5 text-blue-400" />
              : detailOpen === 'cleexs'
                ? <Award className="h-5 w-5 text-violet-300" />
                : detailOpen === 'intention'
                  ? <Zap className="h-5 w-5 text-amber-300" />
                  : detailOpen === 'metrics'
                    ? <TrendingUp className="h-5 w-5 text-emerald-300" />
                    : <TrendingUp className="h-5 w-5 text-indigo-300" />
          }
          title={
            detailOpen === 'ranking'
              ? 'Ranking de marcas'
              : detailOpen === 'cleexs'
                ? 'Cleexs Score'
                : detailOpen === 'intention'
                  ? 'Por intención'
                  : detailOpen === 'metrics'
                    ? 'Métricas del análisis'
                    : 'Comparaciones y sugerencias'
          }
          body={
            detailOpen === 'ranking' ? (
              <>
                <p>
                  Este ranking muestra <strong>cómo aparecen tu marca y los competidores</strong> en las respuestas que da la IA cuando se le hacen preguntas relacionadas con tu sector. La idea es simular distintos tipos de consulta que un usuario podría hacer (por urgencia, por calidad, por precio, etc.) y ver qué marcas recomienda la IA en cada caso.
                </p>
                <p>
                  <strong>Cómo se construye:</strong> el sistema envía a la IA varias preguntas distintas (una por cada prompt del análisis). En cada respuesta, la IA devuelve un Top 3 de marcas recomendadas, a veces con un breve motivo. Nosotros tomamos todas esas respuestas, extraemos qué marca quedó en 1.º, 2.º y 3.º lugar en cada pregunta, y <strong>agregamos</strong> los datos: contamos cuántas veces apareció cada marca, en qué posiciones y en cuántas preguntas distintas.
                </p>
                <p>
                  <strong>Qué significa cada número en la tabla:</strong> el <strong>Score</strong> es la <strong>posición promedio</strong> de esa marca cuando salió en el Top 3 (1 = siempre primero, 2 = en promedio segundo, etc.). El <strong>% Top 3</strong> indica en qué proporción de todas las preguntas del análisis esa marca llegó a estar en el Top 3. Por ejemplo, si el análisis tiene 10 preguntas y tu marca sale en el Top 3 en 7, tu % Top 3 sería 70%. Así ves de un vistazo quién domina las recomendaciones y cómo te comparás.
                </p>
              </>
            ) : detailOpen === 'cleexs' ? (
              <>
                <p>
                  El <strong>Cleexs Score</strong> es un indicador de 0 a 100 que resume <strong>qué tan bien te recomienda la IA</strong> en relación con tus competidores en todo el análisis. No es un número que la IA devuelva sola: lo calculamos nosotros a partir de todas las respuestas que da a las distintas preguntas (prompts).
                </p>
                <p>
                  <strong>Cómo se calcula paso a paso:</strong> para cada pregunta del análisis, la IA devuelve un Top 3. Nosotros evaluamos si tu marca aparece en ese Top 3 y en qué posición (1.º, 2.º o 3.º). Con eso asignamos un score por pregunta (por ejemplo, según qué tan arriba te ubicó). Luego combinamos todos esos scores. Si el análisis tiene <strong>intenciones</strong> definidas (urgencia, consideración, calidad, precio), cada prompt está asociado a una intención con un peso; en ese caso el Cleexs Score final es el <strong>promedio ponderado</strong> de los scores por intención, según el peso de cada una. Si no hay intenciones, es el <strong>promedio simple</strong> de todos los prompts.
                </p>
                <p>
                  <strong>Qué interpretar:</strong> cuanto más alto el número (cercano a 100), mejor te posiciona la IA en conjunto. Un score bajo indica que en muchas preguntas la IA recomienda más a la competencia; un score alto indica que la IA te elige con frecuencia entre las mejores opciones. Sirve como un único número de referencia para seguir tu evolución en el tiempo o compararte con otros.
                </p>
              </>
            ) : detailOpen === 'intention' ? (
              <>
                <p>
                  Las <strong>intenciones</strong> (urgencia, consideración, calidad, precio) representan distintos <strong>tipos de búsqueda o necesidad</strong> del usuario: por ejemplo algo urgente (entrega rápida, respuesta inmediata), algo para evaluar con tiempo (educación, seguros), prioridad por la mejor calidad o por el mejor precio. El análisis incluye varios prompts pensados específicamente para cada intención, con un <strong>peso</strong> que refleja la importancia relativa de esa intención en tu sector.
                </p>
                <p>
                  <strong>Cómo se obtienen los scores por intención:</strong> cada prompt del análisis está etiquetado con una intención. Para cada intención, tomamos todas las respuestas de la IA a esos prompts y calculamos qué tan bien te ubicó (si entraste en el Top 3 y en qué posición). El score que ves por intención es el <strong>promedio</strong> de ese desempeño en los prompts de esa intención. Así podés ver en qué tipo de búsqueda la IA te recomienda más o menos.
                </p>
                <p>
                  <strong>Relación con el Cleexs Score global:</strong> el Cleexs Score total no es un promedio simple de las intenciones; es un <strong>promedio ponderado</strong>. Es decir, las intenciones con más peso (por ejemplo “urgencia” si tu negocio es muy dependiente de eso) influyen más en el número final. Eso permite que el indicador global refleje mejor la importancia relativa de cada tipo de consulta en tu contexto.
                </p>
              </>
            ) : detailOpen === 'metrics' ? (
              <>
                <p>
                  Estas métricas resumen <strong>coherencia, visibilidad y ranking</strong> de tu marca en esta corrida del análisis. Todas se calculan a partir de las respuestas de la IA a los distintos prompts: no son datos que la IA devuelva directamente, sino que los derivamos nosotros parseando y contando esas respuestas.
                </p>
                <p>
                  <strong>Confianza de formato:</strong> es el porcentaje de respuestas en las que la IA devolvió un Top 3 en un formato que pudimos interpretar correctamente (por ejemplo, listado numerado con marcas y motivos). Si este valor es bajo, significa que muchas respuestas no siguieron el formato esperado y los datos de ranking pueden ser menos fiables. Conviene que sea alto.
                </p>
                <p>
                  <strong>Mención de marca:</strong> en qué proporción de respuestas se menciona tu marca, aunque no necesariamente en el Top 3. Indica si la IA te tiene en cuenta al hablar del tema, incluso cuando no te pone entre los tres primeros.
                </p>
                <p>
                  <strong>Aparición en Top 3:</strong> en qué proporción de preguntas tu marca llegó a estar en el Top 3. Es una métrica central: cuánto más alta, más veces la IA te recomienda entre las mejores opciones.
                </p>
                <p>
                  <strong>Posición #1:</strong> en qué proporción de preguntas la IA te puso en primer lugar. Es el nivel más alto de recomendación; si este número crece, estás mejorando en “ser la primera opción” que la IA sugiere.
                </p>
                <p>
                  <strong>Profundidad de respuesta:</strong> porcentaje de entradas del Top 3 con motivo o justificación. Indica qué tan detalladas son las recomendaciones de la IA.
                </p>
                {runResultChatGPT && runResultGemini && (
                  <p>
                    <strong>Consistencia ChatGPT↔Gemini:</strong> cuando el análisis usa ambos modelos, mide en qué proporción de prompts coinciden en la marca #1. Una consistencia alta indica que distintos modelos te posicionan de forma similar.
                  </p>
                )}
                <p>
                  Juntas, estas métricas te dan una idea clara de cómo te ve la IA: si responde de forma interpretable, si te menciona, si te incluye en el Top 3, con qué frecuencia te elige como número uno, y la calidad de las justificaciones.
                </p>
              </>
            ) : (
              <>
                <p>
                  Esta tabla resume <strong>cuántas veces apareció cada marca</strong> (tuya o de competidores) en el Top 3 de las respuestas de la IA a lo largo de todo el análisis, y qué parte del total de apariciones representa cada una. Sirve para ver de un vistazo quién “gana” en recomendaciones y dónde estás vos.
                </p>
                <p>
                  <strong>Cómo se arma:</strong> por cada pregunta del análisis, la IA devuelve un Top 3. Nosotros extraemos qué marcas salieron (tu marca y las que consideramos competidores) y contamos: en cuántas respuestas apareció cada una y en qué posición. Esas apariciones se suman y se muestran por marca. La columna <strong>Tipo</strong> indica si la fila corresponde a tu marca o a un competidor.
                </p>
                <p>
                  <strong>Qué significa cada columna:</strong> <strong>Apar.</strong> (apariciones) es el número de veces que esa marca salió en el Top 3 en alguna pregunta. <strong>% Top 3</strong> es el porcentaje que esa marca representa sobre el <strong>total</strong> de apariciones de todas las marcas: si en todo el análisis hubo 100 apariciones en total y tu marca salió 25 veces, tu % Top 3 sería 25%. Así ves la “cuota” de recomendaciones que se lleva cada uno.
                </p>
                <p>
                  <strong>Cómo usarlo:</strong> si un competidor tiene muchas más apariciones y un % Top 3 mucho mayor que el tuyo, está dominando las recomendaciones de la IA en este análisis. Eso te indica dónde hay que mejorar (contenido, señales de autoridad, claridad para la IA, etc.). Si tu marca está arriba en la tabla, estás bien posicionado; si no, la tabla te ayuda a priorizar contra quién y en qué dimensiones trabajar.
                </p>
              </>
            )
          }
          examplePrompt={examplePromptText}
          totalPrompts={totalPrompts > 0 ? totalPrompts : undefined}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
