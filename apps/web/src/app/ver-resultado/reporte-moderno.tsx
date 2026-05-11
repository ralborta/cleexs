'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { Button } from '@/components/ui/button';
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
import { CLEEXS_MARKETING_URL } from '@/lib/site';
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
import { ReportSectionTitle } from '@/components/report/report-section';
import { IconLinkedInBrand, IconWhatsAppBrand } from '@/components/share/share-brand-icons';
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
  Mail,
  Copy,
  Users,
  Rocket,
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
            <Link
              href="/"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 ring-1 ring-slate-200 hover:opacity-90"
              aria-label="Cleexs"
            >
              <CleexsMark className="h-5 w-5" />
            </Link>
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

function filterComparisonSummaryToTrackedParticipants(
  rows: ComparisonRow[],
  brandName: string,
  aliases: string[],
  competitors: string[],
) {
  if (rows.length === 0) return rows;
  const trackedNames = new Set(
    [brandName, ...aliases, ...competitors]
      .map((value) => normalizeName(value || ''))
      .filter(Boolean),
  );
  return rows.filter(
    (row) => isBrandEntry(row.name, brandName, aliases) || trackedNames.has(normalizeName(row.name)),
  );
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

export function ReporteModerno({
  runResult,
  brandName,
  trendData,
  runResultChatGPT,
  runResultGemini,
  satelliteBlock,
}: {
  runResult: PublicDiagnosticRunResult;
  brandName: string;
  trendData?: PublicDiagnosticTrendPoint[];
  runResultChatGPT?: PublicDiagnosticRunResult;
  runResultGemini?: PublicDiagnosticRunResult;
  satelliteBlock?: ReactNode;
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

  const rawComparisonSummary = buildComparisonSummary(results);
  const competitorsUsed =
    runResult.competitors?.length > 0
      ? runResult.competitors
      : Array.from(new Set(rawComparisonSummary.filter((r) => r.type === 'competitor').map((r) => r.name)));
  const comparisonSummary = filterComparisonSummaryToTrackedParticipants(
    rawComparisonSummary,
    brandName,
    brandAliases,
    competitorsUsed,
  );
  const leaderRow = comparisonSummary[0];
  const secondRow = comparisonSummary[1];
  const brandRow = comparisonSummary.find((r) => r.type === 'brand' || isBrandEntry(r.name, brandName, brandAliases));
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

  // Función auxiliar para etiqueta de score
  const scoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bueno';
    if (score >= 40) return 'Regular';
    if (score >= 20) return 'Bajo';
    return 'Muy bajo';
  };

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

  const rankIndex = comparisonSummary.findIndex((r) => isBrandEntry(r.name, brandName, brandAliases));
  const rankDisplay = rankIndex >= 0 ? rankIndex + 1 : null;

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <ReportSectionTitle
          title="Resumen ejecutivo"
          subtitle="Lectura rápida de posición, score y tendencia en un solo vistazo."
        />
        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100/60">
          <CardContent className="p-6 sm:p-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
              <div className="flex flex-col items-center justify-center space-y-3 lg:col-span-3">
                <GaugeScore value={displayScore} size={200} />
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cleexs Score</p>
                  <p className="text-4xl font-bold tabular-nums text-slate-900">{Math.round(displayScore)}</p>
                  <p className="text-xs text-slate-500">{scoreLabel(displayScore)}</p>
                </div>
              </div>

              <div className="space-y-4 lg:col-span-6">
                <p className="text-sm leading-relaxed text-slate-700">{resumenEjecutivo}</p>
                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-100 bg-slate-50/90 p-4">
                  <span className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-800 ring-1 ring-slate-200/80">
                    Ranking:{' '}
                    <span className="ml-1 tabular-nums font-semibold text-primary-700">
                      {rankDisplay != null ? `#${rankDisplay}` : '—'}
                    </span>
                  </span>
                  <span className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-800 ring-1 ring-slate-200/80">
                    Líder:{' '}
                    <span className="ml-1 font-semibold text-slate-900">{leaderRow?.name ?? '—'}</span>
                    {leaderRow?.share != null ? (
                      <span className="ml-1 tabular-nums text-slate-600">{leaderRow.share.toFixed(1)}%</span>
                    ) : null}
                  </span>
                  {strongestIntention ? (
                    <span className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-800 ring-1 ring-slate-200/80">
                      Mejor intención:{' '}
                      <span className="ml-1 font-semibold text-primary-700">
                        {INTENTION_LABELS[strongestIntention.key]?.label || strongestIntention.key}{' '}
                        {Math.round(strongestIntention.score)}%
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2 lg:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tendencia</p>
                {trendData && trendData.length >= 1 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                    <ResponsiveContainer width="100%" height={128}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" width={32} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => [`${v}`, 'Score']}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#2563EB"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#2563EB' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
                    Sin serie histórica en esta vista.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <ReportSectionTitle title="KPIs clave" subtitle="Indicadores derivados de esta corrida." />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* KPI 1: Cleexs Score */}
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs font-medium text-slate-600 uppercase">Cleexs Score</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{Math.round(displayScore)}</p>
              <p className="text-xs text-slate-500 mt-1">{scoreLabel(displayScore)}</p>
            </CardContent>
          </Card>

          {/* KPI 2: Ranking */}
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100">
                  <Trophy className="h-5 w-5 text-sky-600" />
                </div>
                <p className="text-xs font-medium text-slate-600 uppercase">Ranking</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {rankDisplay != null ? `#${rankDisplay}` : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-1">de {comparisonSummary.length} marcas</p>
            </CardContent>
          </Card>

          {/* KPI 3: Brecha vs líder */}
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-xs font-medium text-slate-600 uppercase">Brecha vs líder</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{gapToLeader > 0 ? '-' : ''}{gapToLeader.toFixed(1)}</p>
              <p className="text-xs text-slate-500 mt-1">pts vs {leaderRow?.name || 'líder'}</p>
            </CardContent>
          </Card>

          {/* KPI 4: Mejor intención */}
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                  <Zap className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs font-medium text-slate-600 uppercase">Mejor intención</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{strongestIntention ? `${Math.round(strongestIntention.score)}%` : '—'}</p>
              <p className="text-xs text-slate-500 mt-1">{strongestIntention ? INTENTION_LABELS[strongestIntention.key]?.label : '—'}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <ReportSectionTitle
          title="Comparativa principal"
          subtitle="Cuota aproximada en el Top 3 y desglose por intención de búsqueda."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2 pt-6">
              <CardTitle className="text-base font-semibold text-slate-800">Tu marca vs competidores</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 24, left: 100, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '% Top 3']} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {barData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.isBrand ? '#2563EB' : 'rgb(148, 163, 184)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Sin datos</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2 pt-6">
              <CardTitle className="text-base font-semibold text-slate-800">Por intención</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {stackedData.length > 0 && leaderName ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stackedData} margin={{ top: 8, right: 24, left: 100, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" unit="%" />
                    <YAxis dataKey="intencion" type="category" width={95} tick={{ fontSize: 11 }} stroke="#64748b" />
                    <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="tuMarca" fill="#2563EB" name="Tu marca" />
                    <Bar dataKey="lider" fill="rgb(100, 116, 139)" name={leaderName || 'Líder'} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Sin datos</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <ReportSectionTitle
          title="Top 3 acciones prioritarias"
          subtitle="Sugerencias automáticas según brechas y métricas de esta corrida."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {top3Acciones.map((accion, idx) => (
            <Card
              key={idx}
              className="rounded-2xl border border-slate-200/80 shadow-sm transition-shadow hover:shadow-md"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">{accion}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <details className="group rounded-2xl border border-slate-200/80 bg-slate-50/40 open:bg-white open:shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
            <ReportSectionTitle
              title="Métricas del análisis"
              subtitle="Detalle técnico de cobertura y presencia (desplegable)."
              className="min-w-0 flex-1"
            />
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <Card className="mx-4 mb-4 rounded-xl border border-slate-200/60 shadow-none sm:mx-5">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                {metrics.map((m, idx) => (
                  <div key={m.label} className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">{m.label}</p>
                    <p className="text-3xl font-bold text-slate-900">{m.value}%</p>
                    <ProgressBar value={m.value} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </details>
      </div>

      <div className="space-y-4">
        <details className="group rounded-2xl border border-slate-200/80 bg-slate-50/40 open:bg-white open:shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
            <ReportSectionTitle
              title="Visualizaciones adicionales"
              subtitle="Radar y vistas complementarias cuando hay datos suficientes."
              className="min-w-0 flex-1"
            />
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-6 px-4 pb-6 sm:px-5">
            {radarData.length > 0 && leaderName && (
              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader className="pb-2 pt-6">
                  <CardTitle className="text-base font-bold text-slate-800">Radar: Tu marca vs líder</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="intencion" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="Tu marca" dataKey="tuMarca" stroke="#2563EB" fill="#2563EB" fillOpacity={0.45} />
                      <Radar name={leaderName} dataKey="lider" stroke="rgb(100, 116, 139)" fill="rgb(100, 116, 139)" fillOpacity={0.35} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </details>
      </div>

      <div className="space-y-4">
        <ReportSectionTitle title="Compartir e invitar" subtitle="Difundí el análisis o invitá a tu equipo." />
        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1 px-2.5 text-xs">
                <Copy className="h-3 w-3" />
                Copiar enlace
              </Button>
              <Button variant="outline" size="sm" className="gap-1 px-2.5 text-xs text-[#25D366] hover:text-[#20bd5a]">
                <IconWhatsAppBrand className="h-3 w-3" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" className="gap-1 px-2.5 text-xs">
                <Mail className="h-3 w-3" strokeWidth={2.25} />
                Email
              </Button>
              <Button variant="outline" size="sm" className="gap-1 px-2.5 text-xs text-[#0A66C2] hover:text-[#095195]">
                <IconLinkedInBrand className="h-3 w-3" />
                LinkedIn
              </Button>
              <Button variant="outline" size="sm" className="ml-auto gap-1 px-2.5 text-xs">
                <Users className="h-3 w-3" />
                Invitar a tu equipo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <ReportSectionTitle title="Próximos pasos" subtitle="Pasá a Premium para reporte completo y más competidores en el análisis." />
        <Card className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-primary/10 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="max-w-xl space-y-1">
                <p className="font-semibold text-slate-900">Desbloqueá el reporte completo con Premium</p>
                <p className="text-sm leading-relaxed text-slate-600">
                  Más profundidad en métricas, más marcas competidoras en el informe y soporte prioritario.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/planes">Ver Plan y Premium</Link>
                </Button>
                <Button variant="outline" asChild>
                  <a href={CLEEXS_MARKETING_URL} target="_blank" rel="noopener noreferrer">
                    Otro diagnóstico
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bloque satélite inyectado */}
      {satelliteBlock ? <>{satelliteBlock}</> : null}
    </div>
  );
}
