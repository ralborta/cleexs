'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { buildDiagnosticoV2ViewModel } from '@/lib/diagnostico-v2-data';
import {
  buildPremiumSituationSummary,
  buildPremiumWeeklyPlan,
} from '@/lib/diagnostico-premium-v2-data';
import { DiagnosticoGratuitoV2 } from '@/components/diagnostico/diagnostico-gratuito-v2';
import { PlanConquistarPremiumContent } from '@/components/diagnostico/plan-conquistar-premium-content';
import { appendQueryToPath, buildShareTrackingQuery } from '@/lib/share-tracking';

/** Caso de prueba por defecto: Pizza Hut Bolivia (ralborta@gmail.com) */
const DEFAULT_DIAGNOSTIC_ID = 'e00c0525-007e-4e6d-ada3-c1887da93f81';

function VerResultadoPremiumV2Content() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId') || DEFAULT_DIAGNOSTIC_ID;
  const tierFromQuery = searchParams.get('tier') === 'gold' ? 'gold' : undefined;
  const [diagnostic, setDiagnostic] = useState<PublicDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await publicDiagnosticApi.get(diagnosticId, tierFromQuery);
        if (!cancelled) setDiagnostic(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el diagnóstico.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagnosticId, tierFromQuery]);

  const model = useMemo(
    () => (diagnostic ? buildDiagnosticoV2ViewModel(diagnostic, { unlockEngines: true }) : null),
    [diagnostic],
  );

  const premiumData = useMemo(() => {
    if (!model) return null;
    const situation = buildPremiumSituationSummary({
      brandName: model.brandName,
      domain: model.domain,
      score: model.score,
      leaderName: model.leaderName,
      brandShare: model.brandShare,
      leaderShare: model.leaderShare,
      findings: model.findings,
      weaknesses:
        diagnostic?.analysisJson && 'debilidades' in diagnostic.analysisJson
          ? diagnostic.analysisJson.debilidades
          : undefined,
      strengths:
        diagnostic?.analysisJson && 'fortalezas' in diagnostic.analysisJson
          ? diagnostic.analysisJson.fortalezas
          : undefined,
    });
    const weeklyPlan = buildPremiumWeeklyPlan({
      brandName: model.brandName,
      leaderName: model.leaderName,
      opportunities: model.teaser.opportunities,
      roadmap: model.teaser.roadmap,
    });
    return { situation, weeklyPlan };
  }, [model, diagnostic]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600" />
          <p className="mt-4 text-sm text-slate-500">Cargando informe premium (v2 test)…</p>
        </div>
      </main>
    );
  }

  if (error || !diagnostic || !model || !premiumData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
          <p className="mt-4 text-sm text-slate-600">{error || 'Diagnóstico no encontrado.'}</p>
          <Link href="/diagnostico/crear">
            <Button className="mt-4">Hacer un nuevo diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (diagnostic.status !== 'completed' || !diagnostic.runResult) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <p className="text-sm text-slate-600">El diagnóstico aún no está listo para el informe premium.</p>
      </main>
    );
  }

  const scoreTrackingQuery =
    diagnostic.shareSlug && diagnostic.id
      ? buildShareTrackingQuery({
          kind: 'public_score',
          shareSlug: diagnostic.shareSlug,
          diagnosticId: diagnostic.id,
        })
      : '';
  const sharePath = scoreTrackingQuery
    ? appendQueryToPath(`/ver-resultado/v2/premium?diagnosticId=${encodeURIComponent(diagnostic.id)}`, scoreTrackingQuery)
    : `/ver-resultado/v2/premium?diagnosticId=${encodeURIComponent(diagnostic.id)}`;

  return (
    <DiagnosticoGratuitoV2
      diagnostic={diagnostic}
      model={model}
      sharePath={sharePath}
      variant="premium"
      premiumAppend={
        <PlanConquistarPremiumContent
          data={model.teaser}
          situation={premiumData.situation}
          weeklyPlan={premiumData.weeklyPlan}
          startSectionNum={6}
        />
      }
    />
  );
}

export default function VerResultadoPremiumV2Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <VerResultadoPremiumV2Content />
    </Suspense>
  );
}
