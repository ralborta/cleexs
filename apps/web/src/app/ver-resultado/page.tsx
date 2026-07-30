'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

function VerResultadoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const tierFromQuery = searchParams.get('tier') === 'gold' ? 'gold' : undefined;
  const [diagnostic, setDiagnostic] = useState<PublicDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = diagnosticId;
    if (!id) {
      setLoading(false);
      setError('Falta el ID del diagnóstico. Usá ?diagnosticId=...');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await publicDiagnosticApi.get(id, tierFromQuery);
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

  const isGoldTier =
    tierFromQuery === 'gold' || diagnostic?.tier === 'gold';

  // Informe premium solo para gold; free siempre va a /ver-resultado/v2.
  useEffect(() => {
    if (loading || !diagnosticId || !diagnostic) return;
    if (isGoldTier) return;
    const params = new URLSearchParams(searchParams.toString());
    router.replace(`/ver-resultado/v2?${params.toString()}`);
  }, [diagnostic, diagnosticId, isGoldTier, loading, router, searchParams]);

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
          <p className="mt-4 text-sm text-slate-500">Cargando informe de diagnóstico…</p>
        </div>
      </main>
    );
  }

  if (diagnostic && !isGoldTier) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
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
        <p className="text-sm text-slate-600">El diagnóstico aún no está listo.</p>
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
    ? appendQueryToPath(`/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`, scoreTrackingQuery)
    : `/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`;

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

export default function VerResultadoPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <VerResultadoContent />
    </Suspense>
  );
}
