'use client';

import { useEffect, useState } from 'react';
import { BrandRankingCard } from '@/components/dashboard/brand-ranking-card';
import { PRIATrendCard } from '@/components/dashboard/pria-trend-card';
import { PromptRankingCard } from '@/components/dashboard/prompt-ranking-card';
import { CompetitorComparisonCard } from '@/components/dashboard/competitor-comparison-card';
import { BrandPerceptionCard } from '@/components/dashboard/brand-perception-card';
import { reportsApi, promptsApi, RankingEntry, PRIAReport, Prompt } from '@/lib/api';

// Mock tenant ID - en producción vendría de autenticación
const MOCK_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_BRAND_ID = '00000000-0000-0000-0000-000000000002';
const MOCK_VERSION_ID = '00000000-0000-0000-0000-000000000010';

export default function DashboardPage() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [trend, setTrend] = useState<PRIAReport[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [rankingData, trendData, promptsData] = await Promise.all([
          reportsApi.getRanking(MOCK_TENANT_ID),
          reportsApi.getPRIA(MOCK_BRAND_ID),
          promptsApi.getPrompts(MOCK_VERSION_ID),
        ]);

        setRanking(rankingData);
        setTrend(trendData);
        setPrompts(promptsData);
      } catch (error) {
        console.error('Error cargando datos:', error);
        // Datos mock para desarrollo
        setRanking([
          {
            brandId: '1',
            brandName: 'Uber',
            pria: 85,
            runId: '1',
            periodStart: new Date().toISOString(),
            periodEnd: new Date().toISOString(),
          },
          {
            brandId: '2',
            brandName: 'Temso',
            pria: 72,
            runId: '2',
            periodStart: new Date().toISOString(),
            periodEnd: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-slate-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-slate-50 via-white to-purple-50">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-purple-700">Vista general</p>
          <h1 className="text-3xl font-bold text-gray-900">Panel</h1>
          <p className="text-gray-600">
            Visualizá el estado de tu PRIA con rankings, tendencias y percepción de marca.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <BrandRankingCard data={ranking} />
          </div>
          <div className="lg:col-span-1">
            <PRIATrendCard data={trend} />
          </div>
          <div className="lg:col-span-1">
            <PromptRankingCard prompts={prompts} />
          </div>
          <div className="lg:col-span-1">
            <CompetitorComparisonCard />
          </div>
          <div className="lg:col-span-1">
            <BrandPerceptionCard />
          </div>
        </div>
      </div>
    </div>
  );
}
