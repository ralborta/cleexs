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
  type PublicDiagnostic,
  type PublicDiagnosticSatelliteModule,
  type PublicDiagnosticRunResult,
  type PublicDiagnosticPromptResult,
} from '@/lib/api';
import { CLEEXS_MARKETING_URL, CLEEXS_TOOLS_PUBLIC_URL } from '@/lib/site';
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
import { ReporteModerno } from '../reporte-moderno';
import { EnginePaywallModal } from '@/components/diagnostico/engine-paywall-modal';
import { SatelliteModuleCard, SatelliteModuleSkeleton } from '@/components/diagnostico/satellite-aeo-report';
import { ReporteCorridas } from '../reporte-corridas';
import {
  PlanConquistarEnginesAfterSummary,
  PlanConquistarEconomicSection,
  PlanConquistarUpsellTeaser,
} from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import { CrawlerAccessTeaser } from '@/components/diagnostico/crawler-access-teaser';
import { buildPlanConquistarTeaserData } from '@/lib/plan-conquistar-preview';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { ShareScoreButtons } from '@/components/share/share-score-buttons';
import { appendQueryToPath, buildShareTrackingQuery } from '@/lib/share-tracking';
import { DomainRatingPanel, DomainRatingTeaser } from '@/components/report/domain-rating-block';
import { buildEngineScoresFromDiagnostic, type EngineCardKey } from '@/components/diagnostico/cleexs-engine-scores-panel';
import type { DomainRatingSnapshot } from '@/lib/api';

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
function ReporteFreemium({
  runResult,
  domainRating,
  diagnosticId,
  customerEmail,
}: {
  runResult: PublicDiagnosticRunResult;
  domainRating?: DomainRatingSnapshot | null;
  diagnosticId?: string | null;
  customerEmail?: string | null;
}) {
  const planesHref =
    diagnosticId != null
      ? `/planes?diagnosticId=${encodeURIComponent(diagnosticId)}${customerEmail ? `&email=${encodeURIComponent(customerEmail)}` : ''}`
      : '/planes';
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

      {domainRating ? <DomainRatingTeaser data={domainRating} /> : null}

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
              <Link href={planesHref}>
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

/**
 * Construye un runResult sintético "Consolidado" promediando los scores de los modelos
 * disponibles (ChatGPT + Gemini + Perplexity + Claude). Si hay 1 solo run, lo devuelve igual.
 */
function buildRunResultConsolidado(
  runs: PublicDiagnosticRunResult[]
): PublicDiagnosticRunResult {
  const base = runs[0];
  if (runs.length === 1) return base;
  const baseResults = base.promptResults || [];
  const promptResults = baseResults.map((pr, i) => {
    const scores = runs
      .map((r) => r.promptResults?.[i]?.score)
      .filter((s): s is number => typeof s === 'number');
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : pr.score;
    return { ...pr, score: avg };
  });
  const cleexsScore =
    runs.reduce((s, r) => s + (r.cleexsScore ?? 0), 0) / runs.length;
  const competitorDetails =
    base.competitorDetails ?? runs.find((r) => r.competitorDetails)?.competitorDetails ?? [];
  return {
    brandId: base.brandId,
    brandName: base.brandName,
    cleexsScore,
    competitors: base.competitors ?? [],
    competitorDetails,
    brandAliases: base.brandAliases ?? [],
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
              <div className="-mx-1 overflow-x-auto">
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
                          {(row.sampleReason && row.sampleReason.replace(/\*+/g, '').trim().length >= 2) ? row.sampleReason.replace(/\*+/g, '').trim() : '...'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
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
  const [paywallEngine, setPaywallEngine] = useState<string | null>(null);

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
      !diagnostic.domain.startsWith('brand-') &&
      (diagnostic.satelliteModule?.status === 'pending' ||
        (diagnostic.satelliteModule?.status === 'failed' &&
          Object.keys(diagnostic.satelliteModule.tools || {}).length === 0) ||
        (diagnostic.satelliteModule?.status === 'timeout' &&
          Object.keys(diagnostic.satelliteModule.tools || {}).length === 0));
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
          !data.domain.startsWith('brand-') &&
          (data.satelliteModule?.status === 'pending' ||
            (data.satelliteModule?.status === 'failed' &&
              Object.keys(data.satelliteModule.tools || {}).length === 0) ||
            (data.satelliteModule?.status === 'timeout' &&
              Object.keys(data.satelliteModule.tools || {}).length === 0));
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

  // Si Gemini/Perplexity/Claude fueron iniciados pero aún no terminaron, seguir refrescando
  // hasta que aparezcan sus runResult o el diagnóstico falle.
  useEffect(() => {
    const id = diagnosticId;
    if (!id || !diagnostic) return;
    if (diagnostic.status !== 'completed' || !diagnostic.showFullReport) return;
    const pendingGemini = !!diagnostic.runGeminiId && !diagnostic.runResultGemini;
    const pendingPerplexity = !!diagnostic.runPerplexityId && !diagnostic.runResultPerplexity;
    const pendingClaude = !!diagnostic.runClaudeId && !diagnostic.runResultClaude;
    if (!pendingGemini && !pendingPerplexity && !pendingClaude) return;

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
        const stillPendingGemini = !!data.runGeminiId && !data.runResultGemini;
        const stillPendingPerplexity = !!data.runPerplexityId && !data.runResultPerplexity;
        const stillPendingClaude = !!data.runClaudeId && !data.runResultClaude;
        if (
          data.status === 'failed' ||
          (!stillPendingGemini && !stillPendingPerplexity && !stillPendingClaude)
        ) {
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

  const runResultPerplexityEarly = diagnostic?.runResultPerplexity;
  const runResultClaudeEarly = diagnostic?.runResultClaude;
  const tienePerplexity = !!runResultPerplexityEarly;
  const tieneClaude = !!runResultClaudeEarly;
  const runResultGeminiEarly = diagnostic?.runResultGemini;
  useEffect(() => {
    if (!runResultGeminiEarly && diagnostic?.showFullReport) {
      setVistaModelo((v) => (v === 'gemini' ? 'chatgpt' : v));
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
          <p className="mt-4 text-muted-foreground">Cargando resultado...</p>
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
    ? appendQueryToPath(`/ver-resultado/bkp?diagnosticId=${encodeURIComponent(diagnostic.id)}`, teamTrackingQuery)
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
  const runResultPerplexity = diagnostic.runResultPerplexity;
  const runResultClaude = diagnostic.runResultClaude;
  const runsParaConsolidado: PublicDiagnosticRunResult[] = [];
  if (runResult) runsParaConsolidado.push(runResult);
  if (runResultGemini) runsParaConsolidado.push(runResultGemini);
  if (runResultPerplexity) runsParaConsolidado.push(runResultPerplexity);
  if (runResultClaude) runsParaConsolidado.push(runResultClaude);

  /** Selector por motor: siempre en reporte completo (motores extra con candado en free). */
  const mostrarTabsPorModelo =
    diagnostic.showFullReport &&
    (Boolean(diagnostic.showPlanConquistarUpsell) ||
      Boolean(diagnostic.runGeminiId) ||
      Boolean(diagnostic.runPerplexityId) ||
      Boolean(diagnostic.runClaudeId) ||
      tieneGemini ||
      tienePerplexity ||
      tieneClaude);
  const geminiFallo = diagnostic.geminiRunStatus === 'failed';
  const geminiEnCola = Boolean(diagnostic.runGeminiId) && !runResultGemini && !geminiFallo;
  const perplexityFallo = diagnostic.perplexityRunStatus === 'failed';
  const perplexityEnCola =
    Boolean(diagnostic.runPerplexityId) && !runResultPerplexity && !perplexityFallo;
  const claudeFallo = diagnostic.claudeRunStatus === 'failed';
  const claudeEnCola = Boolean(diagnostic.runClaudeId) && !runResultClaude && !claudeFallo;
  /**
   * Motor "bloqueado por Premium": no hay resultado, no se está generando y no falló;
   * simplemente nunca se corrió porque es exclusivo de planes Premium. Al clickearlo
   * mostramos el upsell del Plan Conquistar en vez de un botón muerto.
   */
  const geminiLocked = !runResultGemini && !geminiEnCola && !geminiFallo;
  const perplexityLocked = !runResultPerplexity && !perplexityEnCola && !perplexityFallo;
  const claudeLocked = !runResultClaude && !claudeEnCola && !claudeFallo;
  /**
   * Post-proceso: la API puede guardar primero el análisis IA y luego fusionar el módulo técnico del sitio (AEO).
   * Mientras el satélite corre, `satelliteModule.status === 'pending'`.
   */
  const satelliteAeoPending = diagnostic.satelliteModule?.status === 'pending';
  const satelliteAeoRecovering =
    Boolean(diagnostic.satelliteModule) &&
    (diagnostic.satelliteModule?.status === 'failed' ||
      diagnostic.satelliteModule?.status === 'timeout') &&
    Object.keys(diagnostic.satelliteModule?.tools || {}).length === 0;
  const showSatelliteSkeleton =
    isCompleted &&
    diagnostic.showFullReport &&
    !diagnostic.domain.startsWith('brand-') &&
    (diagnostic.analysisJson == null || satelliteAeoPending || satelliteAeoRecovering);
  const runResultToShow: PublicDiagnosticRunResult | null = (() => {
    if (!runResult) return null;
    if (vistaModelo === 'gemini' && runResultGemini) return runResultGemini;
    if (vistaModelo === 'perplexity' && runResultPerplexity) return runResultPerplexity;
    if (vistaModelo === 'claude' && runResultClaude) return runResultClaude;
    if (vistaModelo === 'consolidado' && runsParaConsolidado.length >= 2) {
      return buildRunResultConsolidado(runsParaConsolidado);
    }
    return runResult;
  })();

  const enginePaywallLabel: Record<EngineCardKey, string | null> = {
    chatgpt: null,
    gemini: 'Gemini',
    claude: 'Claude',
    perplexity: 'Perplexity',
  };

  const engineScoresForPanel = runResult
    ? buildEngineScoresFromDiagnostic({
        chatgptScore: runResult.cleexsScore,
        runResultGemini,
        runResultPerplexity,
        runResultClaude,
        geminiRunStatus: diagnostic.geminiRunStatus,
        perplexityRunStatus: diagnostic.perplexityRunStatus,
        claudeRunStatus: diagnostic.claudeRunStatus,
        runGeminiId: diagnostic.runGeminiId,
        runPerplexityId: diagnostic.runPerplexityId,
        runClaudeId: diagnostic.runClaudeId,
        lockUnavailableEngines: Boolean(diagnostic.showPlanConquistarUpsell),
      })
    : null;

  const planConquistarTeaserData =
    diagnostic.showPlanConquistarUpsell && runResult
      ? buildPlanConquistarTeaserData(
          runResult,
          satelliteModule,
          satelliteSiteUrl,
          diagnostic.domainRating,
          engineScoresForPanel ?? undefined,
        )
      : null;

  const afterSummaryEnginesSlot =
    engineScoresForPanel && diagnostic.showFullReport ? (
      <PlanConquistarEnginesAfterSummary
        engines={engineScoresForPanel}
        upsell={Boolean(diagnostic.showPlanConquistarUpsell)}
        onLockedClick={(engine) => {
          const label = enginePaywallLabel[engine];
          if (label) setPaywallEngine(label);
        }}
      />
    ) : null;

  const planesHref =
    diagnostic.id != null
      ? `/planes?diagnosticId=${encodeURIComponent(diagnostic.id)}${diagnostic.email ? `&email=${encodeURIComponent(diagnostic.email)}` : ''}`
      : '/planes';

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
                  {!diagnostic.domain.startsWith('brand-') && ` ? ${diagnostic.domain}`}
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
                                disabled={!runResultGemini && !geminiLocked}
                                title={
                                  geminiFallo
                                    ? 'Gemini no completó esta corrida.'
                                    : geminiEnCola
                                      ? 'Generando resultados con Gemini...'
                                      : runResultGemini
                                        ? 'Ver métricas según respuestas de Gemini'
                                        : 'Disponible con Plan Conquistar (Premium).'
                                }
                                onClick={() =>
                                  runResultGemini
                                    ? setVistaModelo('gemini')
                                    : geminiLocked
                                      ? setPaywallEngine('Gemini')
                                      : undefined
                                }
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'gemini' && runResultGemini
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : geminiLocked
                                      ? 'bg-white text-slate-500 shadow-sm ring-1 ring-violet-200 hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-300'
                                      : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                {geminiEnCola ? (
                                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary-600" />
                                ) : geminiLocked ? (
                                  <Lock className="h-[14px] w-[14px] shrink-0 text-violet-500" />
                                ) : (
                                  <CleexsMark className="h-[18px] w-[18px] shrink-0" />
                                )}
                                {geminiFallo ? 'Gemini (no disponible)' : 'Gemini'}
                              </button>
                              <button
                                type="button"
                                disabled={!runResultPerplexity && !perplexityLocked}
                                title={
                                  perplexityFallo
                                    ? 'Perplexity no completó esta corrida.'
                                    : perplexityEnCola
                                      ? 'Generando resultados con Perplexity...'
                                      : runResultPerplexity
                                        ? 'Ver métricas según respuestas de Perplexity'
                                        : 'Disponible solo en planes Premium con OpenRouter.'
                                }
                                onClick={() =>
                                  runResultPerplexity
                                    ? setVistaModelo('perplexity')
                                    : perplexityLocked
                                      ? setPaywallEngine('Perplexity')
                                      : undefined
                                }
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'perplexity' && runResultPerplexity
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : perplexityLocked
                                      ? 'bg-white text-slate-500 shadow-sm ring-1 ring-violet-200 hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-300'
                                      : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                {perplexityEnCola ? (
                                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary-600" />
                                ) : perplexityLocked ? (
                                  <Lock className="h-[14px] w-[14px] shrink-0 text-violet-500" />
                                ) : (
                                  <Sparkles className="h-[18px] w-[18px] shrink-0" />
                                )}
                                {perplexityFallo ? 'Perplexity (no disponible)' : 'Perplexity'}
                              </button>
                              <button
                                type="button"
                                disabled={!runResultClaude && !claudeLocked}
                                title={
                                  claudeFallo
                                    ? 'Claude no completó esta corrida.'
                                    : claudeEnCola
                                      ? 'Generando resultados con Claude...'
                                      : runResultClaude
                                        ? 'Ver métricas según respuestas de Claude'
                                        : 'Disponible solo en planes Premium con OpenRouter.'
                                }
                                onClick={() =>
                                  runResultClaude
                                    ? setVistaModelo('claude')
                                    : claudeLocked
                                      ? setPaywallEngine('Claude')
                                      : undefined
                                }
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'claude' && runResultClaude
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : claudeLocked
                                      ? 'bg-white text-slate-500 shadow-sm ring-1 ring-violet-200 hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-300'
                                      : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                {claudeEnCola ? (
                                  <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary-600" />
                                ) : claudeLocked ? (
                                  <Lock className="h-[14px] w-[14px] shrink-0 text-violet-500" />
                                ) : (
                                  <Sparkles className="h-[18px] w-[18px] shrink-0" />
                                )}
                                {claudeFallo ? 'Claude (no disponible)' : 'Claude'}
                              </button>
                              <button
                                type="button"
                                disabled={runsParaConsolidado.length < 2}
                                title={
                                  runsParaConsolidado.length < 2
                                    ? 'Disponible cuando termine al menos un segundo LLM.'
                                    : `Promedio de ${runsParaConsolidado.length} LLMs disponibles.`
                                }
                                onClick={() =>
                                  runsParaConsolidado.length >= 2 && setVistaModelo('consolidado')
                                }
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'consolidado' && runsParaConsolidado.length >= 2
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-1'
                                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:shadow hover:ring-slate-300'
                                }`}
                              >
                                <LayoutDashboard className="h-4 w-4 shrink-0" />
                                Consolidado
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
                      <EnginePaywallModal
                        open={paywallEngine !== null}
                        engineName={paywallEngine}
                        onClose={() => setPaywallEngine(null)}
                      />
                      {runResultToShow &&
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
                                {satelliteModule &&
                                  satelliteModule.status !== 'pending' &&
                                  !satelliteAeoRecovering && (
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
                            beforeSatelliteSlot={
                              satelliteModule &&
                              satelliteModule.status !== 'pending' &&
                              !satelliteAeoRecovering ? (
                                <CrawlerAccessTeaser module={satelliteModule} siteUrl={satelliteSiteUrl} />
                              ) : null
                            }
                            satelliteBlock={
                              !diagnostic.domain.startsWith('brand-') &&
                              (showSatelliteSkeleton ||
                                (satelliteModule &&
                                  satelliteModule.status !== 'pending' &&
                                  !satelliteAeoRecovering)) ? (
                                <>
                                  {showSatelliteSkeleton && <SatelliteModuleSkeleton />}
                                  {satelliteModule &&
                                    satelliteModule.status !== 'pending' &&
                                    !satelliteAeoRecovering && (
                                    <SatelliteModuleCard module={satelliteModule} siteUrl={satelliteSiteUrl} />
                                  )}
                                </>
                              ) : null
                            }
                            appendSlot={
                              planConquistarTeaserData ? (
                                <>
                                  <PlanConquistarEconomicSection />
                                  <PlanConquistarUpsellTeaser
                                    data={planConquistarTeaserData}
                                    diagnosticId={diagnostic.id}
                                    customerEmail={diagnostic.email}
                                  />
                                </>
                              ) : null
                            }
                            afterSummarySlot={
                              <>
                                {afterSummaryEnginesSlot}
                                {!diagnostic.showPlanConquistarUpsell && diagnostic.domainRating ? (
                                  diagnostic.showFullReport &&
                                  diagnostic.domainRating.competitors.length > 0 ? (
                                    <DomainRatingPanel data={diagnostic.domainRating} />
                                  ) : (
                                    <DomainRatingTeaser data={diagnostic.domainRating} />
                                  )
                                ) : null}
                              </>
                            }
                          />
                        ))}
                    </div>
                  ) : (
                    <ReporteFreemium
                      runResult={runResult}
                      domainRating={diagnostic.domainRating}
                      diagnosticId={diagnostic.id}
                      customerEmail={diagnostic.email}
                    />
                  )
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                    <p className="font-medium">Diagnóstico listo</p>
                    <p className="text-sm mt-1">Cargando detalle del reporte...</p>
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
                                  <p className="text-[11px] text-teal-800/80">Uso interno ? mismo informe que ves ac?</p>
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
                              path={teamInvitePath || `/ver-resultado/bkp?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
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
                              path={teamInvitePath || `/ver-resultado/bkp?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
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
                          <Link href={planesHref}>
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
                        <Link href={planesHref} className="inline-flex items-center gap-1.5">
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
