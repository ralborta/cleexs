'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Topbar } from './components/Topbar';
import { ModelTabs } from './components/ModelTabs';
import { BrandRankingCard } from './components/BrandRankingCard';
import { CleexsScoreCard } from './components/CleexsScoreCard';
import { IntentCard } from './components/IntentCard';
import { MetricsCard } from './components/MetricsCard';
import { SuggestionsCard } from './components/SuggestionsCard';
import { mockDiagnosticoData } from './mockData';
import type { DiagnosticoDashboardData, ModelTab } from './types';
import { PlusCircle } from 'lucide-react';

/**
 * Dashboard de resultado del diagnóstico.
 * Data mockeada; reemplazar por fetch (ej. por diagnosticId) cuando se integre con la API.
 */
export default function DiagnosticoDashboardPage() {
  const [modelTab, setModelTab] = useState<ModelTab>('consolidado');
  // En producción: const [data, setData] = useState<DiagnosticoDashboardData | null>(null);
  // useEffect(() => { fetch(`/api/diagnostic/${diagnosticId}`).then(r => r.json()).then(setData); }, [diagnosticId]);
  const data: DiagnosticoDashboardData | null = mockDiagnosticoData;

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Resultado del diagnóstico
            </h1>
            <p className="text-slate-600">
              {data
                ? `${data.brandName}${data.industry ? ` · ${data.industry}` : ''}`
                : 'Cargando...'}
            </p>
          </div>
          <Button asChild>
            <Link href="/diagnostico/crear" className="inline-flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Crear diagnóstico
            </Link>
          </Button>
        </header>

        {data && (
          <>
            <ModelTabs value={modelTab} onChange={setModelTab} showGemini />

            {/* Grid superior: 3 columnas en lg */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <BrandRankingCard rows={data.ranking} topN={6} />
              <CleexsScoreCard data={data.cleexsScore} />
              <IntentCard items={data.intenciones} />
            </section>

            {/* Grid inferior: 2 columnas en lg */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MetricsCard items={data.metricas} />
              <SuggestionsCard
                comparaciones={data.comparaciones}
                sugerencias={data.sugerencias}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
