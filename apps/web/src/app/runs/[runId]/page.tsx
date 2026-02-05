'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { brandsApi, reportsApi, runsApi, tenantsApi } from '@/lib/api';
import { PromptDetail } from '@/components/dashboard/prompt-detail';
import type { RankingEntry, Brand } from '@/lib/api';

interface PromptResult {
  id: string;
  prompt: {
    id: string;
    promptText: string;
    category?: { name: string };
  };
  responseText: string;
  top3Json: Array<{ position: number; name: string; type: string; reason?: string }>;
  score: number;
  flags: Record<string, boolean>;
  truncated: boolean;
  manualOverride: boolean;
}

interface RunWithDetails {
  id: string;
  brand: {
    id: string;
    name: string;
    industry?: string;
    productType?: string;
    competitors?: Array<{ id: string; name: string }>;
    aliases?: Array<{ id: string; alias: string }>;
  };
  periodStart: string;
  periodEnd: string;
  promptResults?: PromptResult[];
}

interface ComparisonRow {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
  sampleReason?: string;
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
  if (n.includes('calidad')) return 'calidad';
  if (n.includes('precio')) return 'precio';
  return null;
};

const buildComparisonSummary = (results: PromptResult[]): ComparisonRow[] => {
  const totals = new Map<
    string,
    { name: string; type: string; count: number; positionSum: number; sampleReason?: string }
  >();
  let totalEntries = 0;
  results.forEach((result) => {
    result.top3Json.forEach((entry) => {
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

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<RunWithDetails | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [reExecuting, setReExecuting] = useState(false);
  const [debugRun, setDebugRun] = useState<{
    promptVersionUsed: { id: string; name: string | null } | null;
    distinctPromptIdsInResults: string[];
    resultsCount: number;
    allPromptsInVersionCount: number;
    allPromptsInVersion: { id: string; promptTextPreview: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    setRun(null);
    setDebugRun(null);
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const tenant = await tenantsApi.getByCode('000');
        if (cancelled) return;
        const [runData, rankingData, brandsData] = await Promise.all([
          runsApi.get(runId),
          reportsApi.getRanking(tenant.id),
          brandsApi.list(tenant.id),
        ]);
        if (cancelled) return;
        setRun(runData as RunWithDetails);
        setRanking(rankingData);
        setBrands(brandsData);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (!runId || !run) return;
    let cancelled = false;
    runsApi
      .getDebug(runId)
      .then((d) => {
        if (!cancelled)
          setDebugRun({
            promptVersionUsed: d.promptVersionUsed ?? null,
            distinctPromptIdsInResults: d.distinctPromptIdsInResults,
            resultsCount: d.resultsCount,
            allPromptsInVersionCount: d.allPromptsInVersionCount,
            allPromptsInVersion: d.allPromptsInVersion,
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [runId, run]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-16">
        <div className="mx-auto max-w-6xl text-center text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-16">
        <div className="mx-auto max-w-6xl space-y-4 text-center">
          <p className="text-muted-foreground">{error || 'Run no encontrado.'}</p>
          <Link href="/runs">
            <Button variant="outline" className="border-border text-foreground hover:bg-primary-50">
              ← Volver a Corridas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const promptResults = run.promptResults || [];
  const brandAliases = run.brand.aliases?.map((a) => a.alias) || [];
  const totalPrompts = promptResults.length;
  const parseableCount = promptResults.filter((r) => r.top3Json && r.top3Json.length > 0).length;
  const mentionCount = promptResults.filter((r) =>
    isBrandMentioned(r.responseText, run.brand.name, brandAliases)
  ).length;
  const top3Count = promptResults.filter((r) =>
    r.top3Json?.some((e) => isBrandEntry(e.name, run.brand.name, brandAliases))
  ).length;
  const top1Count = promptResults.filter((r) =>
    r.top3Json?.some(
      (e) => e.position === 1 && isBrandEntry(e.name, run.brand.name, brandAliases)
    )
  ).length;
  const formatConfidence = totalPrompts ? Math.round((parseableCount / totalPrompts) * 100) : 0;
  const mentionRate = totalPrompts ? Math.round((mentionCount / totalPrompts) * 100) : 0;
  const top3Rate = totalPrompts ? Math.round((top3Count / totalPrompts) * 100) : 0;
  const top1Rate = totalPrompts ? Math.round((top1Count / totalPrompts) * 100) : 0;

  const intentionBuckets: Record<string, { scores: number[]; weight: number }> = {};
  promptResults.forEach((result) => {
    const extracted = extractIntention(result.prompt?.promptText || '');
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
    promptResults.length > 0
      ? promptResults.reduce((s, r) => s + (r.score || 0) * 100, 0) / promptResults.length
      : 0;
  const cleexsScore = intentionScores.length > 0 ? cleexsScoreByIntention : fallbackScore;

  const comparisonSummary = buildComparisonSummary(promptResults);
  const competitorsFromResults = Array.from(
    new Set(
      promptResults
        .flatMap((r) => r.top3Json || [])
        .filter((e) => e.type === 'competitor')
        .map((e) => e.name)
    )
  );
  const competitorsFromBrand =
    run.brand.competitors?.length ? run.brand.competitors.map((c) => c.name) : [];
  const competitorsUsed = competitorsFromResults.length > 0 ? competitorsFromResults : competitorsFromBrand;
  const hasIndustryContext = Boolean(run.brand.industry?.trim() || run.brand.productType?.trim());
  const suggestedCompetitors = Array.from(
    ranking
      .filter((e) => e.brandId !== run.brand.id)
      .filter((e) => {
        const comps = run.brand.competitors || [];
        const nComps = comps.map((c) => normalizeName(c.name));
        const brand = brands.find((b) => b.id === e.brandId);
        const indMatch =
          run.brand.industry &&
          brand?.industry &&
          normalizeName(brand.industry) === normalizeName(run.brand.industry!);
        const prodMatch =
          run.brand.productType &&
          brand?.productType &&
          normalizeName(brand.productType) === normalizeName(run.brand.productType!);
        return (
          Boolean(e.brandName?.trim()) &&
          !nComps.includes(normalizeName(e.brandName!)) &&
          Boolean(indMatch || prodMatch)
        );
      })
      .reduce((map, e) => {
        if (!map.has(e.brandId)) map.set(e.brandId, e);
        return map;
      }, new Map<string, RankingEntry>())
      .values()
  ).slice(0, 6);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/runs">
            <Button variant="outline" className="border-border text-foreground hover:bg-primary-50">
              ← Volver a Corridas
            </Button>
          </Link>
          <Button
            variant="outline"
            className="border-primary-600 text-primary-700 hover:bg-primary-50"
            disabled={reExecuting}
            onClick={async () => {
              if (!confirm('¿Volver a ejecutar esta corrida? Se borrarán los resultados actuales y se generarán de nuevo (un resultado por cada prompt de la versión).')) return;
              setReExecuting(true);
              try {
                await runsApi.execute(runId, { force: true });
                window.location.reload();
              } catch (e: any) {
                alert(e?.message ?? 'Error al ejecutar');
              } finally {
                setReExecuting(false);
              }
            }}
          >
            {reExecuting ? 'Ejecutando…' : 'Volver a ejecutar esta corrida'}
          </Button>
        </div>

        <Card className="border-transparent bg-white shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Detalles del Run</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {run.brand.name} — {new Date(run.periodStart).toLocaleDateString('es-AR')} a{' '}
              {new Date(run.periodEnd).toLocaleDateString('es-AR')}
              <span className="ml-2 text-muted-foreground/80">(run {run.id.slice(0, 8)}…)</span>
            </CardDescription>
          </CardHeader>
        </Card>

        {debugRun && (
          <Card className="border-amber-200 bg-amber-50/50 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-foreground">Diagnóstico de prompts</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Esta corrida usó la versión de prompts: <strong>{debugRun.promptVersionUsed?.name ?? '—'}</strong> (todos esos prompts están guardados en la DB).
                El run tiene {debugRun.resultsCount} resultado(s) y usa {debugRun.distinctPromptIdsInResults.length} prompt(s) distinto(s).
                La versión tiene {debugRun.allPromptsInVersionCount} prompt(s) en total.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {debugRun.distinctPromptIdsInResults.length === 1 && debugRun.allPromptsInVersionCount > 1 && (
                <div className="space-y-3 rounded-md border border-amber-300 bg-amber-100 p-3 text-sm text-amber-900">
                  <p>
                    <strong>Problema detectado:</strong> todos los resultados están guardados con el mismo prompt (id {debugRun.distinctPromptIdsInResults[0].slice(0, 8)}…).
                    En la versión hay {debugRun.allPromptsInVersionCount} prompts; deberían usarse distintos.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-600 text-amber-800 hover:bg-amber-200"
                    disabled={reExecuting}
                    onClick={async () => {
                      setReExecuting(true);
                      try {
                        await runsApi.execute(runId, { force: true });
                        window.location.reload();
                      } catch (e: any) {
                        alert(e?.message ?? 'Error al re-ejecutar');
                      } finally {
                        setReExecuting(false);
                      }
                    }}
                  >
                    {reExecuting ? 'Ejecutando…' : 'Re-ejecutar con forzar recálculo'}
                  </Button>
                </div>
              )}
              {debugRun.allPromptsInVersion.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Prompts en la versión (los que deberían usarse):</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                    {debugRun.allPromptsInVersion.map((p) => (
                      <li key={p.id}>
                        <span className="font-mono">{p.id.slice(0, 8)}</span> — {p.promptTextPreview}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-foreground">Cleexs Score</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Score ponderado por intención en base al desempeño por prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-primary-100 bg-gradient-to-r from-primary-50 to-accent-50 p-4">
              <p className="text-xs font-medium text-primary-700">Cleexs Score</p>
              <p className="text-4xl font-bold text-foreground">{cleexsScore.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">
                {intentionScores.length > 0 ? 'Ponderado por intención' : 'Promedio de la corrida'}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {intentionScores.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin intenciones en los prompts; se muestra el promedio de scores de esta corrida.
                </p>
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

        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-foreground">Comparaciones y sugerencias</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Se solicita un Top 3 por prompt con la marca a medir y la lista de competidores.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Marca medida:</span> {run.brand.name}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Competidores usados:</span>{' '}
              {competitorsUsed.length > 0 ? competitorsUsed.join(', ') : 'No hay competidores cargados.'}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Resumen de apariciones en Top 3</p>
              {promptResults.length > 0 ? (
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
                          <TableCell className="text-muted-foreground">{row.type}</TableCell>
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
                <p className="text-sm text-muted-foreground">Todavía no hay resultados de prompts para comparar.</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Sugerencias de competidores</p>
              {!hasIndustryContext ? (
                <p className="text-sm text-muted-foreground">
                  Definí industria o tipo de producto en la marca para sugerencias relevantes.
                </p>
              ) : ranking.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay ranking disponible para sugerir comparaciones.</p>
              ) : suggestedCompetitors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay marcas nuevas para sugerir.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suggestedCompetitors.map((entry) => (
                    <span
                      key={entry.brandId}
                      className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
                    >
                      {entry.brandName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {run.promptResults && run.promptResults.length > 0 && (
          <PromptDetail results={run.promptResults} runId={run.id} />
        )}
      </div>
    </div>
  );
}
