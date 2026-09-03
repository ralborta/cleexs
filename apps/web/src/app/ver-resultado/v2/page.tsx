'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { VerResultadoV2Shell } from '@/components/diagnostico/ver-resultado-v2-shell';

function VerResultadoV2Content() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const tierFromQuery = searchParams.get('tier') === 'gold' ? 'gold' : undefined;

  return (
    <VerResultadoV2Shell
      diagnosticId={diagnosticId}
      tierFromQuery={tierFromQuery}
      basePath="/ver-resultado/v2"
      layoutVariant="cro-phase-c"
      loadingLabel="Cargando diagnóstico…"
    />
  );
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
