'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { buildDiagnosticoV2ViewModel } from '@/lib/diagnostico-v2-data';
import { DiagnosticoGratuitoV2 } from '@/components/diagnostico/diagnostico-gratuito-v2';
import { appendQueryToPath, buildShareTrackingQuery } from '@/lib/share-tracking';

function CroPreviewBannerB({ diagnosticId }: { diagnosticId: string }) {
  const prodHref = `/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnosticId)}`;
  const phaseAHref = `/ver-resultado/v2/cro-preview?diagnosticId=${encodeURIComponent(diagnosticId)}`;

  return (
    <div className="border-b border-indigo-300/80 bg-indigo-50 px-4 py-3 text-center text-sm text-indigo-950">
      <p className="font-semibold">Preview — Fase B CRO (narrativa consultoría)</p>
      <p className="mt-1 text-xs text-indigo-900/90">
        No es producción. Conclusión primero, evidencia después — para revisión de Gonzalo.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold">
        <Link href={phaseAHref} className="text-violet-700 underline-offset-2 hover:underline">
          Ver Fase A (tipografía)
        </Link>
        <span className="text-indigo-400" aria-hidden>
          ·
        </span>
        <Link
          href={`/ver-resultado/v2/cro-preview-c?diagnosticId=${encodeURIComponent(diagnosticId)}`}
          className="text-violet-700 underline-offset-2 hover:underline"
        >
          Ver Fase C (conversión)
        </Link>
        <span className="text-indigo-400" aria-hidden>
          ·
        </span>
        <Link
          href={prodHref}
          className="inline-flex items-center gap-1 text-violet-700 underline-offset-2 hover:underline"
        >
          Informe v2 producción
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function VerResultadoV2CroPreviewBContent() {
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600" />
          <p className="mt-4 text-sm text-slate-500">Cargando preview Fase B…</p>
        </div>
      </main>
    );
  }

  if (error || !diagnostic) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
          <p className="mt-4 text-sm text-slate-600">{error || 'Diagnóstico no encontrado.'}</p>
        </div>
      </main>
    );
  }

  if (diagnostic.status !== 'completed' || !diagnostic.runResult) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
          <p className="mt-4 text-sm text-slate-600">Este diagnóstico aún no tiene informe completo para el preview.</p>
          <Link href={`/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnostic.id)}`}>
            <Button variant="outline" className="mt-4">
              Ver informe v2
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  const model = buildDiagnosticoV2ViewModel(diagnostic);
  if (!model) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <p className="text-sm text-slate-600">No se pudo armar la vista del diagnóstico.</p>
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
    ? appendQueryToPath(
        `/ver-resultado/v2/cro-preview-b?diagnosticId=${encodeURIComponent(diagnostic.id)}`,
        scoreTrackingQuery,
      )
    : `/ver-resultado/v2/cro-preview-b?diagnosticId=${encodeURIComponent(diagnostic.id)}`;

  return (
    <>
      <CroPreviewBannerB diagnosticId={diagnostic.id} />
      <DiagnosticoGratuitoV2
        diagnostic={diagnostic}
        model={model}
        sharePath={sharePath}
        layoutVariant="cro-phase-b"
      />
    </>
  );
}

export default function VerResultadoV2CroPreviewBPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <VerResultadoV2CroPreviewBContent />
    </Suspense>
  );
}
