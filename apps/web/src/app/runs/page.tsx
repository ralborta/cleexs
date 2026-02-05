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

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
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

  const handleExecuteRun = async (runId: string) => {
    if (!tenantId) return;
    setExecutingRunId(runId);
    setNotice(null);
    try {
      await runsApi.execute(runId, { model: 'gpt-4o-mini' });
      const data = await runsApi.list(tenantId);
      setRuns(data);
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
                        <Link href={`/runs/${run.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-foreground hover:bg-primary-50"
                        >
                          Ver Detalles
                        </Button>
                      </Link>
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

      </div>
    </div>
  );
}
