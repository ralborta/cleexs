'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
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
import { publicDiagnosticApi, type PublicDiagnostic, type PublicDiagnosticRunResult, type PublicDiagnosticPromptResult } from '@/lib/api';
import { Loader2, LogIn, FileCheck, AlertCircle, Mail } from 'lucide-react';

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
  if (n.includes('calidad')) return 'calidad';
  if (n.includes('precio')) return 'precio';
  return null;
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
      totals.set(key, {
        ...current,
        count: current.count + 1,
        positionSum: current.positionSum + entry.position,
        sampleReason: current.sampleReason || entry.reason,
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

function ReporteCompleto({ runResult, brandName }: { runResult: PublicDiagnosticRunResult; brandName: string }) {
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
              intentionScores.map((item) => (
                <div key={item.key} className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs font-medium text-muted-foreground capitalize">{item.key}</p>
                  <p className="text-2xl font-semibold text-foreground">{item.score.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Peso {item.weight}%</p>
                </div>
              ))
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
                          {row.sampleReason || '—'}
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
  const [diagnostic, setDiagnostic] = useState<PublicDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSendFailed, setEmailSendFailed] = useState(false);

  useEffect(() => {
    const id = searchParams.get('diagnosticId');
    if (!id) {
      setLoading(false);
      setError('Falta el ID del diagnóstico.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await publicDiagnosticApi.get(id);
        if (!cancelled) setDiagnostic(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el diagnóstico.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [diagnosticId, searchParams]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!diagnosticId || !email.trim()) return;
    setEmailLoading(true);
    try {
      const res = await publicDiagnosticApi.setEmail(diagnosticId, email.trim());
      setEmailSent(true);
      if (res.emailSent === false) setEmailSendFailed(true);
    } catch {
      setEmailSendFailed(true);
    } finally {
      setEmailLoading(false);
    }
  }

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
          <Link href="/diagnostico">
            <Button className="mt-4">Hacer un nuevo diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  const isCompleted = diagnostic.status === 'completed';
  const isPending = diagnostic.status === 'pending' || diagnostic.status === 'running';
  const isFailed = diagnostic.status === 'failed';
  const runResult = diagnostic.runResult;

  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-background via-white to-primary-50 px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="border-transparent bg-white shadow-md">
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
                <Link href="/diagnostico">
                  <Button variant="outline" className="mt-3">Nuevo diagnóstico</Button>
                </Link>
              </div>
            )}

            {isCompleted && (
              <>
                {runResult ? (
                  <ReporteCompleto runResult={runResult} brandName={runResult.brandName} />
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                    <p className="font-medium">Diagnóstico listo</p>
                    <p className="text-sm mt-1">Cargando detalle del reporte…</p>
                  </div>
                )}

                {/* Email al final del flujo */}
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-foreground mb-2">¿Querés recibir el resultado por correo?</p>
                  {emailSent ? (
                    emailSendFailed ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                        <p className="text-sm">Guardamos tu email pero no pudimos enviar el correo. Podés compartir este link para ver el resultado.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-green-700">Te enviamos el link por correo. Revisá tu bandeja (y spam).</p>
                    )
                  ) : (
                    <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={emailLoading}
                      />
                      <Button type="submit" disabled={emailLoading || !email.trim()}>
                        {emailLoading ? 'Enviando…' : <><Mail className="mr-2 h-4 w-4" />Enviar</>}
                      </Button>
                    </form>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3">
                    Creá una cuenta o iniciá sesión para guardar resultados y hacer más análisis.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href={runResult?.brandId ? `/dashboard?brandId=${runResult.brandId}` : '/dashboard'}>
                        <LogIn className="mr-2 h-4 w-4" />
                        Ir al dashboard
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/diagnostico">Otro diagnóstico</Link>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
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
