'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Alias legacy: redirige al informe principal en /ver-resultado */
function VerResultadoPremiumV2Redirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    router.replace(`/ver-resultado?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
        <p className="mt-4 text-sm text-slate-500">Redirigiendo al informe…</p>
      </div>
    </main>
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
      <VerResultadoPremiumV2Redirect />
    </Suspense>
  );
}
