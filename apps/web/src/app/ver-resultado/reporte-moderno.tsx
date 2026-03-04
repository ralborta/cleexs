'use client';

import { useState } from 'react';
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
} from 'lucide-react';

type DetailCardId = 'ranking' | 'cleexs' | 'intention' | 'metrics' | 'comparisons';

function CardDetailToggle({
  cardId,
  expanded,
  onToggle,
  children,
}: {
  cardId: DetailCardId;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 pr-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      >
        <span className="flex items-center gap-1.5">
          <Info className="h-4 w-4 text-slate-400" />
          {expanded ? 'Resumen' : 'Detalle'}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <div className="rounded-lg bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-600">
            {children}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <ChevronUp className="h-4 w-4" />
            Volver al resumen
          </button>
        </div>
      )}
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
  const toggleDetail = (id: DetailCardId) => setDetailOpen((v) => (v === id ? null : id));

  const results = runResult.promptResults || [];
  const brandAliases = runResult.brandAliases || [];
  const totalPrompts = results.length;

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
                        <TableCell className="py-2 text-sm font-medium text-slate-800">{row.name}</TableCell>
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
            <CardDetailToggle cardId="ranking" expanded={detailOpen === 'ranking'} onToggle={() => toggleDetail('ranking')}>
              Este ranking muestra cómo aparecen tu marca y los competidores en las respuestas de la IA. Para cada pregunta del análisis, la IA devuelve un Top 3; aquí se agregan todas esas apariciones. <strong>Score</strong> es la posición promedio (1 = primero, 2 = segundo, etc.) y <strong>% Top 3</strong> es en qué proporción de preguntas la marca entró en el Top 3.
            </CardDetailToggle>
          </CardContent>
        </Card>

        {/* Card 2 — Cleexs Score: número dentro del recuadro — sombra violeta */}
        <Card className="overflow-hidden rounded-xl bg-gradient-to-br from-violet-50/40 to-white shadow-sm">
          <CardHeader className="pb-1 pt-5">
            <CardTitle className="text-base font-bold text-slate-800">Cleexs Score</CardTitle>
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
            <CardDetailToggle cardId="cleexs" expanded={detailOpen === 'cleexs'} onToggle={() => toggleDetail('cleexs')}>
              El <strong>Cleexs Score</strong> es un indicador de 0 a 100 que mide qué tan bien te recomienda la IA en relación con tus competidores. Si hay intenciones definidas (urgencia, consideración, calidad, precio), el score se calcula como <strong>promedio ponderado</strong> por el peso de cada intención; si no, es el <strong>promedio simple</strong> de todos los prompts. Cuanto más alto, mejor te posiciona la IA.
            </CardDetailToggle>
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
            <CardDetailToggle cardId="intention" expanded={detailOpen === 'intention'} onToggle={() => toggleDetail('intention')}>
              Las <strong>intenciones</strong> (urgencia, consideración, calidad, precio) representan distintos tipos de búsqueda del usuario. Cada prompt del análisis está asociado a una intención con un peso. El score por intención es el <strong>promedio del resultado de la IA</strong> en esos prompts; el Cleexs Score global pondera estos promedios según el peso de cada intención.
            </CardDetailToggle>
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
            <CardDetailToggle cardId="metrics" expanded={detailOpen === 'metrics'} onToggle={() => toggleDetail('metrics')}>
              <strong>Confianza de formato:</strong> % de respuestas de la IA que pudieron parsearse correctamente (Top 3). <strong>Mención de marca:</strong> en qué % de respuestas se menciona tu marca. <strong>Aparición en Top 3:</strong> en qué % de preguntas tu marca aparece en el Top 3. <strong>Posición #1:</strong> en qué % de preguntas la IA te puso en primer lugar.
            </CardDetailToggle>
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
                        <TableCell className="py-2 text-sm font-medium text-slate-800">{row.name}</TableCell>
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
            <CardDetailToggle cardId="comparisons" expanded={detailOpen === 'comparisons'} onToggle={() => toggleDetail('comparisons')}>
              Esta tabla resume <strong>cuántas veces</strong> apareció cada marca (tuya o competidor) en el Top 3 de las respuestas de la IA (<strong>Apar.</strong>) y qué <strong>% del total de apariciones</strong> representa (<strong>% Top 3</strong>). Así ves quién domina las recomendaciones y podés priorizar acciones para mejorar tu posicionamiento.
            </CardDetailToggle>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
