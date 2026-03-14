'use client';

import { useState } from 'react';
import Image from 'next/image';
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
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

const LOGO_SRC = '/CleexsLogo.png';

function BrandBadge({ name }: { name: string }) {
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-semibold text-white">
      {initial}
    </div>
  );
}

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera azul con logo a un extremo e ícono + título */}
        <div className="flex shrink-0 items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 text-white">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-[6.25rem] w-[6.25rem] shrink-0">
              <Image src={LOGO_SRC} alt="Cleexs" fill className="object-contain" />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              {icon && <span className="flex shrink-0 text-white/95 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
              <h3 className="truncate text-lg font-bold text-white">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-600">
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
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

export function ReporteModerno({
  runResult,
  brandName,
  trendData,
}: {
  runResult: PublicDiagnosticRunResult;
  brandName: string;
  trendData?: PublicDiagnosticTrendPoint[];
}) {
  const [detailOpen, setDetailOpen] = useState<DetailCardId | null>(null);
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
  const competitorsUsed =
    runResult.competitors?.length > 0
      ? runResult.competitors
      : Array.from(new Set(comparisonSummary.filter((r) => r.type === 'competitor').map((r) => r.name)));

  const metrics = [
    { label: 'Confianza de formato', value: formatConfidence, detail: `${parseableCount}/${totalPrompts} parseable`, icon: CheckCircle2 },
    { label: 'Mención de marca', value: mentionRate, detail: `${mentionCount}/${totalPrompts} respuestas`, icon: AtSign },
    { label: 'Aparición en Top 3', value: top3Rate, detail: `${top3Count}/${totalPrompts} en Top 3`, icon: TrendingUp },
    { label: 'Posición #1', value: top1Rate, detail: `${top1Count}/${totalPrompts} en primer lugar`, icon: Trophy },
  ];

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
                          <div className="flex items-center gap-2">
                            <BrandBadge name={row.name} />
                            <span className="text-sm font-medium text-slate-800">{row.name}</span>
                          </div>
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
            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-violet-50/60 to-primary-50/60 p-6 shadow-inner">
              <span className="text-sm font-semibold uppercase tracking-wider text-violet-600">Cleexs Score</span>
              <span className="mt-2 text-5xl font-bold tabular-nums text-violet-700">
                {Math.round(displayScore)}
              </span>
              <span className="mt-2 text-xs text-slate-500">Indicador 0–100 de recomendación en IA</span>
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
                          <div className="flex items-center gap-2">
                            <BrandBadge name={row.name} />
                            <span className="text-sm font-medium text-slate-800">{row.name}</span>
                          </div>
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
                  Juntas, estas cuatro métricas te dan una idea clara de cómo te ve la IA: si responde de forma interpretable, si te menciona, si te incluye en el Top 3 y con qué frecuencia te elige como número uno.
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
