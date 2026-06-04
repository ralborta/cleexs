import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AeoPublicClient } from './aeo-public-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Análisis + Reescritura AEO · Cleexs',
  description: 'Cómo reescribir tu contenido para que las IAs te entiendan y te recomienden.',
  robots: { index: false },
};

export default function AeoPublicaPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-violet-500" />
        </main>
      }
    >
      <AeoPublicClient slug={params.slug} />
    </Suspense>
  );
}
