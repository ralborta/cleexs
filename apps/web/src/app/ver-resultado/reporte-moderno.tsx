'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PublicDiagnosticRunResult, PublicDiagnosticPromptResult } from '@/lib/api';
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
} from 'lucide-react';

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
}: {
  runResult: PublicDiagnosticRunResult;
  brandName: string;
}) {
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
    <div className="space-y-6">
      {/* Cleexs Score — card principal */}
      <Card className="overflow-hidden border-0 bg-white shadow-lg shadow-slate-200/60">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cleexs Score</p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {Math.round(displayScore)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {intentionScores.length > 0 ? 'Ponderado por intención' : 'Promedio de la corrida'}
              </p>
            </div>
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-3xl font-bold text-white shadow-lg">
              {Math.round(displayScore)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intenciones — barras de progreso */}
      <Card className="border-0 bg-white shadow-md shadow-slate-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-slate-800">Por intención</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Cómo te recomienda la IA según el tipo de búsqueda del usuario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {intentionScores.length === 0 && results.length > 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <BarChart3 className="h-5 w-5 text-slate-400" />
              <div>
                <p className="font-medium text-slate-800">General</p>
                <p className="text-2xl font-bold text-primary-600">{runResult.cleexsScore?.toFixed(0) ?? '—'}</p>
              </div>
            </div>
          ) : (
            intentionScores.map((item) => {
              const meta = INTENTION_LABELS[item.key];
              const score = Math.round(item.score);
              return (
                <div key={item.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {meta?.icon ?? null}
                      <span className="text-sm font-medium text-slate-700">{meta?.label ?? item.key}</span>
                      <span className="text-xs text-slate-400">Peso {item.weight}%</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{score}</span>
                  </div>
                  <ProgressBar value={score} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Métricas del análisis — barras */}
      <Card className="border-0 bg-white shadow-md shadow-slate-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-slate-800">Métricas del análisis</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Coherencia, visibilidad y ranking en esta corrida
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <div className="flex items-center gap-2">
                  <m.icon className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">{m.label}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{m.value}%</p>
                <ProgressBar value={m.value} className="bg-slate-200" />
                <p className="text-xs text-slate-500">{m.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparaciones y sugerencias */}
      <Card className="border-0 bg-white shadow-md shadow-slate-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-slate-800">Comparaciones y sugerencias</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Top 3 por prompt con la marca medida y competidores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-slate-600">
              <span className="font-medium text-slate-800">Marca medida:</span> {runResult.brandName}
            </span>
            <span className="text-slate-600">
              <span className="font-medium text-slate-800">Competidores:</span>{' '}
              {competitorsUsed.length > 0 ? competitorsUsed.join(', ') : '—'}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700">Resumen de apariciones en Top 3</p>
          {results.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-100 hover:bg-slate-100">
                    <TableHead className="font-semibold text-slate-700">Marca</TableHead>
                    <TableHead className="font-semibold text-slate-700">Tipo</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Apariciones</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Pos. media</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">% Top 3</TableHead>
                    <TableHead className="font-semibold text-slate-700 max-w-[180px]">Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                        No hay Top 3 parseado para esta corrida.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparisonSummary.map((row) => (
                      <TableRow key={`${row.name}-${row.type}`} className="border-slate-100">
                        <TableCell className="font-medium text-slate-800">{row.name}</TableCell>
                        <TableCell className="text-slate-600">{row.type === 'brand' ? 'marca' : 'competidor'}</TableCell>
                        <TableCell className="text-right text-slate-600">{row.appearances}</TableCell>
                        <TableCell className="text-right text-slate-600">{row.averagePosition.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-slate-600">{row.share.toFixed(1)}%</TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm text-slate-500" title={row.sampleReason}>
                          {row.sampleReason && row.sampleReason.replace(/\*+/g, '').trim().length >= 2
                            ? row.sampleReason.replace(/\*+/g, '').trim()
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No hay resultados para comparar.</p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Definí industria o tipo de producto en la marca para sugerencias más relevantes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
