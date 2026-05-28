'use client';

import { useSearchParams } from 'next/navigation';
import React, { Fragment, Suspense, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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
import {
  publicDiagnosticApi,
  isDiagnosticAnalysisGold,
  type PublicDiagnostic,
  type PublicDiagnosticSatelliteModule,
  type PublicDiagnosticRunResult,
  type PublicDiagnosticPromptResult,
} from '@/lib/api';
import { CLEEXS_MARKETING_URL, CLEEXS_TOOLS_PUBLIC_URL } from '@/lib/site';
import { BlockAnalisisUnico } from './analisis-ia';
import type { LucideIcon } from 'lucide-react';
import {
  Loader2,
  LogIn,
  FileCheck,
  AlertCircle,
  Lock,
  LayoutDashboard,
  Sparkles,
  Globe,
  FileSearch,
  Braces,
  Zap,
  Quote,
  AlertTriangle,
  Clock,
  LayoutTemplate,
  Copy,
  Lightbulb,
  Info,
  ClipboardList,
  ShieldAlert,
  Gauge,
  CircleDot,
  CheckCircle2,
  ListChecks,
  ChevronRight,
  ChevronDown,
  Users,
  Rocket,
  FileText,
  X,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReporteModerno } from './reporte-moderno';
import { ReporteCorridas } from './reporte-corridas';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { ShareScoreButtons } from '@/components/share/share-score-buttons';
import { appendQueryToPath, buildShareTrackingQuery } from '@/lib/share-tracking';

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

/** Etiqueta y descripción por intención */
const INTENTION_LABELS: Record<string, { label: string; description: string }> = {
  urgencia: {
    label: 'Urgencia',
    description: 'Mide cómo la IA te recomienda cuando el usuario busca algo urgente o inmediato (ej. delivery, reserva, respuesta rápida).',
  },
  consideracion: {
    label: 'Consideración',
    description: 'Mide cómo la IA te recomienda cuando el usuario está evaluando con tiempo (ej. educación, banco, seguro, decisión a mediano plazo).',
  },
  calidad: {
    label: 'Calidad',
    description: 'Mide tu posicionamiento cuando el usuario prioriza la mejor calidad en el mercado.',
  },
  precio: {
    label: 'Precio',
    description: 'Mide cómo aparecés cuando el usuario busca buen precio y valor.',
  },
};

interface ComparisonRow {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
  sampleReason?: string;
}

const buildComparisonSummary = (results: PublicDiagnosticPromptResult[]): ComparisonRow[] => {
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
};

const filterComparisonSummaryToTrackedParticipants = (
  rows: ComparisonRow[],
  brandName: string,
  aliases: string[],
  competitors: string[],
) => {
  if (rows.length === 0) return rows;
  const trackedNames = new Set(
    [brandName, ...aliases, ...competitors]
      .map((value) => normalizeName(value || ''))
      .filter(Boolean),
  );
  return rows.filter(
    (row) => isBrandEntry(row.name, brandName, aliases) || trackedNames.has(normalizeName(row.name)),
  );
};

const mergeConfiguredCompetitorsWithZeroShare = (
  filteredRows: ComparisonRow[],
  competitorsList: string[],
  brandNm: string,
  aliases: string[],
): ComparisonRow[] => {
  const rowKeys = (name: string) => {
    const n = normalizeName(name);
    const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const nb = normalizeName(base);
    return new Set([n, nb].filter(Boolean));
  };
  const covered = new Set<string>();
  for (const r of filteredRows) {
    for (const k of rowKeys(r.name)) covered.add(k);
  }
  const merged = [...filteredRows];
  for (const raw of competitorsList) {
    const t = raw.trim();
    if (!t || isBrandEntry(t, brandNm, aliases)) continue;
    const keys = [...rowKeys(t)];
    if (keys.some((k) => covered.has(k))) continue;
    merged.push({
      name: t,
      type: 'competitor',
      appearances: 0,
      averagePosition: 0,
      share: 0,
    });
    keys.forEach((k) => covered.add(k));
  }
  return merged.sort((a, b) => b.share - a.share);
};

/** Vista limitada Freemium: solo Cleexs Score + CTA */
function ReporteFreemium({ runResult }: { runResult: PublicDiagnosticRunResult }) {
  return (
    <div className="space-y-6">
      <Card className="border-transparent bg-white shadow-md">
        <CardHeader className="pb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Modelo: ChatGPT (OpenAI)</p>
          <CardTitle className="text-xl text-foreground">Cleexs Score</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Tu resultado para {runResult.brandName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary-100 bg-gradient-to-r from-primary-50 to-accent-50 p-4">
            <p className="text-xs font-medium text-primary-700">Cleexs Score</p>
            <p className="text-4xl font-bold text-foreground">{runResult.cleexsScore.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Score ponderado 0-100</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-transparent bg-gradient-to-br from-amber-50/80 to-orange-50/60 shadow-md border-amber-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl text-foreground">
            <Lock className="h-5 w-5 text-amber-600" />
            Desbloqueá el reporte completo
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Ya hiciste una corrida gratuita para este dominio. Para ver métricas detalladas, comparaciones, análisis por intención y recomendaciones, elegí un plan de Cleexs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-primary-600 hover:bg-primary-700">
              <Link href="/planes">
                <LogIn className="mr-2 h-4 w-4" />
                Ver planes y crear cuenta
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={CLEEXS_MARKETING_URL} target="_blank" rel="noopener noreferrer">
                Otro diagnóstico
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Construye un runResult sintético "Ambos" promediando scores de ChatGPT y Gemini */
function buildRunResultAmbos(
  a: PublicDiagnosticRunResult,
  b: PublicDiagnosticRunResult
): PublicDiagnosticRunResult {
  const prA = a.promptResults || [];
  const prB = b.promptResults || [];
  const promptResults = prA.map((pr, i) => ({
    ...pr,
    score: (pr.score + (prB[i]?.score ?? pr.score)) / 2,
  }));
  const cleexsScore = ((a.cleexsScore ?? 0) + (b.cleexsScore ?? 0)) / 2;
  return {
    brandId: a.brandId,
    brandName: a.brandName,
    cleexsScore,
    competitors: a.competitors ?? [],
    competitorDetails: a.competitorDetails ?? b.competitorDetails ?? [],
    brandAliases: a.brandAliases ?? [],
    promptResults,
  };
}

function ReporteCompleto({
  runResult,
  brandName,
  modelLabel = 'Modelo: ChatGPT (OpenAI)',
}: {
  runResult: PublicDiagnosticRunResult;
  brandName: string;
  modelLabel?: string;
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
    r.top3Json?.some(
      (e) => e.position === 1 && isBrandEntry(e.name, brandName, brandAliases)
    )
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

  const rawComparisonSummary = buildComparisonSummary(results);
  const competitorsUsed =
    runResult.competitors?.length > 0
      ? runResult.competitors
      : Array.from(new Set(rawComparisonSummary.filter((r) => r.type === 'competitor').map((r) => r.name)));
  const comparisonSummary = mergeConfiguredCompetitorsWithZeroShare(
    filterComparisonSummaryToTrackedParticipants(
      rawComparisonSummary,
      brandName,
      brandAliases,
      competitorsUsed,
    ),
    competitorsUsed,
    brandName,
    brandAliases,
  );

  return (
    <div className="space-y-6">
      {/* Cleexs Score */}
      <Card className="border-transparent bg-white shadow-md">
        <CardHeader className="pb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{modelLabel}</p>
          <CardTitle className="text-xl text-foreground">Cleexs Score</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {intentionScores.length > 0 ? 'Ponderado por intención' : 'Promedio de la corrida'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary-100 bg-gradient-to-r from-primary-50 to-accent-50 p-4">
            <p className="text-xs font-medium text-primary-700">Cleexs Score</p>
            <p className="text-4xl font-bold text-foreground">{(cleexsScore || runResult.cleexsScore).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">
              {intentionScores.length > 0 ? 'Ponderado por intención' : 'Promedio de la corrida'}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {intentionScores.length === 0 ? (
              results.length > 0 && (
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs font-medium text-muted-foreground">General</p>
                  <p className="text-2xl font-semibold text-foreground">{runResult.cleexsScore.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Score promedio</p>
                </div>
              )
            ) : (
              intentionScores.map((item) => {
                const meta = INTENTION_LABELS[item.key];
                return (
                  <div key={item.key} className="rounded-lg border border-border bg-white p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {meta?.label ?? item.key}
                    </p>
                    <p className="text-2xl font-semibold text-foreground">{item.score.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Peso {item.weight}%</p>
                    {meta?.description && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        {meta.description}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Métricas del análisis */}
      <Card className="border-transparent bg-white shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl text-foreground">Métricas del análisis</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Indicadores simples para evaluar coherencia, visibilidad y ranking en esta corrida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-primary-50/80 p-4">
              <p className="text-xs font-medium text-muted-foreground">Confianza de formato</p>
              <p className="text-2xl font-semibold text-foreground">{formatConfidence}%</p>
              <p className="text-xs text-muted-foreground">{parseableCount}/{totalPrompts} con Top 3 parseable</p>
            </div>
            <div className="rounded-lg border border-border bg-primary-50/80 p-4">
              <p className="text-xs font-medium text-muted-foreground">Mención de marca</p>
              <p className="text-2xl font-semibold text-foreground">{mentionRate}%</p>
              <p className="text-xs text-muted-foreground">{mentionCount}/{totalPrompts} respuestas la mencionan</p>
            </div>
            <div className="rounded-lg border border-border bg-primary-50/80 p-4">
              <p className="text-xs font-medium text-muted-foreground">Aparición en Top 3</p>
              <p className="text-2xl font-semibold text-foreground">{top3Rate}%</p>
              <p className="text-xs text-muted-foreground">{top3Count}/{totalPrompts} en Top 3</p>
            </div>
            <div className="rounded-lg border border-border bg-primary-50/80 p-4">
              <p className="text-xs font-medium text-muted-foreground">Posición #1</p>
              <p className="text-2xl font-semibold text-foreground">{top1Rate}%</p>
              <p className="text-xs text-muted-foreground">{top1Count}/{totalPrompts} en primer lugar</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparaciones y sugerencias */}
      <Card className="border-transparent bg-white shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl text-foreground">Comparaciones y sugerencias</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Se solicita un Top 3 por prompt con la marca a medir y la lista de competidores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Marca medida:</span> {runResult.brandName}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Competidores usados:</span>{' '}
            {competitorsUsed.length > 0 ? competitorsUsed.join(', ') : 'No hay competidores cargados.'}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Resumen de apariciones en Top 3</p>
            {results.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary-50/80 border-b border-border">
                    <TableHead className="text-foreground font-semibold">Marca</TableHead>
                    <TableHead className="text-foreground font-semibold">Tipo</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Apariciones</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Posición media</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">% del Top 3</TableHead>
                    <TableHead className="text-foreground font-semibold max-w-[200px]">Motivo (ejemplo)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No hay Top 3 parseado para esta corrida.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparisonSummary.map((row) => (
                      <TableRow key={`${row.name}-${row.type}`}>
                        <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.type === 'brand' ? 'marca' : 'competidor'}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.appearances}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.averagePosition.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.share.toFixed(1)}%</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={row.sampleReason}>
                          {(row.sampleReason && row.sampleReason.replace(/\*+/g, '').trim().length >= 2) ? row.sampleReason.replace(/\*+/g, '').trim() : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No hay resultados de prompts para comparar.</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Definí industria o tipo de producto en la marca para sugerencias relevantes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function VerResultadoContent() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const legacyView = searchParams.get('vista') === 'legacy';
  const tierFromQuery = searchParams.get('tier') === 'gold' ? 'gold' : undefined;
  const [diagnostic, setDiagnostic] = useState<PublicDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaModelo, setVistaModelo] = useState<'consolidado' | 'chatgpt' | 'gemini' | 'perplexity' | 'claude'>('chatgpt');

  useEffect(() => {
    const id = diagnosticId;
    if (!id) {
      setLoading(false);
      setError('Falta el ID del diagnóstico.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await publicDiagnosticApi.get(id, tierFromQuery);
        if (!cancelled) setDiagnostic(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el diagnóstico.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [diagnosticId, tierFromQuery]);

  // Si está completado y falta análisis o el módulo AEO sigue en `pending`, refrescar hasta que termine.
  useEffect(() => {
    const id = diagnosticId;
    if (!id || !diagnostic || diagnostic.status !== 'completed' || !diagnostic.showFullReport) {
      return;
    }
    const awaitingAnalysis = diagnostic.analysisJson == null;
    const awaitingSatellite =
      !diagnostic.domain.startsWith('brand-') && diagnostic.satelliteModule?.status === 'pending';
    if (!awaitingAnalysis && !awaitingSatellite) {
      return;
    }
    const pollIntervalMs = 4000;
    const maxWaitMs = 16 * 60 * 1000;
    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= maxWaitMs) return;
      try {
        const data = await publicDiagnosticApi.get(id, tierFromQuery);
        if (cancelled) return;
        setDiagnostic(data);
        if (data.status === 'failed') return;
        const stillAwaitingAnalysis = data.analysisJson == null;
        const stillAwaitingSat =
          !data.domain.startsWith('brand-') && data.satelliteModule?.status === 'pending';
        if (!stillAwaitingAnalysis && !stillAwaitingSat) {
          return;
        }
      } catch {
        // ignorar errores transitorios de polling
      }
      if (!cancelled) timer = setTimeout(poll, pollIntervalMs);
    };

    timer = setTimeout(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [diagnosticId, diagnostic, tierFromQuery]);

  // Si Gemini fue iniciado pero aún no terminó, seguir refrescando para mostrarlo al completar.
  useEffect(() => {
    const id = diagnosticId;
    if (
      !id ||
      !diagnostic ||
      diagnostic.status !== 'completed' ||
      !diagnostic.showFullReport ||
      !diagnostic.runGeminiId ||
      diagnostic.runResultGemini
    ) {
      return;
    }
    const pollIntervalMs = 5000;
    const maxWaitMs = 12 * 60 * 1000;
    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= maxWaitMs) return;
      try {
        const data = await publicDiagnosticApi.get(id, tierFromQuery);
        if (cancelled) return;
        setDiagnostic(data);
        if (data.status === 'failed' || data.runResultGemini) {
          return;
        }
      } catch {
        // ignorar errores transitorios de polling
      }
      if (!cancelled) timer = setTimeout(poll, pollIntervalMs);
    };

    timer = setTimeout(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [diagnosticId, diagnostic, tierFromQuery]);

  const analisisGold =
    diagnostic?.analysisJson && isDiagnosticAnalysisGold(diagnostic.analysisJson)
      ? diagnostic.analysisJson
      : null;
  const tienePerplexity = !!analisisGold?.analisisPerplexity;
  const tieneClaude = !!analisisGold?.analisisClaude;
  const runResultGeminiEarly = diagnostic?.runResultGemini;
  useEffect(() => {
    if (!runResultGeminiEarly && diagnostic?.showFullReport) {
      setVistaModelo((v) => (v === 'gemini' || v === 'consolidado' ? 'chatgpt' : v));
    }
  }, [runResultGeminiEarly, diagnostic?.showFullReport]);

  useEffect(() => {
    if (vistaModelo === 'perplexity' && !tienePerplexity) setVistaModelo('chatgpt');
    if (vistaModelo === 'claude' && !tieneClaude) setVistaModelo('chatgpt');
  }, [vistaModelo, tienePerplexity, tieneClaude]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-600" />
          <p className="mt-4 text-muted-foreground">Cargando resultado…</p>
        </div>
      </main>
    );
  }

  if (error || !diagnostic) {
    return (
      <main className="min-h-[calc(100vh-72px)] px-6 py-16">
        <div className="mx-auto max-w-lg text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <p className="mt-4 text-muted-foreground">{error || 'Diagnóstico no encontrado.'}</p>
          <Link href="/diagnostico/crear">
            <Button className="mt-4">Hacer un nuevo diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  const isCompleted = diagnostic.status === 'completed';
  const isPending = diagnostic.status === 'pending' || diagnostic.status === 'running';
  const isFailed = diagnostic.status === 'failed';
  const scoreTrackingQuery =
    diagnostic.shareSlug && diagnostic.id
      ? buildShareTrackingQuery({
          kind: 'public_score',
          shareSlug: diagnostic.shareSlug,
          diagnosticId: diagnostic.id,
        })
      : '';
  const scoreSharePath =
    diagnostic.shareSlug && scoreTrackingQuery
      ? appendQueryToPath(`/score/${diagnostic.shareSlug}`, scoreTrackingQuery)
      : null;
  const teamTrackingQuery = diagnostic.id
    ? buildShareTrackingQuery({
        kind: 'invite_team',
        shareSlug: diagnostic.shareSlug,
        diagnosticId: diagnostic.id,
      })
    : '';
  const teamInvitePath = diagnostic.id
    ? appendQueryToPath(`/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`, teamTrackingQuery)
    : null;
  const runResult = diagnostic.runResult;
  const runResultGemini = diagnostic.runResultGemini;
  const satelliteModule = diagnostic.satelliteModule;
  const satelliteSiteUrl =
    satelliteModule != null
      ? satelliteModule.targetUrl ||
        (!diagnostic.domain.startsWith('brand-') ? `https://${diagnostic.domain}` : '')
      : '';
  const tieneGemini = !!runResultGemini;
  /** Hubo segundo run (Gemini) o ya hay análisis adicional: mostramos el selector de modelo. */
  const mostrarTabsPorModelo =
    diagnostic.showFullReport &&
    (Boolean(diagnostic.runGeminiId) || tieneGemini || tienePerplexity || tieneClaude);
  const geminiFallo = diagnostic.geminiRunStatus === 'failed';
  const geminiEnCola = Boolean(diagnostic.runGeminiId) && !runResultGemini && !geminiFallo;
  /**
   * Post-proceso: la API puede guardar primero el análisis IA y luego fusionar el módulo técnico del sitio (AEO).
   * Mientras el satélite corre, `satelliteModule.status === 'pending'`.
   */
  const satelliteAeoPending = diagnostic.satelliteModule?.status === 'pending';
  const showSatelliteSkeleton =
    isCompleted &&
    diagnostic.showFullReport &&
    !diagnostic.domain.startsWith('brand-') &&
    (diagnostic.analysisJson == null || satelliteAeoPending);
  const runResultToShow: PublicDiagnosticRunResult | null = runResult
    ? vistaModelo === 'consolidado' && runResultGemini
      ? buildRunResultAmbos(runResult, runResultGemini)
      : vistaModelo === 'gemini' && runResultGemini
        ? runResultGemini
        : runResult
    : null;

  return (
    <div>
      <main className="min-h-[calc(100vh-72px)] bg-slate-50 px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl space-y-5 px-1 sm:px-3">
          <Card className="border-0 bg-white shadow-md shadow-slate-200/50">
          <CardHeader className="space-y-1 p-4 pb-3 sm:p-5 sm:pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <FileCheck className="h-5 w-5 shrink-0 text-primary-600 sm:h-6 sm:w-6" />
                  Resultado del diagnóstico
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm">
                  <span className="font-medium">{diagnostic.brandName}</span>
                  {!diagnostic.domain.startsWith('brand-') && ` · ${diagnostic.domain}`}
                </CardDescription>
              </div>
              <img
                src="/CleexsLogo.png"
                alt="Cleexs"
                className="h-14 w-auto shrink-0 object-contain sm:h-16"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:space-y-5 sm:px-5 sm:pb-5">
            {isPending && (
              <div className="flex items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4 text-primary-800">
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                <p>Tu diagnóstico sigue en proceso. Cuando esté listo podés recargar la página o te enviamos el link por correo si ingresás tu email abajo.</p>
              </div>
            )}

            {isFailed && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
                <p>El análisis no pudo completarse. Podés intentar de nuevo con un nuevo diagnóstico.</p>
<Link href="/diagnostico/crear">
                <Button variant="outline" className="mt-3">Nuevo diagnóstico</Button>
                </Link>
              </div>
            )}

            {isCompleted && (
              <Fragment>
                {runResult ? (
                  diagnostic.showFullReport ? (
                    <div className="space-y-5">
                      {mostrarTabsPorModelo && (
                        <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mr-1 text-xs font-medium text-slate-600">Ver datos por modelo:</span>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setVistaModelo('chatgpt')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                                  vistaModelo === 'chatgpt'
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                <CleexsMark className="h-[18px] w-[18px] shrink-0" />
                                ChatGPT
                              </button>
                              <button
                                type="button"
                                disabled={!runResultGemini}
                                title={
                                  geminiFallo
                                    ? 'Gemini no completó esta corrida.'
                                    : geminiEnCola
                                      ? 'Generando resultados con Gemini…'
                                      : 'Ver métricas según respuestas de Gemini'
                                }
                                onClick={() => runResultGemini && setVistaModelo('gemini')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'gemini' && runResultGemini
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                {geminiEnCola ? (
                                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary-600" />
                                ) : (
                                  <CleexsMark className="h-[18px] w-[18px] shrink-0" />
                                )}
                                {geminiFallo ? 'Gemini (no disponible)' : 'Gemini'}
                              </button>
                              <button
                                type="button"
                                disabled={!runResultGemini}
                                title={
                                  geminiFallo
                                    ? 'Sin datos de Gemini no hay vista consolidada.'
                                    : geminiEnCola
                                      ? 'Disponible cuando termine Gemini.'
                                      : 'Promedio ChatGPT + Gemini'
                                }
                                onClick={() => runResultGemini && setVistaModelo('consolidado')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'consolidado' && runResultGemini
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                {geminiEnCola ? (
                                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-600" />
                                ) : (
                                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                                )}
                                Consolidado
                              </button>
                              <button
                                type="button"
                                disabled={!tienePerplexity}
                                title={
                                  tienePerplexity
                                    ? 'Cómo te ve Perplexity (motor de búsqueda con IA).'
                                    : 'Disponible solo en planes Premium con análisis de Perplexity.'
                                }
                                onClick={() => tienePerplexity && setVistaModelo('perplexity')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'perplexity' && tienePerplexity
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                <Sparkles className="h-[18px] w-[18px] shrink-0" />
                                Perplexity
                              </button>
                              <button
                                type="button"
                                disabled={!tieneClaude}
                                title={
                                  tieneClaude
                                    ? 'Cómo te ve Claude (Anthropic).'
                                    : 'Disponible solo en planes Premium con análisis de Claude.'
                                }
                                onClick={() => tieneClaude && setVistaModelo('claude')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'claude' && tieneClaude
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                <Sparkles className="h-[18px] w-[18px] shrink-0" />
                                Claude
                              </button>
                            </div>
                          </div>
                          {geminiEnCola && (
                            <p className="text-xs text-slate-600 pl-0 sm:pl-[11.5rem]">
                              ChatGPT ya está listo. Gemini y la vista consolidada se habilitan en cuanto termine el
                              segundo modelo (normalmente menos de un minuto).
                            </p>
                          )}
                          {geminiFallo && (
                            <p className="text-xs text-amber-800 pl-0 sm:pl-[11.5rem]">
                              El run de Gemini falló en esta corrida. Mostramos solo resultados de ChatGPT.
                            </p>
                          )}
                        </div>
                      )}
                      {(vistaModelo === 'perplexity' || vistaModelo === 'claude') && analisisGold ? (
                        <AnalisisLLMTextual
                          modelo={vistaModelo}
                          analisis={
                            vistaModelo === 'perplexity'
                              ? analisisGold.analisisPerplexity!
                              : analisisGold.analisisClaude!
                          }
                          brandName={diagnostic.brandName}
                        />
                      ) : null}
                      {runResultToShow &&
                        vistaModelo !== 'perplexity' &&
                        vistaModelo !== 'claude' &&
                        (legacyView ? (
                          <ReporteModerno
                            runResult={runResultToShow}
                            brandName={runResultToShow.brandName}
                            trendData={diagnostic.trendData}
                            runResultChatGPT={tieneGemini ? runResult : undefined}
                            runResultGemini={tieneGemini ? runResultGemini : undefined}
                            satelliteBlock={
                              <>
                                {showSatelliteSkeleton && <SatelliteModuleSkeleton />}
                                {satelliteModule && satelliteModule.status !== 'pending' && (
                                  <SatelliteModuleCard module={satelliteModule} siteUrl={satelliteSiteUrl} />
                                )}
                              </>
                            }
                          />
                        ) : (
                          <ReporteCorridas
                            runResult={runResultToShow}
                            brandName={runResultToShow.brandName}
                            trendData={diagnostic.trendData}
                            satelliteBlock={
                              !diagnostic.domain.startsWith('brand-') &&
                              (showSatelliteSkeleton ||
                                (satelliteModule && satelliteModule.status !== 'pending')) ? (
                                <>
                                  {showSatelliteSkeleton && <SatelliteModuleSkeleton />}
                                  {satelliteModule && satelliteModule.status !== 'pending' && (
                                    <SatelliteModuleCard module={satelliteModule} siteUrl={satelliteSiteUrl} />
                                  )}
                                </>
                              ) : null
                            }
                          />
                        ))}
                    </div>
                  ) : (
                    <ReporteFreemium runResult={runResult} />
                  )
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                    <p className="font-medium">Diagnóstico listo</p>
                    <p className="text-sm mt-1">Cargando detalle del reporte…</p>
                  </div>
                )}

                {isCompleted && (diagnostic.shareSlug || (diagnostic.showFullReport && diagnostic.id)) && (
                  <div className="space-y-3 pt-5 mt-5 border-t border-slate-200/80">
                    {!legacyView && (
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white shadow shadow-violet-500/20">
                          7
                        </span>
                        <p className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Compartir e invitar</p>
                      </div>
                    )}
                    {legacyView ? (
                      <>
                        {diagnostic.shareSlug && (
                          <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/60 p-5 shadow-md shadow-indigo-950/[0.06] ring-1 ring-indigo-100/80">
                            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shadow-inner">
                                  <Sparkles className="h-5 w-5" />
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">Compartir resultado</p>
                                  <p className="text-[11px] text-indigo-700/80">Difusión · página pública</p>
                                </div>
                              </div>
                              <span className="rounded-full bg-indigo-600/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-800">
                                Vista pública · resumida
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-600 mb-4">
                              Enlace a la página pública del Cleexs Score: pensado para redes, email o difusión. Muestra el
                              score y un resumen; no reemplaza el informe detallado de abajo.
                            </p>
                            <ShareScoreButtons
                              path={scoreSharePath || `/score/${diagnostic.shareSlug}`}
                              intent="social"
                              brandName={diagnostic.brandName}
                              domain={diagnostic.domain}
                            />
                          </div>
                        )}
                        {diagnostic.showFullReport && diagnostic.id && (
                          <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-l-[4px] border-l-teal-500 bg-gradient-to-b from-stone-50 to-slate-100/70 p-5 shadow-sm">
                            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-200/80 bg-teal-50 text-teal-700">
                                  <Users className="h-5 w-5" />
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">Invitar a tu equipo</p>
                                  <p className="text-[11px] text-teal-800/80">Uso interno · mismo informe que ves acá</p>
                                </div>
                              </div>
                              <span className="rounded-md border border-teal-200/70 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-900">
                                Informe detallado
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-600 mb-4">
                              Compartí este enlace con marketing, agencia o personas internas: verán el mismo informe
                              extenso que vos (métricas, comparativas y análisis). Si quieren seguir con más diagnósticos,
                              pueden crear cuenta en Cleexs desde la web.
                            </p>
                            <ShareScoreButtons
                              path={teamInvitePath || `/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
                              intent="team"
                              brandName={diagnostic.brandName}
                              domain={diagnostic.domain}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                        {diagnostic.shareSlug && (
                          <div className="flex-1 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60">
                            <p className="mb-0.5 text-xs font-bold text-slate-900">Compartir resultado</p>
                            <p className="mb-3 text-[11px] text-slate-500">Página pública del Cleexs Score · redes y difusión</p>
                            <ShareScoreButtons
                              path={scoreSharePath || `/score/${diagnostic.shareSlug}`}
                              intent="social"
                              brandName={diagnostic.brandName}
                              domain={diagnostic.domain}
                            />
                          </div>
                        )}
                        {diagnostic.showFullReport && diagnostic.id && (
                          <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-green-50/50 p-3.5 shadow-sm ring-1 ring-emerald-100/80 lg:max-w-sm lg:shrink-0">
                            <div className="mb-2 flex items-start gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <Users className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-900">Invitar a tu equipo</p>
                                <p className="mt-0.5 text-xs leading-snug text-slate-600">
                                  Compartí el informe con tu equipo o colaboradores.
                                </p>
                              </div>
                            </div>
                            <ShareScoreButtons
                              path={teamInvitePath || `/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
                              intent="team"
                              brandName={diagnostic.brandName}
                              domain={diagnostic.domain}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-5 mt-5 border-t border-slate-200/80">
                  {!legacyView && (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white shadow shadow-violet-500/20">
                        8
                      </span>
                      <p className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Próximos pasos</p>
                    </div>
                  )}
                  {legacyView ? (
                    <div className="rounded-xl bg-gradient-to-br from-primary-50/60 to-accent-50/40 p-4">
                      <p className="text-sm font-medium text-foreground mb-2">
                        ¿Querés más corridas y reportes completos?
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Elegí un plan para habilitar análisis y reportes completos.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button asChild className="bg-primary-600 hover:bg-primary-700">
                          <Link href="/planes">
                            <LogIn className="mr-2 h-4 w-4" />
                            Ver planes
                          </Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <a href={CLEEXS_MARKETING_URL} target="_blank" rel="noopener noreferrer">
                            Otro diagnóstico
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2.5 py-3 sm:flex-row sm:gap-3">
                      <Button
                        asChild
                        className="h-9 min-w-[160px] rounded-lg bg-primary-600 px-5 text-xs font-semibold shadow-md shadow-primary-600/15 hover:bg-primary-700"
                      >
                        <Link href="/planes" className="inline-flex items-center gap-1.5">
                          <Rocket className="h-3.5 w-3.5" />
                          Ver planes
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="h-9 min-w-[160px] rounded-lg border-2 border-primary-600 bg-white text-xs font-semibold text-primary-700 hover:bg-primary-50"
                      >
                        <a
                          href={CLEEXS_MARKETING_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Otro diagnóstico
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </Fragment>
            )}
          </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

/** Orden alineado con el dashboard CleexsTools37 */
const SATELLITE_TOOL_ROWS: Array<{ key: string; label: string; Icon: LucideIcon }> = [
  { key: 'crawlability', label: 'Crawlability', Icon: Globe },
  { key: 'robots_sitemap', label: 'Robots & Sitemap', Icon: FileSearch },
  { key: 'schema', label: 'Schema', Icon: Braces },
  { key: 'axp', label: 'AXP', Icon: Zap },
  { key: 'ai_presence', label: 'AI Presence', Icon: Sparkles },
  { key: 'citations', label: 'Citations', Icon: Quote },
  { key: 'alerts', label: 'Alerts', Icon: AlertTriangle },
  { key: 'freshness', label: 'Freshness', Icon: Clock },
  { key: 'ai_overview', label: 'AI Overview', Icon: LayoutTemplate },
  { key: 'duplicates', label: 'Duplicados', Icon: Copy },
];

function satelliteScoreColor(score: number, hasError?: boolean) {
  if (hasError) return { border: 'border-l-red-400', icon: 'bg-red-50 text-red-500', bar: 'bg-red-400', text: 'text-red-600' };
  if (score <= 0) return { border: 'border-l-slate-200', icon: 'bg-slate-100 text-slate-400', bar: 'bg-slate-200', text: 'text-slate-400' };
  if (score >= 80) return { border: 'border-l-emerald-400', icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400', text: 'text-emerald-700' };
  if (score >= 50) return { border: 'border-l-amber-400', icon: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400', text: 'text-amber-700' };
  return { border: 'border-l-amber-400', icon: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400', text: 'text-amber-700' };
}

// kept for backward compat (used nowhere else but just in case)
function satelliteScoreStyles(score: number, hasError?: boolean) {
  if (hasError) return 'text-destructive border-destructive/30 bg-destructive/5';
  if (score >= 80) return 'text-emerald-700 border-emerald-200 bg-emerald-50/80';
  if (score >= 50) return 'text-amber-700 border-amber-200 bg-amber-50/80';
  return 'text-red-700 border-red-200 bg-red-50/80';
}

function humanizeDetailKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Claves que nunca mostramos en el resumen (contenido crudo, HTML, cuerpos de respuesta). */
function normalizeDetailKeyForFilter(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}

function shouldOmitDetailFieldKey(key: string): boolean {
  const n = normalizeDetailKeyForFilter(key);
  const omitExact = new Set([
    'raw_content',
    'rawcontent',
    'raw_html',
    'raw_html_body',
    'response_body',
    'response_text',
    'payload',
  ]);
  if (omitExact.has(n)) return true;
  if (n.includes('raw') && (n.includes('content') || n.includes('body'))) return true;
  return false;
}

/** En listados compactos; el panel expandido usa `MAX_DETAIL_STRING_EXPANDED`. */
const MAX_DETAIL_STRING_LEN = 420;
const MAX_DETAIL_STRING_EXPANDED = 12_000;

function looksLikeRawMarkup(text: string): boolean {
  const t = text.trimStart().toLowerCase();
  return (
    t.startsWith('<!doctype') ||
    t.startsWith('<html') ||
    t.startsWith('<?xml') ||
    (t.includes('<head') && t.includes('<body')) ||
    (t.startsWith('<') && t.length > 200 && /<\/[a-z]+>/i.test(t))
  );
}

function formatDetailPrimitive(
  key: string | undefined,
  value: unknown,
  maxStr: number = MAX_DETAIL_STRING_LEN
): string | null {
  if (key !== undefined && shouldOmitDetailFieldKey(key)) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.length) return null;
    if (looksLikeRawMarkup(t)) {
      return 'La respuesta parece HTML o XML (no es texto plano con URLs, como un sitemap o robots.txt legibles línea a línea). En este panel no mostramos el cuerpo completo por tamaño y legibilidad.';
    }
    if (t.length > maxStr) {
      return `${t.slice(0, maxStr)}… [${t.length - maxStr} caracteres más no mostrados aquí]`;
    }
    return t;
  }
  return null;
}

const SUGGESTION_PRIORITY_META: Record<
  string,
  { box: string; Icon: LucideIcon; short: string }
> = {
  critica: {
    box: 'border-red-200/80 bg-red-50/90 text-red-900',
    Icon: ShieldAlert,
    short: 'Crítica',
  },
  alta: {
    box: 'border-amber-200/80 bg-amber-50/90 text-amber-900',
    Icon: AlertTriangle,
    short: 'Alta',
  },
  media: {
    box: 'border-sky-200/80 bg-sky-50/90 text-sky-900',
    Icon: Gauge,
    short: 'Media',
  },
  baja: {
    box: 'border-slate-200/80 bg-slate-50/95 text-slate-800',
    Icon: CircleDot,
    short: 'Baja',
  },
  info: {
    box: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900',
    Icon: Info,
    short: 'Info',
  },
};

function SatelliteValueBlock({
  label,
  value,
  depth,
}: {
  label?: string;
  value: unknown;
  depth: number;
}): React.ReactNode {
  if (depth > 8) {
    return <p className="text-xs italic text-slate-400">Profundidad máxima alcanzada.</p>;
  }
  if (value === null || value === undefined) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-sm">{value ? 'Sí' : 'No'}</span>;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return <span className="text-sm tabular-nums font-medium text-slate-800">{String(value)}</span>;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.length) return <span className="text-sm text-slate-400">—</span>;
    if (looksLikeRawMarkup(t)) {
      return (
        <p className="text-sm text-amber-800 bg-amber-50/80 rounded-lg border border-amber-100 px-3 py-2">
          Contenido tipo HTML/XML omitido en esta vista por seguridad y legibilidad.
        </p>
      );
    }
    const max = MAX_DETAIL_STRING_EXPANDED;
    const shown = t.length > max ? `${t.slice(0, max)}…` : t;
    return (
      <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words max-h-72 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
        {shown}
        {t.length > max ? (
          <span className="mt-2 block text-xs font-medium text-slate-500">
            Total {t.length} caracteres — el resto no se muestra completo en este panel.
          </span>
        ) : null}
      </p>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-sm text-slate-400">Sin ítems</span>;
    }
    if (value.every((x) => typeof x === 'string')) {
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          {(value as string[]).map((s, i) => (
            <li key={i} className="leading-snug break-words">
              {s}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li
            key={i}
            className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm shadow-sm"
          >
            {typeof item === 'object' && item !== null && !Array.isArray(item) ? (
              <div className="space-y-2">
                {Object.entries(item as Record<string, unknown>).map(([ik, iv]) => {
                  if (shouldOmitDetailFieldKey(ik)) return null;
                  return (
                    <div key={ik}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {humanizeDetailKey(ik)}
                      </p>
                      <div className="mt-0.5">{SatelliteValueBlock({ value: iv, depth: depth + 1 })}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              SatelliteValueBlock({ value: item, depth: depth + 1 })
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return (
      <div className="space-y-2 border-l-2 border-slate-200 pl-3">
        {Object.entries(o).map(([k, v]) => {
          if (shouldOmitDetailFieldKey(k)) return null;
          const prim = formatDetailPrimitive(k, v, MAX_DETAIL_STRING_EXPANDED);
          if (prim !== null) {
            return (
              <div key={k}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{humanizeDetailKey(k)}</p>
                <p className="mt-0.5 text-sm text-slate-800">{prim}</p>
              </div>
            );
          }
          return (
            <div key={k}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{humanizeDetailKey(k)}</p>
              <div className="mt-1">{SatelliteValueBlock({ value: v, depth: depth + 1 })}</div>
            </div>
          );
        })}
      </div>
    );
  }
  return <span className="text-sm text-slate-600">{String(value)}</span>;
}

/** Detalle estructurado (similar densidad al panel del Tools): campos simples + listas + objetos anidados. */
function SatelliteDetailSections({ detail }: { detail: Record<string, unknown> }) {
  const skip = new Set(['_truncated', '_note', 'error', 'suggestions', 'score']);
  const rows: { label: string; value: string }[] = [];
  const complex: { key: string; label: string; value: unknown }[] = [];

  for (const [k, v] of Object.entries(detail)) {
    if (skip.has(k)) continue;
    if (shouldOmitDetailFieldKey(k)) continue;
    const prim = formatDetailPrimitive(k, v, MAX_DETAIL_STRING_LEN);
    if (prim !== null) {
      rows.push({ label: humanizeDetailKey(k), value: prim });
      continue;
    }
    if (v !== null && v !== undefined) {
      complex.push({ key: k, label: humanizeDetailKey(k), value: v });
    }
  }

  if (rows.length === 0 && complex.length === 0) return null;

  return (
    <div className="space-y-6">
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <ClipboardList className="h-3.5 w-3.5 text-primary-500" aria-hidden />
            Resumen de campos
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</dt>
                <dd className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {complex.map(({ key, label, value }) => (
        <div key={key} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
            {SatelliteValueBlock({ label, value, depth: 0 })}
          </div>
        </div>
      ))}
    </div>
  );
}

const AEO_SKELETON_HINTS = [
  'Seguimos analizando tu sitio…',
  'En sitios con mucho contenido puede demorar un poco más.',
  'Podés usar el resto del informe arriba; esta sección se actualiza sola.',
  'Estamos consolidando señales técnicas del dominio.',
] as const;

function SatelliteModuleSkeleton() {
  const [hintIdx, setHintIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHintIdx((i) => (i + 1) % AEO_SKELETON_HINTS.length);
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card className="border border-dashed border-primary-200/80 bg-white shadow-md">
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-xl text-foreground">
          <Sparkles className="h-5 w-5 shrink-0 animate-pulse text-primary-600" aria-hidden />
          <span>Análisis técnico del sitio (AEO)</span>
        </CardTitle>
        <div className="space-y-2">
          <div className="aeo-progress-track" aria-hidden />
          <p className="text-sm font-semibold text-primary-900 sm:text-base">Generando análisis técnico del sitio…</p>
          <p
            key={hintIdx}
            className="text-xs leading-relaxed text-slate-600 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 sm:text-sm"
          >
            {AEO_SKELETON_HINTS[hintIdx]}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[4.5rem] rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 animate-pulse"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-[5.25rem] rounded-lg border border-slate-100 bg-slate-50/80 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <div
          className="flex items-start gap-3 rounded-xl border-2 border-primary-200/90 bg-gradient-to-br from-primary-100/95 via-primary-50 to-sky-50/80 px-4 py-4 shadow-md shadow-primary-900/5 sm:items-center sm:gap-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2
            className="h-6 w-6 shrink-0 animate-spin text-primary-700 sm:h-7 sm:w-7"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-snug text-primary-950 sm:text-base">Proceso en curso</p>
            <p className="text-xs leading-relaxed text-primary-900/85 sm:text-sm">
              La página se actualiza sola cuando termine. No hace falta recargar manualmente.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SatelliteToolDetailPanel({
  label,
  toolError,
  detail,
}: {
  label: string;
  toolError?: string;
  detail?: Record<string, unknown>;
}) {
  const err = toolError || (typeof detail?.error === 'string' ? detail.error : null);

  if ((!detail || Object.keys(detail).length === 0) && !err) {
    return (
      <p className="text-left text-sm leading-relaxed text-muted-foreground">
        No hay detalle guardado para <span className="font-medium text-foreground">{label}</span> en este informe.
        Podés generar un diagnóstico nuevo o revisar más adelante si el análisis técnico aún se está completando.
      </p>
    );
  }

  const truncated = detail?._truncated === true;
  const note = typeof detail?._note === 'string' ? detail._note : null;
  const suggestions = detail && Array.isArray(detail.suggestions) ? detail.suggestions : null;

  return (
    <div className="space-y-5 text-left font-sans">
      {err && (
        <div className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="leading-snug">{err}</p>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            Sugerencias ({suggestions.length})
          </p>
          <ul className="space-y-2">
            {suggestions.map((s: unknown, i: number) => {
              const item = s as { message?: string; priority?: string; detail?: string; action?: string };
              const message = (item.message || '').trim();
              if (!message) return null;
              const p = (item.priority || 'info').trim().toLowerCase();
              const meta = SUGGESTION_PRIORITY_META[p] || SUGGESTION_PRIORITY_META.info;
              const PriIcon = meta.Icon;
              return (
                <li key={i} className={cn('rounded-lg border px-3 py-3', meta.box)}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <PriIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        meta.box
                      )}
                    >
                      {meta.short}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{message}</p>
                  {item.action && (
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed">→ {item.action}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {detail && <SatelliteDetailSections detail={detail} />}

      {truncated && note ? (
        <div className="flex gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <p>{note}</p>
        </div>
      ) : null}
    </div>
  );
}

function toolLabelFromSatelliteSource(source: string): string {
  return SATELLITE_TOOL_ROWS.find((r) => r.key === source)?.label ?? source.replace(/_/g, ' ');
}

function countByActionPriority(actions: PublicDiagnosticSatelliteModule['actions']) {
  const c = { critica: 0, alta: 0, media: 0, baja: 0, info: 0 };
  for (const a of actions) {
    const p = (a.priority || 'info').trim().toLowerCase();
    if (p in c) c[p as keyof typeof c] += 1;
    else c.info += 1;
  }
  return c;
}

const ACTION_PILL_META: Record<
  string,
  { label: string; className: string }
> = {
  critica: { label: 'CRÍTICO', className: 'border-red-400 bg-red-50 text-red-900' },
  alta: { label: 'ALTA', className: 'border-amber-400 bg-amber-50 text-amber-950' },
  media: { label: 'MEDIA', className: 'border-sky-400 bg-sky-50 text-sky-950' },
  baja: { label: 'BAJA', className: 'border-slate-300 bg-slate-50 text-slate-800' },
  info: { label: 'INFO', className: 'border-emerald-400 bg-emerald-50 text-emerald-950' },
};

/** Prioridad visual del borde izquierdo en tarjetas de acción (orden de severidad). */
function actionCardBorderClass(priority: string): string {
  const p = priority.trim().toLowerCase();
  if (p === 'critica') return 'border-l-red-500';
  if (p === 'alta') return 'border-l-amber-500';
  if (p === 'media') return 'border-l-sky-500';
  if (p === 'baja') return 'border-l-slate-400';
  return 'border-l-emerald-500';
}

function isSatelliteModuleDegraded(module: PublicDiagnosticSatelliteModule): boolean {
  const nTools = Object.keys(module.tools || {}).length;
  const nActions = module.actions?.length ?? 0;
  const noPayload = nTools === 0 && nActions === 0;
  if (module.status === 'timeout' || module.status === 'failed' || module.status === 'skipped') return true;
  if (module.status === 'completed' && noPayload) return true;
  return false;
}

function SatelliteAeoDegradedNotice({
  module,
  siteUrl,
}: {
  module: PublicDiagnosticSatelliteModule;
  siteUrl: string;
}) {
  const title =
    module.status === 'timeout'
      ? 'Tiempo de espera agotado'
      : module.status === 'failed'
        ? 'No pudimos analizar el sitio desde aquí'
        : module.status === 'skipped'
          ? 'Análisis técnico no ejecutado'
          : 'Sin datos de herramientas en esta corrida';

  const body =
    module.status === 'timeout'
      ? 'El análisis técnico del sitio tardó más de lo que el servidor pudo esperar. No guardamos scores ni detalle: no es que el sitio saque cero, es que la corrida no llegó a completarse.'
      : module.status === 'failed'
        ? module.error?.trim() ||
          'El servicio de análisis del sitio respondió con error. Volvé a intentar más tarde o generá un diagnóstico nuevo con la misma URL.'
        : module.status === 'skipped'
          ? 'Este diagnóstico no incluye URL de sitio o el módulo AEO está desactivado.'
          : 'La corrida figura como completada pero no recibimos resultados por herramienta. Podés generar un diagnóstico nuevo o revisar el sitio con tu equipo técnico.';

  const toolsUrl = CLEEXS_TOOLS_PUBLIC_URL;

  return (
    <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/40 p-5 shadow-sm ring-1 ring-amber-100/80 sm:p-6">
      <div className="flex gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-inner">
          <AlertCircle className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-base font-bold tracking-tight text-slate-900">{title}</p>
          <p className="text-sm leading-relaxed text-slate-700">{body}</p>
          {siteUrl ? (
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">URL prevista:</span>{' '}
              <a href={siteUrl} className="text-primary-600 underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                {siteUrl}
              </a>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {toolsUrl ? (
              <a
                href={toolsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
              >
                Ver análisis técnico ampliado
                <ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
              </a>
            ) : null}
            <Link
              href="/diagnostico/crear"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Nuevo diagnóstico
            </Link>
          </div>
          {!toolsUrl ? (
            <p className="text-xs text-slate-500">
              Si tu organización tiene un enlace propio al análisis técnico ampliado, puede configurarse en el
              despliegue:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">NEXT_PUBLIC_CLEEXS_TOOLS_URL</code>{' '}
              (solo equipo técnico).
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SatelliteActionsExecuteBlock({ module }: { module: PublicDiagnosticSatelliteModule }) {
  const actions = module.actions ?? [];
  const counts = countByActionPriority(actions);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const total = actions.length;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-teal-800/25 shadow-md shadow-teal-900/10 ring-1 ring-teal-900/10"
      aria-labelledby={headingId}
    >
      <button
        type="button"
        id={headingId}
        className="flex w-full flex-wrap items-center gap-3 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-700 px-4 py-3.5 text-left transition hover:brightness-[1.03] sm:px-5"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
          <ChevronDown
            className={cn('h-5 w-5 transition-transform duration-200', expanded && 'rotate-180')}
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-base font-bold tracking-tight text-white sm:text-lg">Acciones a ejecutar</span>
          <span className="mt-0.5 block text-xs font-medium leading-snug text-white/90 sm:text-sm">
            Prioridades del análisis técnico del sitio (AEO).{' '}
            <span className="text-white/85">
              {total > 0
                ? `${total} tareas · tocá para ${expanded ? 'ocultar' : 'ver'} píldoras y lista.`
                : expanded
                  ? 'Tocá de nuevo para ocultar.'
                  : 'Tocá para ver el mensaje cuando no hay acciones.'}
            </span>
          </span>
        </div>
        <ListChecks className="hidden h-7 w-7 shrink-0 text-white/85 sm:block" aria-hidden />
      </button>

      {expanded ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="space-y-4 border-t border-teal-900/20 bg-white px-4 py-4 sm:px-5 sm:py-5"
        >
          {actions.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(['critica', 'alta', 'media', 'baja', 'info'] as const).map((pk) => {
                  const n = counts[pk];
                  if (n <= 0) return null;
                  const meta = ACTION_PILL_META[pk];
                  return (
                    <span
                      key={pk}
                      className={cn(
                        'inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold tabular-nums',
                        meta.className
                      )}
                    >
                      {meta.label}: {n}
                    </span>
                  );
                })}
              </div>

              <ul className="space-y-3">
                {actions.map((action, idx) => {
                  const p = (action.priority || 'info').trim().toLowerCase();
                  const meta = SUGGESTION_PRIORITY_META[p] || SUGGESTION_PRIORITY_META.info;
                  const PriIcon = meta.Icon;
                  const src = toolLabelFromSatelliteSource(action.source);
                  return (
                    <li
                      key={`${action.source}-${idx}-${action.message.slice(0, 24)}`}
                      className={cn(
                        'rounded-xl border border-slate-200 bg-white pl-4 pr-4 py-4 shadow-sm sm:pl-5',
                        'border-l-[5px]',
                        actionCardBorderClass(p)
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <PriIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            meta.box
                          )}
                        >
                          {meta.short}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {src}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-bold leading-snug text-slate-900">{action.message}</p>
                      {action.detail ? (
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{action.detail}</p>
                      ) : null}
                      {action.action ? (
                        <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-indigo-800">
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>{action.action}</span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No se generaron acciones agrupadas para este sitio en esta corrida. Revisá el detalle en cada tarjeta de
              herramienta o consultá con tu equipo si hace falta un análisis más profundo.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function SatelliteModuleCard({
  module,
  siteUrl,
}: {
  module: PublicDiagnosticSatelliteModule;
  siteUrl: string;
}) {
  const [openToolKey, setOpenToolKey] = useState<string | null>(null);

  useEffect(() => {
    if (!openToolKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenToolKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openToolKey]);

  useEffect(() => {
    if (openToolKey) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [openToolKey]);

  const statusLabel =
    module.status === 'completed' ? 'Completado'
    : module.status === 'timeout' ? 'Tiempo agotado'
    : module.status === 'failed' ? 'Error'
    : module.status === 'skipped' ? 'Omitido'
    : module.status === 'pending' ? 'En proceso'
    : 'No disponible';

  const totalTools = Object.keys(module.tools || {}).length;
  const degraded = isSatelliteModuleDegraded(module);
  const overallStyle = satelliteScoreColor(module.overallScore, false);

  const openRow = openToolKey ? SATELLITE_TOOL_ROWS.find((r) => r.key === openToolKey) : null;
  const openTool = openRow && openToolKey ? module.tools[openToolKey] : undefined;
  const openScore = openTool?.score ?? 0;
  const openHasStoredDetail =
    Boolean(openTool?.error) ||
    (openTool?.detail &&
      typeof openTool.detail === 'object' &&
      !Array.isArray(openTool.detail) &&
      Object.keys(openTool.detail).length > 0);

  const toolModal =
    openRow && openToolKey
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
              aria-label="Cerrar panel"
              onClick={() => setOpenToolKey(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="satellite-tool-dialog-title"
              className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p id="satellite-tool-dialog-title" className="truncate text-base font-bold text-slate-900">
                    {openRow.label}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-slate-600">
                    {degraded ? 'Sin datos en esta corrida' : `Score ${Math.round(openScore)}`}
                  </p>
                  {!openHasStoredDetail ? (
                    <p className="mt-1 text-xs font-medium text-amber-800/90">
                      No hay detalle guardado para esta herramienta en el diagnóstico público.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenToolKey(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                <SatelliteToolDetailPanel
                  label={openRow.label}
                  toolError={openTool?.error}
                  detail={openTool?.detail}
                />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100/80">

      {toolModal}

      <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/60 via-white to-sky-50/50 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-200/60 bg-white text-violet-700 shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Análisis técnico del sitio (AEO)</p>
            <p className="text-xs leading-relaxed text-slate-600">
              {degraded
                ? 'Cuando la corrida falla o hace timeout, no mostramos scores vacíos como si fueran reales.'
                : 'Tocá una herramienta para ver el detalle. Abajo, acciones priorizadas según el análisis técnico.'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Score global</p>
          {degraded ? (
            <p className="text-2xl font-black tabular-nums leading-none text-slate-400">N/D</p>
          ) : (
            <p className={cn('text-3xl font-black leading-none tabular-nums', overallStyle.text)}>
              {module.overallScore.toFixed(0)}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6 bg-slate-50/50 p-5 sm:p-6">
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <p>
            <span className="font-semibold text-slate-800">Sitio analizado:</span>{' '}
            {siteUrl ? (
              <a href={siteUrl} className="text-primary-600 underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                {siteUrl}
              </a>
            ) : (
              '—'
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Estado: <span className="font-medium text-slate-700">{statusLabel}</span>
            {degraded ? null : (
              <>
                {' '}
                · {totalTools} herramientas con datos · Si algo aparece recortado, parte del volcado técnico puede no
                mostrarse completo en esta vista.
              </>
            )}
          </p>
        </div>

        {degraded ? (
          <SatelliteAeoDegradedNotice module={module} siteUrl={siteUrl} />
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Herramientas (1–10)</p>
                <p className="text-xs text-slate-500">Clic para abrir el detalle en un panel.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {SATELLITE_TOOL_ROWS.map(({ key, label, Icon: ToolIcon }, idx) => {
                const t = module.tools[key];
                const score = t?.score ?? 0;
                const hasErr = Boolean(t?.error);
                const colors = satelliteScoreColor(score, hasErr);
                const labelShort = label.length > 16 ? `${label.slice(0, 14)}…` : label;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOpenToolKey(key)}
                    className={cn(
                      'group flex flex-col rounded-2xl border border-slate-200/90 bg-white p-3 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80',
                      openToolKey === key && 'border-violet-400 ring-2 ring-violet-300/80 shadow-md'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 group-hover:bg-violet-100 group-hover:text-violet-800">
                        {idx + 1}
                      </span>
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', colors.icon)}>
                        <ToolIcon className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs font-bold leading-tight text-slate-900" title={label}>
                      {labelShort}
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Detalle</span>
                      <span className={cn('text-lg font-black tabular-nums leading-none', colors.text)}>
                        {score > 0 ? Math.round(score) : '—'}
                      </span>
                    </div>
                    {hasErr ? (
                      <span className="mt-1 text-[10px] font-medium text-red-600">Error</span>
                    ) : score >= 80 ? (
                      <span className="mt-1 text-[10px] font-medium text-emerald-600">Muy bien</span>
                    ) : score > 0 ? (
                      <span className="mt-1 text-[10px] font-medium text-slate-500">Revisar</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!degraded && <SatelliteActionsExecuteBlock module={module} />}
        {degraded && (module.actions?.length ?? 0) > 0 ? <SatelliteActionsExecuteBlock module={module} /> : null}
      </div>
    </div>
  );
}

function AnalisisLLMTextual({
  modelo,
  analisis,
  brandName,
}: {
  modelo: 'perplexity' | 'claude';
  analisis: import('@/lib/api').DiagnosticAnalysisSingle;
  brandName: string;
}) {
  const meta = modelo === 'perplexity'
    ? {
        nombre: 'Perplexity',
        descripcion: 'Motor de búsqueda con IA basado en resultados web recientes.',
        color: 'from-violet-500 to-fuchsia-600',
        chip: 'Premium · Perplexity',
      }
    : {
        nombre: 'Claude',
        descripcion: 'Modelo de Anthropic, conocido por su razonamiento estructurado.',
        color: 'from-amber-500 to-orange-600',
        chip: 'Premium · Claude (Anthropic)',
      };

  return (
    <div className="space-y-5">
      <div className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.color} text-white shadow-md`}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900">
              Así te ven en {meta.nombre}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">{meta.descripcion}</p>
            <p className="text-[11px] mt-1 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700 ring-1 ring-primary-200">
              {meta.chip}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Este análisis es cualitativo (resumen, fortalezas, debilidades y sugerencias específicas de {meta.nombre} para
          {' '}{brandName}). Los rankings cuantitativos (Top 3, Cleexs Score, gráficos) se calculan a partir de las
          corridas de ChatGPT y Gemini, disponibles en las otras pestañas.
        </p>
      </div>

      <Card className="border-transparent bg-white shadow-md">
        <CardContent className="p-5 sm:p-6">
          <BlockAnalisisUnico a={analisis} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerResultadoPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </main>
    }>
      <VerResultadoContent />
    </Suspense>
  );
}
