'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ExternalLink, Loader2 } from 'lucide-react';
import { VerResultadoV2Shell } from '@/components/diagnostico/ver-resultado-v2-shell';

function CroPreviewBannerC({ diagnosticId }: { diagnosticId: string }) {
  const prodHref = `/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnosticId)}`;
  const phaseBHref = `/ver-resultado/v2/cro-preview-b?diagnosticId=${encodeURIComponent(diagnosticId)}`;

  return (
    <div className="border-b border-emerald-300/80 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-950">
      <p className="font-semibold">Preview — Fase C CRO (conversión mobile)</p>
      <p className="mt-1 text-xs text-emerald-900/90">
        CTA sticky, CTA intermedio y calculadora con sliders. Sandbox de revisión — producción ya usa v2.25.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold">
        <Link href={phaseBHref} className="text-violet-700 underline-offset-2 hover:underline">
          Ver Fase B
        </Link>
        <span className="text-emerald-500" aria-hidden>
          ·
        </span>
        <Link
          href={prodHref}
          className="inline-flex items-center gap-1 text-violet-700 underline-offset-2 hover:underline"
        >
          Producción (v2.25)
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function VerResultadoV2CroPreviewCContent() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const tierFromQuery = searchParams.get('tier') === 'gold' ? 'gold' : undefined;

  return (
    <>
      {diagnosticId ? <CroPreviewBannerC diagnosticId={diagnosticId} /> : null}
      <VerResultadoV2Shell
        diagnosticId={diagnosticId}
        tierFromQuery={tierFromQuery}
        basePath="/ver-resultado/v2/cro-preview-c"
        layoutVariant="cro-phase-c"
        showPreviewNav
        loadingLabel="Cargando preview Fase C…"
      />
    </>
  );
}

export default function VerResultadoV2CroPreviewCPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <VerResultadoV2CroPreviewCContent />
    </Suspense>
  );
}
