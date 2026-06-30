'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** URL antigua: redirige al portal cliente Free en su ruta propia. */
export default function PortalFreeLegacyRedirect() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;

  useEffect(() => {
    if (runId) router.replace(`/portal-cliente/reporte/${runId}`);
  }, [runId, router]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <p className="text-center text-sm text-slate-600">Redirigiendo al portal cliente…</p>
    </main>
  );
}
