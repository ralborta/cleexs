import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuditPublicClient } from './audit-public-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Auditoría Agéntica · Cleexs',
  description: 'Qué tan legible es tu sitio para los agentes de IA.',
  robots: { index: false },
};

export default function AuditoriaPublicaPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-violet-500" />
        </main>
      }
    >
      <AuditPublicClient slug={params.slug} />
    </Suspense>
  );
}
