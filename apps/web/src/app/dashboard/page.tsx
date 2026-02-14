'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandRankingCard } from '@/components/dashboard/brand-ranking-card';
import { CleexsTrendCard } from '@/components/dashboard/cleexs-trend-card';
import { CompetitorComparisonCard } from '@/components/dashboard/competitor-comparison-card';
import { BrandPerceptionCard } from '@/components/dashboard/brand-perception-card';
import { reportsApi, type BrandDashboard, type BrandDashboardComparisonRow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Search, AlertCircle } from 'lucide-react';

function DashboardContent() {
  const searchParams = useSearchParams();
  const brandIdParam = searchParams.get('brandId');

  const [data, setData] = useState<BrandDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandIdParam) {
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const dashboardData = await reportsApi.getBrandDashboard(brandIdParam);
        if (!cancelled) setData(dashboardData);
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

  // Sin brandId: invitar a hacer diagnóstico
  if (!brandIdParam) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
            <Search className="h-8 w-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard por marca</h1>
            <p className="mt-2 text-muted-foreground">
              Este panel muestra el Cleexs Score, tendencias y comparación con competidores de una marca.
            </p>
            <p className="mt-4 text-muted-foreground">
              Hacé un diagnóstico gratuito y desde el resultado vas a poder acceder a tu dashboard.
            </p>
          </div>
          <Link href="/diagnostico">
            <Button className="bg-primary-600 text-white hover:bg-primary-700">
              Hacer diagnóstico gratuito
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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

  if (error || !data) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-background via-white to-primary-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">{error || 'Marca no encontrada.'}</p>
          <Link href="/diagnostico">
            <Button variant="outline">Hacer diagnóstico</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Convertir comparison a RankingEntry para BrandRankingCard (marca + competidores con "score" = share)
  const sortedComparison = [...data.comparison].sort((a, b) => b.share - a.share);
  const rankingFromComparison = sortedComparison.map((row, idx) => ({
    brandId: row.type === 'brand' ? data.brand.id : `comp-${idx}`,
    brandName: row.name,
    pria: row.share, // usamos % del Top 3 como proxy de presencia
    runId: data.latestRun?.id ?? '',
    periodStart: data.latestRun?.periodStart ?? new Date().toISOString(),
    periodEnd: data.latestRun?.periodEnd ?? new Date().toISOString(),
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
            <CompetitorComparisonCard data={data.comparison} />
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
