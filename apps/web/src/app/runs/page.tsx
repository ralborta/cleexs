'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
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
import { brandsApi, reportsApi, runsApi, tenantsApi, Run, RankingEntry, Brand } from '@/lib/api';
import { PromptDetail } from '@/components/dashboard/prompt-detail';

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

interface RunWithDetails extends Run {
  brand: Run['brand'] & {
    competitors?: Array<{ id: string; name: string }>;
    aliases?: Array<{ id: string; alias: string }>;
    industry?: string;
    productType?: string;
  };
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

const includesNormalized = (text: string, needle: string) =>
  normalizeName(text).includes(normalizeName(needle));

const isBrandMentioned = (text: string, brandName: string, aliases: string[]) => {
  if (!text) return false;
  if (includesNormalized(text, brandName)) return true;
  return aliases.some((alias) => includesNormalized(text, alias));
};

const isBrandEntry = (entryName: string, brandName: string, aliases: string[]) => {
  const normalizedEntry = normalizeName(entryName);
  if (normalizedEntry === normalizeName(brandName)) return true;
  return aliases.some((alias) => normalizeName(alias) === normalizedEntry);
};

const extractIntention = (promptText: string) => {
  const match = promptText.match(/Intención:\s*([^\(\n]+)\s*\((\d+)%\)/i);
  if (!match) return null;
  return {
    name: match[1].trim().toLowerCase(),
    weight: Number(match[2]),
  };
};

const normalizeIntentionKey = (value: string) => {
  const normalized = normalizeName(value);
  if (normalized.includes('urgencia')) return 'urgencia';
  if (normalized.includes('calidad')) return 'calidad';
  if (normalized.includes('precio')) return 'precio';
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

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunWithDetails | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/runs') return;
    let cancelled = false;
    async function loadRuns() {
      try {
        const tenant = await tenantsApi.getByCode('000');
        if (cancelled) return;
        setTenantId(tenant.id);
        const [runsData, rankingData, brandsData] = await Promise.all([
          runsApi.list(tenant.id),
          reportsApi.getRanking(tenant.id),
          brandsApi.list(tenant.id),
        ]);
        if (cancelled) return;
        setRuns(runsData);
        setRanking(rankingData);
        setBrands(brandsData);
      } catch (error) {
        if (!cancelled) console.error('Error cargando runs:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRuns();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleViewDetails = async (run: Run) => {
    const requestedId = run.id;
    setSelectedRun(null);
    try {
      const fullRun = await runsApi.get(requestedId);
      if ((fullRun as RunWithDetails).id === requestedId) {
        setSelectedRun(fullRun as RunWithDetails);
      }
    } catch (error) {
      console.error('Error cargando detalles:', error);
    }
  };

  const handleExecuteRun = async (runId: string) => {
    if (!tenantId) return;
    setExecutingRunId(runId);
    setNotice(null);
    try {
      await runsApi.execute(runId, { model: 'gpt-4o-mini' });
      const data = await runsApi.list(tenantId);
      setRuns(data);
      if (selectedRun && selectedRun.id === runId) {
        const refreshed = await runsApi.get(runId);
        setSelectedRun(refreshed as any);
      }
      setNotice({ type: 'success', message: 'Run ejecutado y PRIA actualizado.' });
    } catch (error: any) {
      setNotice({ type: 'error', message: error?.message || 'No se pudo ejecutar el run.' });
    } finally {
      setExecutingRunId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-16">
        <div className="mx-auto max-w-6xl text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  const comparisonSummary = selectedRun?.promptResults
    ? buildComparisonSummary(selectedRun.promptResults)
    : [];
  const suggestedCompetitors = selectedRun
    ? Array.from(
        ranking
          .filter((entry) => entry.brandId !== selectedRun.brand.id)
          .filter((entry) => {
            const competitors = selectedRun.brand.competitors || [];
            const normalizedCompetitors = competitors.map((c) => normalizeName(c.name));
            const entryBrand = brands.find((brand) => brand.id === entry.brandId);
            const selectedIndustry = selectedRun.brand.industry?.trim();
            const selectedProductType = selectedRun.brand.productType?.trim();
            const entryIndustry = entryBrand?.industry?.trim();
            const entryProductType = entryBrand?.productType?.trim();
            const industryMatch =
              selectedIndustry &&
              entryIndustry &&
              normalizeName(entryIndustry) === normalizeName(selectedIndustry);
            const productMatch =
              selectedProductType &&
              entryProductType &&
              normalizeName(entryProductType) === normalizeName(selectedProductType);
            const hasMatch = Boolean(industryMatch || productMatch);
            return (
              Boolean(entry.brandName && entry.brandName.trim()) &&
              !normalizedCompetitors.includes(normalizeName(entry.brandName)) &&
              hasMatch
            );
          })
          .reduce((map, entry) => {
            if (!map.has(entry.brandId)) {
              map.set(entry.brandId, entry);
            }
            return map;
          }, new Map<string, RankingEntry>())
          .values()
      ).slice(0, 6)
    : [];
  const promptResults = selectedRun?.promptResults || [];
  const brandAliases = selectedRun?.brand.aliases?.map((alias) => alias.alias) || [];
  const totalPrompts = promptResults.length;
  const hasIndustryContext = Boolean(
    selectedRun?.brand.industry?.trim() || selectedRun?.brand.productType?.trim()
  );
  const parseableCount = promptResults.filter((result) => result.top3Json && result.top3Json.length > 0).length;
  const mentionCount = selectedRun
    ? promptResults.filter((result) =>
        isBrandMentioned(result.responseText, selectedRun.brand.name, brandAliases)
      ).length
    : 0;
  const top3Count = selectedRun
    ? promptResults.filter((result) =>
        result.top3Json?.some((entry) => isBrandEntry(entry.name, selectedRun.brand.name, brandAliases))
      ).length
    : 0;
  const top1Count = selectedRun
    ? promptResults.filter((result) =>
        result.top3Json?.some(
          (entry) => entry.position === 1 && isBrandEntry(entry.name, selectedRun.brand.name, brandAliases)
        )
      ).length
    : 0;
  const formatConfidence = totalPrompts ? Math.round((parseableCount / totalPrompts) * 100) : 0;
  const mentionRate = totalPrompts ? Math.round((mentionCount / totalPrompts) * 100) : 0;
  const top3Rate = totalPrompts ? Math.round((top3Count / totalPrompts) * 100) : 0;
  const top1Rate = totalPrompts ? Math.round((top1Count / totalPrompts) * 100) : 0;

  const competitorsFromResults = Array.from(
    new Set(
      promptResults
        .flatMap((result) => result.top3Json || [])
        .filter((entry) => entry.type === 'competitor')
        .map((entry) => entry.name)
    )
  );
  const competitorsFromBrand =
    selectedRun?.brand.competitors && selectedRun.brand.competitors.length > 0
      ? selectedRun.brand.competitors.map((c) => c.name)
      : [];
  const competitorsUsed = competitorsFromResults.length > 0 ? competitorsFromResults : competitorsFromBrand;

  const intentionBuckets: Record<string, { scores: number[]; weight: number }> = {};
  promptResults.forEach((result) => {
    const promptText = result.prompt?.promptText || '';
    const extracted = extractIntention(promptText);
    if (!extracted) return;
    const key = normalizeIntentionKey(extracted.name);
    if (!key) return;
    if (!intentionBuckets[key]) {
      intentionBuckets[key] = { scores: [], weight: extracted.weight };
    }
    intentionBuckets[key].scores.push((result.score || 0) * 100);
  });

  const intentionScores = Object.entries(intentionBuckets).map(([key, data]) => ({
    key,
    score: data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    weight: data.weight,
  }));

  const weightSum = intentionScores.reduce((sum, item) => sum + item.weight, 0) || 1;
  const cleexsScoreByIntention = intentionScores.reduce(
    (sum, item) => sum + item.score * (item.weight / weightSum),
    0
  );
  const fallbackScore =
    promptResults.length > 0
      ? promptResults.reduce((sum, r) => sum + (r.score || 0) * 100, 0) / promptResults.length
      : 0;
  const cleexsScore =
    intentionScores.length > 0 ? cleexsScoreByIntention : fallbackScore;
  const totalRuns = runs.length;
  const lastRun = runs[0];
  const lastRunScore = lastRun?.priaReports?.[0]?.priaTotal ?? 0;
  const lastRunDate = lastRun ? new Date(lastRun.periodEnd).toLocaleDateString('es-AR') : '-';
  const runningCount = runs.filter((run) => run.status === 'running').length;
  const failedCount = runs.filter((run) => run.status === 'failed').length;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-700">Centro de control</p>
          <h1 className="text-3xl font-bold text-foreground">Runs</h1>
          <p className="text-muted-foreground">
            Gestiona, auditá y visualizá tus corridas de análisis con evidencia completa.
          </p>
        </div>
        <Link href="/runs/add-result">
          <Button className="bg-primary-600 text-white hover:bg-primary-700">
            Agregar Resultado Manual
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card className="border-transparent bg-white shadow-md">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Runs Totales</p>
            <p className="text-2xl font-semibold text-foreground">{totalRuns}</p>
          </CardContent>
        </Card>
        <Card className="border-transparent bg-white shadow-md">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Último Run</p>
            <p className="text-2xl font-semibold text-foreground">
              {lastRunScore.toFixed(0)} / 100
            </p>
            <p className="text-xs text-muted-foreground">{lastRunDate}</p>
          </CardContent>
        </Card>
        <Card className="border-transparent bg-white shadow-md">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">En curso / Fallidos</p>
            <p className="text-2xl font-semibold text-foreground">
              {runningCount} <span className="text-muted-foreground">en curso</span>
            </p>
            <p className="text-xs text-muted-foreground">{failedCount} fallidos</p>
          </CardContent>
        </Card>
        <Card className="border-transparent bg-white shadow-md">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Más reciente</p>
            <p className="text-sm font-medium text-foreground">Últimos 90 días</p>
            <p className="text-xs text-muted-foreground">Filtro rápido</p>
          </CardContent>
        </Card>
      </div>

      {notice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-primary-100 bg-primary-50 text-primary-900'
              : 'border-destructive/20 bg-destructive/10 text-destructive'
          }`}
        >
          {notice.message}
        </div>
      )}

      <Card className="border-transparent bg-white shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl text-foreground">Lista de Runs</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Corridas de análisis por marca y período, con estado y PRIA agregado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 pb-4">
            <select className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground">
              <option>Marca</option>
            </select>
            <select className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground">
              <option>Estado</option>
            </select>
            <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-primary-50">
              + Filtrar 90 días
            </Button>
            <input
              className="w-full max-w-xs rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-600"
              placeholder="Buscar Runs..."
            />
            <select className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground">
              <option>Más reciente</option>
            </select>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-primary-50/80 border-b border-border">
                <TableHead className="text-muted-foreground font-semibold">Marca</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Período</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Estado</TableHead>
                <TableHead className="text-right text-muted-foreground font-semibold">PRIA</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No hay runs disponibles todavía.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id} className="hover:bg-primary-50/60">
                    <TableCell className="font-medium text-foreground">{run.brand.name}</TableCell>
                    <TableCell>
                      {new Date(run.periodStart).toLocaleDateString('es-AR')} -{' '}
                      {new Date(run.periodEnd).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          run.status === 'completed'
                            ? 'bg-primary-50 text-primary-700 border border-primary-100'
                            : run.status === 'failed'
                              ? 'bg-destructive/10 text-destructive border border-destructive/20'
                              : 'bg-accent-50 text-accent-700 border border-accent-100'
                        }`}
                      >
                        {run.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {run.priaReports && run.priaReports[0] ? (
                        <span className="font-semibold text-foreground">
                          {run.priaReports[0].priaTotal.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-foreground hover:bg-primary-50"
                          onClick={() => handleViewDetails(run)}
                        >
                          Ver Detalles
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary-600 text-white hover:bg-primary-700"
                          onClick={() => handleExecuteRun(run.id)}
                          disabled={executingRunId === run.id}
                        >
                          {executingRunId === run.id ? 'Ejecutando…' : 'Ejecutar Run'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRun && (
        <div key={selectedRun.id} className="space-y-4">
          <Card className="border-transparent bg-white shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-foreground">Detalles del Run</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {selectedRun.brand.name} — {new Date(selectedRun.periodStart).toLocaleDateString('es-AR')} a{' '}
                {new Date(selectedRun.periodEnd).toLocaleDateString('es-AR')}
                <span className="ml-2 text-muted-foreground/80">(run {selectedRun.id.slice(0, 8)}…)</span>
              </CardDescription>
            </CardHeader>
          </Card>

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
                <span className="font-medium text-foreground">Marca medida:</span> {selectedRun.brand.name}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Competidores usados:</span>{' '}
                {competitorsUsed.length > 0 ? competitorsUsed.join(', ') : 'No hay competidores cargados.'}
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Resumen de apariciones en Top 3</p>
                {selectedRun.promptResults && selectedRun.promptResults.length > 0 ? (
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
                            <TableCell className="text-right text-muted-foreground">
                              {row.averagePosition.toFixed(2)}
                            </TableCell>
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

          {selectedRun.promptResults && (
            <PromptDetail key={`prompt-detail-${selectedRun.id}`} results={selectedRun.promptResults} />
          )}
        </div>
      )}
      </div>
    </div>
  );
}
