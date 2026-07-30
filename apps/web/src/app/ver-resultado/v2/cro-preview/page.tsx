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

function CroPreviewBanner({ diagnosticId }: { diagnosticId: string }) {
  const prodHref = `/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnosticId)}`;

  return (
    <div className="border-b border-amber-300/80 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
      <p className="font-semibold">Preview — Fase A CRO (mobile first)</p>
      <p className="mt-1 text-xs text-amber-900/90">
        No es producción. Tipografía, hero y CTA agrandados para revisión de Gonzalo.
      </p>
      <Link
        href={prodHref}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 underline-offset-2 hover:underline"
      >
        Ver informe v2 actual (producción)
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function VerResultadoV2CroPreviewContent() {
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
          <p className="mt-4 text-sm text-slate-500">Cargando preview Fase A…</p>
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
          <p className="mt-2 text-xs text-slate-500">
            Ejemplo:{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              /ver-resultado/v2/cro-preview?diagnosticId=...
            </code>
          </p>
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
        `/ver-resultado/v2/cro-preview?diagnosticId=${encodeURIComponent(diagnostic.id)}`,
        scoreTrackingQuery,
      )
    : `/ver-resultado/v2/cro-preview?diagnosticId=${encodeURIComponent(diagnostic.id)}`;

  return (
    <>
      <CroPreviewBanner diagnosticId={diagnostic.id} />
      <DiagnosticoGratuitoV2
        diagnostic={diagnostic}
        model={model}
        sharePath={sharePath}
        layoutVariant="cro-phase-a"
      />
    </>
  );
}

export default function VerResultadoV2CroPreviewPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <VerResultadoV2CroPreviewContent />
    </Suspense>
  );
}
