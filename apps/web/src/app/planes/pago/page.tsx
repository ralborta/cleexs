'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlanPaymentPanel } from '@/components/planes/plan-payment-panel';
import type { BillingMode } from '@/lib/plans';

function PagoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') ?? 'crecimiento';
  const billing: BillingMode = useMemo(
    () => (searchParams.get('billing') === 'annual' ? 'annual' : 'monthly'),
    [searchParams]
  );

  return (
    <main className="min-h-[calc(100vh-72px)] bg-slate-100/90 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Selecciona tu método de pago
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Realiza el pago seguro para acceder a nuestro servicio
          </p>
        </div>

        <PlanPaymentPanel
          planId={planId}
          billingMode={billing}
          onConfirm={() => router.push('/diagnostico/crear')}
        />

        <p className="mt-6 text-center">
          <Link href="/planes" className="text-sm font-medium text-primary-600 hover:underline">
            Volver a planes
          </Link>
        </p>
      </div>
    </main>
  );
}

function PagoFallback() {
  return (
    <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-100/90 px-4">
      <p className="text-sm text-slate-500">Cargando…</p>
    </main>
  );
}

export default function PlanesPagoPage() {
  return (
    <Suspense fallback={<PagoFallback />}>
      <PagoContent />
    </Suspense>
  );
}
