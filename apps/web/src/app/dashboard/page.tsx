'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandRankingCard } from '@/components/dashboard/brand-ranking-card';
import { CleexsTrendCard } from '@/components/dashboard/cleexs-trend-card';
import { CompetitorComparisonCard } from '@/components/dashboard/competitor-comparison-card';
import { BrandPerceptionCard } from '@/components/dashboard/brand-perception-card';
import {
  reportsApi,
  type BrandDashboard,
  type PlatformDashboard,
} from '@/lib/api';
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
import { AlertCircle } from 'lucide-react';

function statusBadge(status: 'pending' | 'running' | 'completed' | 'failed') {
  if (status === 'completed') {
    return 'bg-primary-50 text-primary-700 border border-primary-100';
  }
  if (status === 'failed') {
    return 'bg-destructive/10 text-destructive border border-destructive/20';
  }
  return 'bg-accent-50 text-accent-700 border border-accent-100';
}

function PlatformDashboardView({ data }: { data: PlatformDashboard }) {
  const withRuns = data.dailyRuns.filter((row) => row.runs > 0);
  const peakDay = withRuns.reduce((acc, row) => (row.runs > acc.runs ? row : acc), {
    date: '-',
    runs: 0,
    avgScore: 0,
  });
  const avgRunsPerActiveDay =
    withRuns.length > 0
      ? withRuns.reduce((sum, row) => sum + row.runs, 0) / withRuns.length
      : 0;

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary-700">Dashboard interno</p>
          <h1 className="text-3xl font-bold text-foreground">Estadísticas globales de corridas</h1>
          <p className="text-muted-foreground">
            Seguimiento operativo del piloto: volumen, tendencias por día, industrias y últimas ejecuciones.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Corridas totales</p>
              <p className="text-2xl font-semibold text-foreground">{data.summary.totalRuns}</p>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Corridas hoy</p>
              <p className="text-2xl font-semibold text-foreground">{data.summary.runsToday}</p>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tasa de éxito</p>
              <p className="text-2xl font-semibold text-foreground">{data.summary.successRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-white shadow-md">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Cleexs Score promedio</p>
              <p className="text-2xl font-semibold text-foreground">
                {data.summary.averageCleexsScore.toFixed(1)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-transparent bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-foreground">Tendencia diaria (30 días)</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Día pico: {peakDay.date === '-' ? 'sin datos' : `${peakDay.date} (${peakDay.runs} corridas)`} · Promedio por día activo: {avgRunsPerActiveDay.toFixed(1)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary-50/80 border-b border-border">
                    <TableHead className="text-muted-foreground font-semibold">Fecha</TableHead>
                    <TableHead className="text-right text-muted-foreground font-semibold">Corridas</TableHead>
                    <TableHead className="text-right text-muted-foreground font-semibold">Score promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dailyRuns.slice(-10).reverse().map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="font-medium text-foreground">{row.date}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.runs}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.runs > 0 ? row.avgScore.toFixed(1) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-transparent bg-white shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-foreground">Top industrias</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Industrias con mayor cantidad de corridas recientes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary-50/80 border-b border-border">
                    <TableHead className="text-muted-foreground font-semibold">Industria</TableHead>
                    <TableHead className="text-right text-muted-foreground font-semibold">Corridas</TableHead>
                    <TableHead className="text-right text-muted-foreground font-semibold">Score promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.industries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        Aún no hay corridas para mostrar industrias.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.industries.map((row) => (
                      <TableRow key={row.industry}>
                        <TableCell className="font-medium text-foreground">{row.industry}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.runs}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.avgScore.toFixed(1)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="border-transparent bg-white shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl text-foreground">Últimas corridas</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Seguimiento rápido del estado y score de las ejecuciones recientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-primary-50/80 border-b border-border">
                  <TableHead className="text-muted-foreground font-semibold">Marca</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Industria</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Estado</TableHead>
                  <TableHead className="text-right text-muted-foreground font-semibold">Score</TableHead>
                  <TableHead className="text-right text-muted-foreground font-semibold">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.latestRuns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No hay corridas todavía.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.latestRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium text-foreground">{run.brandName}</TableCell>
                      <TableCell className="text-muted-foreground">{run.industry || 'Sin industria'}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge(run.status)}`}>
                          {run.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {run.score == null ? '—' : run.score.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {new Date(run.createdAt).toLocaleDateString('es-AR')}
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

function DashboardContent() {
  const searchParams = useSearchParams();
  const brandIdParam = searchParams.get('brandId');

  const [brandData, setBrandData] = useState<BrandDashboard | null>(null);
  const [platformData, setPlatformData] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (brandIdParam) {
          const dashboardData = await reportsApi.getBrandDashboard(brandIdParam);
          if (!cancelled) {
            setBrandData(dashboardData);
            setPlatformData(null);
          }
        } else {
          const dashboardData = await reportsApi.getPlatformDashboard();
          if (!cancelled) {
            setPlatformData(dashboardData);
            setBrandData(null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar el dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandIdParam]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || (!brandIdParam && !platformData) || (brandIdParam && !brandData)) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">{error || 'No se pudo cargar el dashboard.'}</p>
          <Link href="/diagnostico/crear">
            <Button variant="outline">Hacer diagnóstico</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!brandIdParam && platformData) {
    return <PlatformDashboardView data={platformData} />;
  }

  const data = brandData as BrandDashboard;

  // Convertir comparison a RankingEntry para BrandRankingCard (marca + competidores con "score" = share)
  const sortedComparison = [...data.comparison].sort((a, b) => b.share - a.share);
  const rankingFromComparison = sortedComparison.map((row, idx) => ({
    brandId: row.type === 'brand' ? data.brand.id : `comp-${idx}`,
    brandName: row.name,
    pria: row.share, // usamos % del Top 3 como proxy de presencia
    runId: data.latestRun?.id ?? '',
    periodStart: data.latestRun?.periodStart ?? new Date().toISOString(),
    periodEnd: data.latestRun?.periodEnd ?? new Date().toISOString(),
    domain: row.type === 'brand' ? data.brand.domain : undefined,
  }));

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary-700">Dashboard de marca</p>
          <h1 className="text-3xl font-bold text-foreground">{data.brand.name}</h1>
          <p className="text-muted-foreground">
            Cleexs Score: {data.cleexsScore.toFixed(0)}
            {data.brand.industry && ` · ${data.brand.industry}`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <BrandRankingCard
              data={rankingFromComparison}
              title={`${data.brand.name} vs competidores`}
              showCompetitors
            />
          </div>
          <div className="lg:col-span-1">
            <CleexsTrendCard data={data.trend} />
          </div>
          <div className="lg:col-span-1">
            <CompetitorComparisonCard data={data.comparison} brandDomain={data.brand.domain} />
          </div>
          <div className="lg:col-span-1">
            <BrandPerceptionCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-72px)] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
