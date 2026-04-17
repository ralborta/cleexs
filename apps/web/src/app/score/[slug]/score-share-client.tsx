'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShareScoreButtons } from '@/components/share/share-score-buttons';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { ReporteModerno } from '@/app/ver-resultado/reporte-moderno';
import {
  publicDiagnosticShareApi,
  type PublicDiagnosticShareResponse,
  type PublicDiagnosticRunResult,
} from '@/lib/api';
import { getOrCreateCleexsVisitorId } from '@/lib/cleexs-visitor-id';
import { LayoutDashboard, Loader2, Lock, LogIn, Sparkles } from 'lucide-react';

function buildRunResultAmbos(a: PublicDiagnosticRunResult, b: PublicDiagnosticRunResult): PublicDiagnosticRunResult {
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

export function ScoreShareClient({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicDiagnosticShareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaModelo, setVistaModelo] = useState<'consolidado' | 'chatgpt' | 'gemini'>('chatgpt');
  const visitSent = useRef(false);

  const load = useCallback(async () => {
    const d = await publicDiagnosticShareApi.get(slug);
    setData(d);
    return d;
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!data || visitSent.current || data.status !== 'completed') return;
    const vid = getOrCreateCleexsVisitorId();
    if (!vid) return;
    visitSent.current = true;
    void (async () => {
      try {
        const res = await publicDiagnosticShareApi.registerVisit(slug, vid);
        if (res.shareFullUnlocked) {
          await load();
        } else {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  unlock: {
                    ...prev.unlock,
                    uniqueVisitCount: res.uniqueVisitCount,
                    visitsNeeded: res.visitsNeeded,
                    viralUnlocked: res.viralUnlocked,
                  },
                }
              : prev
          );
        }
      } catch {
        visitSent.current = false;
      }
    })();
  }, [data, slug, load]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-600" />
          <p className="mt-4 text-muted-foreground">Cargando Cleexs Score…</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-[calc(100vh-72px)] px-6 py-16">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-muted-foreground">{error || 'Enlace no encontrado.'}</p>
          <Button asChild className="mt-4">
            <Link href="/diagnostico/crear">Hacer un diagnóstico</Link>
          </Button>
        </div>
      </main>
    );
  }

  const path = `/score/${encodeURIComponent(data.slug)}`;
  const shareTitle = `Cleexs Score — ${data.brandName}`;
  const shareSummary =
    data.cleexsScore != null
      ? `Score ${Math.round(data.cleexsScore)} · ${data.industry || 'Marca'}`
      : `Diagnóstico Cleexs · ${data.brandName}`;

  const runResult = data.runResult;
  const runGemini = data.runResultGemini;
  const tieneGemini = !!runGemini;
  const runResultToShow: PublicDiagnosticRunResult | null = runResult
    ? vistaModelo === 'consolidado' && runGemini
      ? buildRunResultAmbos(runResult, runGemini)
      : vistaModelo === 'gemini' && runGemini
        ? runGemini
        : runResult
    : null;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-6xl space-y-8 px-2 sm:px-4">
        <Card className="border-0 bg-white shadow-lg shadow-slate-200/60">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Sparkles className="h-7 w-7 text-primary-600" />
                  Cleexs Score
                </CardTitle>
                <CardDescription className="mt-2 text-base">
                  <span className="font-medium text-foreground">{data.brandName}</span>
                  {data.industry ? ` · ${data.industry}` : ''}
                  {!data.domain.startsWith('brand-') ? ` · ${data.domain}` : ''}
                </CardDescription>
              </div>
              <div className="shrink-0 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compartir</p>
                <ShareScoreButtons path={path} title={shareTitle} summary={shareSummary} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {data.status !== 'completed' && (
              <p className="text-sm text-muted-foreground">Este diagnóstico aún no está listo. Volvé más tarde.</p>
            )}

            {data.status === 'completed' && data.cleexsScore != null && (
              <div className="rounded-xl border border-primary-100 bg-gradient-to-r from-primary-50 to-accent-50 p-6">
                <p className="text-xs font-medium text-primary-700 uppercase tracking-wide">Cleexs Score</p>
                <p className="text-5xl font-bold text-foreground tabular-nums">{Math.round(data.cleexsScore)}</p>
                <p className="text-sm text-muted-foreground mt-1">Vista pública · 0–100</p>
              </div>
            )}

            {data.status === 'completed' && data.resumenTeaser && !data.shareFullUnlocked && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 text-slate-800">
                <p className="text-sm font-semibold text-slate-900 mb-2">Resumen</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.resumenTeaser}</p>
              </div>
            )}

            {data.status === 'completed' && !data.shareFullUnlocked && (
              <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-orange-50/60 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lock className="h-5 w-5 text-amber-600" />
                    Desbloqueá el reporte completo
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Compartí este enlace: cuando {data.unlock.viralUnlockMin} personas distintas lo abran desde su
                    dispositivo, el reporte completo se desbloquea para todos en esta página. Con plan Gold el reporte
                    completo está disponible al instante.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-amber-900/90">
                    Visitas únicas: <strong>{data.unlock.uniqueVisitCount}</strong> / {data.unlock.viralUnlockMin}
                    {data.unlock.visitsNeeded > 0 ? (
                      <> · faltan {data.unlock.visitsNeeded}</>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild className="bg-primary-600 hover:bg-primary-700">
                      <Link href="/planes">
                        <LogIn className="mr-2 h-4 w-4" />
                        Ver planes y registrarte
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/ver-resultado?diagnosticId=${encodeURIComponent(data.diagnosticId)}`}>
                        Ya hice el diagnóstico
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.status === 'completed' && data.shareFullUnlocked && runResultToShow && (
              <div className="space-y-6">
                {tieneGemini && (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <span className="mr-1 text-sm font-medium text-slate-600">Ver datos por modelo:</span>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setVistaModelo('chatgpt')}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                          vistaModelo === 'chatgpt'
                            ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-2'
                            : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <CleexsMark className="h-[18px] w-[18px] shrink-0" />
                        ChatGPT
                      </button>
                      <button
                        type="button"
                        onClick={() => setVistaModelo('gemini')}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                          vistaModelo === 'gemini'
                            ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-2'
                            : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <CleexsMark className="h-[18px] w-[18px] shrink-0" />
                        Gemini
                      </button>
                      <button
                        type="button"
                        onClick={() => setVistaModelo('consolidado')}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                          vistaModelo === 'consolidado'
                            ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300 ring-offset-2'
                            : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <LayoutDashboard className="h-4 w-4 shrink-0" />
                        Consolidado
                      </button>
                    </div>
                  </div>
                )}
                <ReporteModerno
                  runResult={runResultToShow}
                  brandName={runResultToShow.brandName}
                  trendData={data.trendData}
                  runResultChatGPT={tieneGemini ? runResult : undefined}
                  runResultGemini={tieneGemini ? runGemini : undefined}
                  satelliteBlock={null}
                />
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Análisis generado con Cleexs ·{' '}
              <Link href="/diagnostico/crear" className="underline hover:text-foreground">
                Hacé tu diagnóstico
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
