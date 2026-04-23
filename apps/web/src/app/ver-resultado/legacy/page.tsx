'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function VerResultadoLegacyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('vista', 'legacy');
    router.replace(`/ver-resultado?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <main className="min-h-[calc(100vh-72px)] px-6 py-16">
      <p className="text-center text-sm text-slate-500">Redirigiendo al reporte legacy…</p>
    </main>
  );
}
