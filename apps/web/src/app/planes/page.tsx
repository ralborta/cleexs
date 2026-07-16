import { Suspense } from 'react';
import { PlanesPageClient } from './planes-page-client';

export default function PlanesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-gradient-to-br from-background via-white to-primary-50/50 px-6">
          <p className="text-sm text-muted-foreground">Cargando planes…</p>
        </main>
      }
    >
      <PlanesPageClient />
    </Suspense>
  );
}
