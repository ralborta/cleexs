'use client';

import { useEffect, useState } from 'react';
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
import { reportsApi, runsApi, tenantsApi, Run, RankingEntry } from '@/lib/api';
import { PromptDetail } from '@/components/dashboard/prompt-detail';

interface PromptResult {
  id: string;
  prompt: {
    id: string;
    promptText: string;
    category?: { name: string };
  };
  responseText: string;
  top3Json: Array<{ position: number; name: string; type: string }>;
  score: number;
  flags: Record<string, boolean>;
  truncated: boolean;
  manualOverride: boolean;
}

interface RunWithDetails extends Run {
  brand: Run['brand'] & { competitors?: Array<{ id: string; name: string }> };
  promptResults?: PromptResult[];
}

interface ComparisonRow {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
}

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

const buildComparisonSummary = (results: PromptResult[]): ComparisonRow[] => {
  const totals = new Map<string, { name: string; type: string; count: number; positionSum: number }>();
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
    }))
    .sort((a, b) => b.appearances - a.appearances);
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunWithDetails | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function loadRuns() {
      try {
        const tenant = await tenantsApi.getByCode('000');
        setTenantId(tenant.id);
        const [runsData, rankingData] = await Promise.all([
          runsApi.list(tenant.id),
          reportsApi.getRanking(tenant.id),
        ]);
        setRuns(runsData);
        setRanking(rankingData);
      } catch (error) {
        console.error('Error cargando runs:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRuns();
  }, []);

  const handleViewDetails = async (run: Run) => {
    try {
      const fullRun = await runsApi.get(run.id);
      setSelectedRun(fullRun as RunWithDetails);
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
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-slate-50 via-white to-purple-50 px-6 py-16">
        <div className="mx-auto max-w-6xl text-center text-gray-600">Cargando...</div>
      </div>
    );
  }

  const comparisonSummary = selectedRun?.promptResults
    ? buildComparisonSummary(selectedRun.promptResults)
    : [];
  const suggestedCompetitors = selectedRun
    ? ranking
        .filter((entry) => entry.brandId !== selectedRun.brand.id)
        .filter((entry) => {
          const competitors = selectedRun.brand.competitors || [];
          const normalizedCompetitors = competitors.map((c) => normalizeName(c.name));
          return !normalizedCompetitors.includes(normalizeName(entry.brandName));
        })
        .slice(0, 6)
    : [];

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-slate-50 via-white to-purple-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-purple-700">Centro de control</p>
          <h1 className="text-3xl font-bold text-gray-900">Runs</h1>
          <p className="text-gray-600">
            Gestiona, auditá y visualizá tus corridas de análisis con evidencia completa.
          </p>
        </div>
        <Link href="/runs/add-result">
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
            Agregar Resultado Manual
          </Button>
        </Link>
      </div>

      {notice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {notice.message}
        </div>
      )}

      <Card className="border-transparent bg-white shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl text-gray-900">Lista de Runs</CardTitle>
          <CardDescription>
            Corridas de análisis por marca y período, con estado y PRIA agregado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70">
                <TableHead className="text-gray-600">Marca</TableHead>
                <TableHead className="text-gray-600">Período</TableHead>
                <TableHead className="text-gray-600">Estado</TableHead>
                <TableHead className="text-right text-gray-600">PRIA</TableHead>
                <TableHead className="text-gray-600">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-gray-500">
                    No hay runs disponibles todavía.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id} className="hover:bg-slate-50/80">
                    <TableCell className="font-medium text-gray-900">{run.brand.name}</TableCell>
                    <TableCell>
                      {new Date(run.periodStart).toLocaleDateString('es-AR')} -{' '}
                      {new Date(run.periodEnd).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          run.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : run.status === 'failed'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {run.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {run.priaReports && run.priaReports[0] ? (
                        <span className="font-semibold text-gray-900">
                          {run.priaReports[0].priaTotal.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-200 text-gray-700 hover:bg-gray-50"
                          onClick={() => handleViewDetails(run)}
                        >
                          Ver Detalles
                        </Button>
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
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
        <div className="space-y-4">
          <Card className="border-transparent bg-white shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-gray-900">Detalles del Run</CardTitle>
              <CardDescription>
                {selectedRun.brand.name} -{' '}
                {new Date(selectedRun.periodStart).toLocaleDateString('es-AR')} a{' '}
                {new Date(selectedRun.periodEnd).toLocaleDateString('es-AR')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-transparent bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-gray-900">Comparaciones y sugerencias</CardTitle>
              <CardDescription>
                Se solicita un Top 3 por prompt con la marca a medir y la lista de competidores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">Marca medida:</span> {selectedRun.brand.name}
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">Competidores usados:</span>{' '}
                {selectedRun.brand.competitors && selectedRun.brand.competitors.length > 0
                  ? selectedRun.brand.competitors.map((c) => c.name).join(', ')
                  : 'No hay competidores cargados.'}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Resumen de apariciones en Top 3</p>
                {selectedRun.promptResults && selectedRun.promptResults.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/70">
                        <TableHead className="text-gray-600">Marca</TableHead>
                        <TableHead className="text-gray-600">Tipo</TableHead>
                        <TableHead className="text-right text-gray-600">Apariciones</TableHead>
                        <TableHead className="text-right text-gray-600">Posición media</TableHead>
                        <TableHead className="text-right text-gray-600">% del Top 3</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonSummary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                            No hay Top 3 parseado para esta corrida.
                          </TableCell>
                        </TableRow>
                      ) : (
                        comparisonSummary.map((row) => (
                          <TableRow key={`${row.name}-${row.type}`}>
                            <TableCell className="font-medium text-gray-900">{row.name}</TableCell>
                            <TableCell className="text-gray-600">{row.type}</TableCell>
                            <TableCell className="text-right text-gray-700">{row.appearances}</TableCell>
                            <TableCell className="text-right text-gray-700">
                              {row.averagePosition.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-gray-700">{row.share.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500">Todavía no hay resultados de prompts para comparar.</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Sugerencias de competidores</p>
                {ranking.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay ranking disponible para sugerir comparaciones.</p>
                ) : suggestedCompetitors.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay marcas nuevas para sugerir.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {suggestedCompetitors.map((entry) => (
                      <span
                        key={entry.brandId}
                        className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800"
                      >
                        {entry.brandName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedRun.promptResults && <PromptDetail results={selectedRun.promptResults} />}
        </div>
      )}
      </div>
    </div>
  );
}
