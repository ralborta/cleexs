'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function VerResultadoLegacyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vista');
    router.replace(`/ver-resultado/bkp?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <main className="min-h-[calc(100vh-72px)] px-6 py-16">
      <p className="text-center text-sm text-slate-500">Redirigiendo al reporte anterior…</p>
    </main>
  );
}

export default function VerResultadoLegacyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </main>
      }
    >
      <VerResultadoLegacyRedirect />
    </Suspense>
  );
}
