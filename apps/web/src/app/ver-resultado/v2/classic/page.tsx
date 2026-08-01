'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { VerResultadoV2Shell } from '@/components/diagnostico/ver-resultado-v2-shell';

/** Respaldo del informe v2 clásico (pre v2.25 CRO). Misma URL de datos, layout default. */
function VerResultadoV2ClassicContent() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const tierFromQuery = searchParams.get('tier') === 'gold' ? 'gold' : undefined;

  return (
    <>
      <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-center text-xs text-slate-600">
        Versión clásica del informe (respaldo).{' '}
        <Link
          href={
            diagnosticId
              ? `/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnosticId)}${tierFromQuery ? '&tier=gold' : ''}`
              : '/ver-resultado/v2'
          }
          className="font-semibold text-violet-700 underline-offset-2 hover:underline"
        >
          Ver informe actual (v2.25)
        </Link>
      </div>
      <VerResultadoV2Shell
        diagnosticId={diagnosticId}
        tierFromQuery={tierFromQuery}
        basePath="/ver-resultado/v2/classic"
        layoutVariant="default"
        loadingLabel="Cargando informe clásico…"
      />
    </>
  );
}

export default function VerResultadoV2ClassicPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <VerResultadoV2ClassicContent />
    </Suspense>
  );
}
