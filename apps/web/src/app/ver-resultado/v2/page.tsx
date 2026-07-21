'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { buildDiagnosticoV2ViewModel } from '@/lib/diagnostico-v2-data';
import { DiagnosticoGratuitoV2 } from '@/components/diagnostico/diagnostico-gratuito-v2';
import { appendQueryToPath, buildShareTrackingQuery } from '@/lib/share-tracking';

function VerResultadoV2Content() {
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

  useEffect(() => {
    const id = diagnosticId;
    if (!id || !diagnostic || diagnostic.status !== 'completed') return;
    if (diagnostic.runResult) return;

    const pollIntervalMs = 4000;
    const maxWaitMs = 12 * 60 * 1000;
    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled || Date.now() - startedAt >= maxWaitMs) return;
      try {
        const data = await publicDiagnosticApi.get(id, tierFromQuery);
        if (cancelled) return;
        setDiagnostic(data);
        if (data.status === 'failed' || data.runResult) return;
      } catch {
        /* ignore */
      }
      if (!cancelled) timer = setTimeout(poll, pollIntervalMs);
    };

    timer = setTimeout(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [diagnosticId, diagnostic, tierFromQuery]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600" />
          <p className="mt-4 text-sm text-slate-500">Cargando diagnóstico (v2)…</p>
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
          <Link href="/diagnostico/crear">
            <Button className="mt-4">Hacer un nuevo diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (diagnostic.status === 'pending' || diagnostic.status === 'running') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-md text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600" />
          <p className="mt-4 text-sm font-semibold text-slate-700">Tu diagnóstico se está generando…</p>
          <p className="mt-2 text-xs text-slate-500">Recargá en unos segundos o volvé desde el email.</p>
        </div>
      </main>
    );
  }

  if (diagnostic.status === 'failed' || !diagnostic.runResult) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
          <p className="mt-4 text-sm text-slate-600">No hay resultados para mostrar en esta vista.</p>
          <Link href={`/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`}>
            <Button variant="outline" className="mt-4">
              Ver informe actual
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
    ? appendQueryToPath(`/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnostic.id)}`, scoreTrackingQuery)
    : `/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnostic.id)}`;

  return <DiagnosticoGratuitoV2 diagnostic={diagnostic} model={model} sharePath={sharePath} />;
}

export default function VerResultadoV2Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <VerResultadoV2Content />
    </Suspense>
  );
}
