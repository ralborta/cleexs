'use client';

import { useSearchParams } from 'next/navigation';
import React, { Fragment, Suspense, useEffect, useState } from 'react';
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
import type { LucideIcon } from 'lucide-react';
import {
  Loader2,
  LogIn,
  FileCheck,
  AlertCircle,
  Lock,
  LayoutDashboard,
  Sparkles,
  ChevronDown,
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
  BarChart2,
  Layers,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReporteModerno } from './reporte-moderno';
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
              <Link href="/diagnostico/crear">
                Otro diagnóstico
              </Link>
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

  const comparisonSummary = buildComparisonSummary(results);
  const competitorsUsed =
    runResult.competitors?.length > 0
      ? runResult.competitors
      : Array.from(new Set(comparisonSummary.filter((r) => r.type === 'competitor').map((r) => r.name)));

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
  const tierFromQuery = searchParams.get('tier') === 'gold' ? 'gold' : undefined;
  const [diagnostic, setDiagnostic] = useState<PublicDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaModelo, setVistaModelo] = useState<'consolidado' | 'chatgpt' | 'gemini'>('chatgpt');

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

  // Si está completado y debería tener análisis pero aún no llegó (se genera en background), hacer polling
  useEffect(() => {
    const id = diagnosticId;
    if (
      !id ||
      !diagnostic ||
      diagnostic.status !== 'completed' ||
      !diagnostic.showFullReport ||
      diagnostic.analysisJson != null
    ) {
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
        if (data.status === 'failed' || data.analysisJson != null) {
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

  const runResultGeminiEarly = diagnostic?.runResultGemini;
  useEffect(() => {
    if (!runResultGeminiEarly && diagnostic?.showFullReport) {
      setVistaModelo((v) => (v === 'gemini' || v === 'consolidado' ? 'chatgpt' : v));
    }
  }, [runResultGeminiEarly, diagnostic?.showFullReport]);

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
  const publicSiteBase =
    (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
      /\/$/,
      ''
    );
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
  const sharePublicFullUrl =
    publicSiteBase && scoreSharePath ? `${publicSiteBase}${scoreSharePath}` : scoreSharePath;
  const teamInviteFullUrl =
    publicSiteBase && teamInvitePath ? `${publicSiteBase}${teamInvitePath}` : teamInvitePath;
  const runResult = diagnostic.runResult;
  const runResultGemini = diagnostic.runResultGemini;
  const satelliteModule = diagnostic.satelliteModule;
  const satelliteSiteUrl =
    satelliteModule != null
      ? satelliteModule.targetUrl ||
        (!diagnostic.domain.startsWith('brand-') ? `https://${diagnostic.domain}` : '')
      : '';
  const tieneGemini = !!runResultGemini;
  /** Hubo segundo run (Gemini) o ya hay resultado: mostramos las 3 pestañas desde el principio. */
  const mostrarTabsPorModelo =
    diagnostic.showFullReport && (Boolean(diagnostic.runGeminiId) || tieneGemini);
  const geminiFallo = diagnostic.geminiRunStatus === 'failed';
  const geminiEnCola = Boolean(diagnostic.runGeminiId) && !runResultGemini && !geminiFallo;
  /** Mientras el backend termina de guardar analysisJson (incluye módulo satélite), mostramos placeholder animado. */
  const showSatelliteSkeleton =
    isCompleted &&
    diagnostic.showFullReport &&
    !diagnostic.domain.startsWith('brand-') &&
    !satelliteModule &&
    diagnostic.analysisJson == null;
  const runResultToShow: PublicDiagnosticRunResult | null = runResult
    ? vistaModelo === 'consolidado' && runResultGemini
      ? buildRunResultAmbos(runResult, runResultGemini)
      : vistaModelo === 'gemini' && runResultGemini
        ? runResultGemini
        : runResult
    : null;

  return (
    <div>
      <main className="min-h-[calc(100vh-72px)] bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl space-y-8 px-2 sm:px-4">
          <Card className="border-0 bg-white shadow-lg shadow-slate-200/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-6 w-6 text-primary-600" />
              Resultado del diagnóstico
            </CardTitle>
            <CardDescription>
              <span className="font-medium">{diagnostic.brandName}</span>
              {diagnostic.industry && ` · ${diagnostic.industry}`}
              {!diagnostic.domain.startsWith('brand-') && ` · ${diagnostic.domain}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                    <div className="space-y-8">
                      {mostrarTabsPorModelo && (
                        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="mr-1 text-sm font-medium text-slate-600">Ver datos por modelo:</span>
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => setVistaModelo('chatgpt')}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                                  vistaModelo === 'chatgpt'
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-2'
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
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'gemini' && runResultGemini
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-2'
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
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 ${
                                  vistaModelo === 'consolidado' && runResultGemini
                                    ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-2'
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
                      {runResultToShow && (
                        <ReporteModerno
                          runResult={runResultToShow}
                          brandName={runResultToShow.brandName}
                          trendData={diagnostic.trendData}
                          runResultChatGPT={tieneGemini ? runResult : undefined}
                          runResultGemini={tieneGemini ? runResultGemini : undefined}
                          satelliteBlock={
                            <>
                              {showSatelliteSkeleton && <SatelliteModuleSkeleton />}
                              {satelliteModule && (
                                <SatelliteModuleCard module={satelliteModule} siteUrl={satelliteSiteUrl} />
                              )}
                            </>
                          }
                        />
                      )}
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
                  <div className="space-y-4 pt-6 mt-6 border-t border-slate-200/80">
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
                        <p className="mt-4 rounded-lg bg-white/70 px-2 py-1.5 text-xs text-slate-600 ring-1 ring-indigo-100/60">
                          <span className="font-medium text-slate-500">Enlace</span>
                          {' '}
                          <Link
                            href={scoreSharePath || `/score/${diagnostic.shareSlug}`}
                            className="font-medium text-indigo-600 underline break-all hover:text-indigo-700"
                          >
                            {sharePublicFullUrl || scoreSharePath || `/score/${diagnostic.shareSlug}`}
                          </Link>
                        </p>
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
                        <p className="mt-4 rounded-lg border border-slate-200/80 bg-white/90 px-2 py-1.5 text-xs text-slate-600">
                          <span className="font-medium text-slate-500">Enlace</span>
                          {' '}
                          <Link
                            href={teamInvitePath || `/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
                            className="font-medium text-teal-700 underline break-all hover:text-teal-800"
                          >
                            {teamInviteFullUrl ||
                              teamInvitePath ||
                              `/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
                          </Link>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-6 mt-6 border-t rounded-xl bg-gradient-to-br from-primary-50/60 to-accent-50/40 p-4">
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
                      <Link href="/diagnostico/crear">
                        Otro diagnóstico
                      </Link>
                    </Button>
                  </div>
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
  if (score >= 80) return { border: 'border-l-emerald-400', icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400', text: 'text-emerald-700' };
  if (score >= 50) return { border: 'border-l-amber-400', icon: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400', text: 'text-amber-700' };
  return { border: 'border-l-red-400', icon: 'bg-red-50 text-red-500', bar: 'bg-red-400', text: 'text-red-600' };
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

const MAX_DETAIL_STRING_LEN = 420;

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

function formatDetailPrimitive(key: string | undefined, value: unknown): string | null {
  if (key !== undefined && shouldOmitDetailFieldKey(key)) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.length) return null;
    if (looksLikeRawMarkup(t)) {
      return 'La respuesta parece HTML/XML (no es texto plano tipo robots.txt). Para el contenido completo, usá «Ver análisis técnico completo».';
    }
    if (t.length > MAX_DETAIL_STRING_LEN) {
      return `Texto muy largo (${t.length} caracteres). Ver el contenido completo en Cleexs Tools.`;
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

function SatelliteDetailExtraRows({ detail }: { detail: Record<string, unknown> }) {
  const skip = new Set(['_truncated', '_note', 'error', 'suggestions', 'score']);
  const rows: { label: string; value: string }[] = [];

  for (const [k, v] of Object.entries(detail)) {
    if (skip.has(k)) continue;
    if (shouldOmitDetailFieldKey(k)) continue;
    const prim = formatDetailPrimitive(k, v);
    if (prim !== null) {
      rows.push({ label: humanizeDetailKey(k), value: prim });
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sub: string[] = [];
      for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
        if (shouldOmitDetailFieldKey(sk)) continue;
        const p = formatDetailPrimitive(sk, sv);
        if (p) sub.push(`${humanizeDetailKey(sk)}: ${p}`);
      }
      if (sub.length) rows.push({ label: humanizeDetailKey(k), value: sub.join(' · ') });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <ClipboardList className="h-3.5 w-3.5 text-primary-500" aria-hidden />
        Resumen
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-lg border border-slate-100 bg-white px-3 py-2.5"
          >
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</dt>
            <dd className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SatelliteModuleSkeleton() {
  return (
    <Card className="border border-dashed border-primary-200/80 bg-white shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl text-foreground">
          <Sparkles className="h-5 w-5 shrink-0 animate-pulse text-primary-600" />
          <span className="inline-block h-6 w-56 rounded-md bg-slate-200/90 animate-pulse" />
        </CardTitle>
        <div className="h-4 max-w-md rounded bg-slate-100 animate-pulse" />
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
            <p className="text-sm font-semibold leading-snug text-primary-950 sm:text-base">
              Generando resumen de herramientas del sitio (AEO)
            </p>
            <p className="text-xs leading-relaxed text-primary-900/85 sm:text-sm">
              Esto puede tardar hasta un minuto. Podés esperar en esta pantalla.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SatelliteToolDetailPanel({
  label,
  detail,
}: {
  label: string;
  detail?: Record<string, unknown>;
}) {
  if (!detail || Object.keys(detail).length === 0) {
    return (
      <p className="text-left text-sm leading-relaxed text-muted-foreground">
        No hay detalle guardado para <span className="font-medium text-foreground">{label}</span>. Abrí{' '}
        <span className="font-medium text-foreground">&quot;Ver análisis técnico completo&quot;</span> o generá un
        diagnóstico nuevo para ver el panel detallado.
      </p>
    );
  }

  const truncated = detail._truncated === true;
  const note = typeof detail._note === 'string' ? detail._note : null;
  const suggestions = Array.isArray(detail.suggestions) ? detail.suggestions : null;
  const err = typeof detail.error === 'string' ? detail.error : null;

  return (
    <div className="space-y-5 text-left font-sans">
      {err && (
        <div className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="leading-snug">{err}</p>
        </div>
      )}
      {truncated && note && (
        <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p className="leading-snug">{note}</p>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            Sugerencias
          </p>
          <ul className="space-y-2">
            {suggestions.slice(0, 12).map((s: unknown, i: number) => {
              const item = s as { message?: string; priority?: string; detail?: string; action?: string };
              const message = (item.message || '').trim();
              if (!message) return null;
              const p = (item.priority || 'info').trim().toLowerCase();
              const meta = SUGGESTION_PRIORITY_META[p] || SUGGESTION_PRIORITY_META.info;
              const PriIcon = meta.Icon;
              return (
                <li key={i} className={cn('rounded-lg border px-3 py-3', meta.box)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <PriIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5',
                      meta.box
                    )}>
                      {meta.short}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{message}</p>
                  {item.detail && (
                    <p className="mt-1.5 text-xs leading-relaxed text-current/70">{item.detail}</p>
                  )}
                  {item.action && (
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed">
                      → {item.action}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <SatelliteDetailExtraRows detail={detail} />
    </div>
  );
}

/** Mini SVG ring de progreso para tool cards (icono centrado, un poco más grande) */
function ScoreRing({
  score,
  hasError,
  Icon,
}: {
  score: number;
  hasError?: boolean;
  Icon: LucideIcon;
}) {
  const r = 26;
  const cx = 32;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100);
  const offset = circumference * (1 - pct / 100);

  const colors = satelliteScoreColor(score, hasError);
  const ringColor =
    hasError || score < 50
      ? '#f87171'   // red-400
      : score < 80
        ? '#fbbf24' // amber-400
        : '#34d399'; // emerald-400

  return (
    <div className="relative flex items-center justify-center">
      <svg width={cx * 2} height={cx * 2} className="-rotate-90" aria-hidden>
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={4}
        />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className={cn('absolute flex h-12 w-12 items-center justify-center rounded-full', colors.icon)}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
    </div>
  );
}

function SatelliteModuleCard({
  module,
  siteUrl,
}: {
  module: PublicDiagnosticSatelliteModule;
  siteUrl: string;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const statusLabel =
    module.status === 'completed' ? 'Completado'
    : module.status === 'timeout' ? 'Timeout'
    : module.status === 'skipped' ? 'Omitido'
    : 'No disponible';

  const topActions = module.actions.slice(0, 3);
  const totalTools = Object.keys(module.tools || {}).length;
  const overallStyle = satelliteScoreColor(module.overallScore, false);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* ── Cabecera: fondo blanco, score según resultado ── */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <Sparkles className="h-5 w-5 text-slate-800" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Herramientas adicionales</p>
            <p className="text-xs text-slate-500">Resumen AEO del sitio</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Score general</p>
          <p className={cn('text-3xl font-black leading-none tabular-nums', overallStyle.text)}>
            {module.overallScore.toFixed(0)}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-6">

        {/* ── Stats row ── */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/90 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Score satélite</p>
            <div className="flex items-end gap-2">
              <p className={cn('text-4xl font-black leading-none tabular-nums', overallStyle.text)}>
                {module.overallScore.toFixed(0)}
              </p>
              <BarChart2 className={cn('h-5 w-5 mb-0.5', overallStyle.text)} aria-hidden />
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Tools procesadas</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-black text-slate-700 leading-none">{totalTools}</p>
              <Layers className="h-5 w-5 text-slate-400 mb-0.5" />
            </div>
          </div>
          <div className={cn(
            'rounded-xl p-4 shadow-sm',
            module.status === 'completed' ? 'bg-gradient-to-br from-emerald-50 to-green-50'
            : module.status === 'timeout' ? 'bg-gradient-to-br from-amber-50 to-orange-50'
            : 'bg-gradient-to-br from-slate-50 to-slate-100'
          )}>
            <p className={cn(
              'text-[10px] font-semibold uppercase tracking-widest mb-1',
              module.status === 'completed' ? 'text-emerald-400'
              : module.status === 'timeout' ? 'text-amber-400'
              : 'text-slate-400'
            )}>Estado</p>
            <div className="flex items-end gap-2">
              <p className={cn(
                'text-4xl font-black leading-none',
                module.status === 'completed' ? 'text-emerald-700'
                : module.status === 'timeout' ? 'text-amber-700'
                : 'text-slate-700'
              )}>{statusLabel}</p>
            </div>
          </div>
        </div>

        {/* ── Tool cards grid ── */}
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-0.5">Resumen por herramienta</p>
          <p className="text-xs text-slate-400 mb-4">Tocá &quot;Ver detalle&quot; en cada tarjeta para expandir sugerencias y métricas.</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
            {SATELLITE_TOOL_ROWS.map(({ key, label, Icon: ToolIcon }) => {
              const t = module.tools[key];
              const score = t?.score ?? 0;
              const hasErr = Boolean(t?.error);
              const open = expandedKey === key;
              const colors = satelliteScoreColor(score, hasErr);

              const cardBg =
                hasErr || score < 50
                  ? 'from-red-50/50 to-white'
                  : score < 80
                    ? 'from-amber-50/50 to-white'
                    : 'from-emerald-50/50 to-white';

              return (
                <div
                  key={key}
                  className={cn(
                    'flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-b text-left shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-200',
                    cardBg,
                    open && 'col-span-full ring-2 ring-primary-200 shadow-md'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedKey((k) => (k === key ? null : key))}
                    className="flex w-full flex-col items-center gap-2 px-3 pt-4 pb-3 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-expanded={open}
                  >
                    <ScoreRing score={score} hasError={hasErr} Icon={ToolIcon} />
                    <p className="text-xs font-semibold text-slate-800 leading-tight tracking-tight">{label}</p>
                    <p className={cn('text-2xl font-black leading-none tabular-nums', colors.text)}>
                      {score > 0 ? Math.round(score) : '—'}
                    </p>
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {open ? 'Ocultar detalle' : 'Ver detalle'}
                    </span>
                    <ChevronDown
                      className={cn('h-4 w-4 text-slate-300 transition-transform', open && 'rotate-180')}
                      aria-hidden
                    />
                  </button>

                  {open && (
                    <div className="border-t border-slate-100 bg-white px-4 py-4">
                      <SatelliteToolDetailPanel label={label} detail={t?.detail} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Acciones prioritarias ── */}
        {topActions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">Acciones prioritarias</p>
            {topActions.map((action, idx) => (
              <div
                key={`${action.source}-${idx}`}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-3',
                  idx === 0
                    ? 'border-amber-200 border-l-4 border-l-amber-400 bg-amber-50'
                    : 'border-slate-100 bg-white'
                )}
              >
                <AlertCircle className={cn('mt-0.5 h-4 w-4 shrink-0', idx === 0 ? 'text-amber-500' : 'text-slate-400')} aria-hidden />
                <p className="text-sm text-slate-700 leading-snug">{action.message}</p>
              </div>
            ))}
          </div>
        )}

      </div>
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
