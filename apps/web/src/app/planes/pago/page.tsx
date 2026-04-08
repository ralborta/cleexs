'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, CreditCard, Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_PLANS, getAnnualPrice, type BillingMode } from '@/lib/plans';
import { cn } from '@/lib/utils';

type PaymentMethod = 'card' | 'paypal' | 'transfer';

function formatMoney(amount: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function PagoContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan') ?? 'crecimiento';
  const billingParam = searchParams.get('billing');
  const billing: BillingMode = billingParam === 'annual' ? 'annual' : 'monthly';

  const [method, setMethod] = useState<PaymentMethod>('card');

  const plan = useMemo(() => APP_PLANS.find((p) => p.id === planId) ?? APP_PLANS[1], [planId]);

  const amount = useMemo(() => {
    if (plan.monthlyPrice == null) return 0;
    if (billing === 'annual') return getAnnualPrice(plan.monthlyPrice);
    return plan.monthlyPrice;
  }, [plan, billing]);

  const periodLabel =
    plan.monthlyPrice == null ? '' : billing === 'annual' ? 'Plan anual' : 'Plan mensual';

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

        {/* Métodos de pago */}
        <div className="mb-6 space-y-3">
          <button
            type="button"
            onClick={() => setMethod('card')}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border bg-white px-4 py-4 text-left shadow-sm transition-all',
              method === 'card'
                ? 'border-primary-500 ring-2 ring-primary-100'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
                <CreditCard className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-sm font-medium text-slate-900">Tarjeta de crédito o débito</span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-slate-700">{formatMoney(amount)}</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('paypal')}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border bg-white px-4 py-4 text-left shadow-sm transition-all',
              method === 'paypal'
                ? 'border-primary-500 ring-2 ring-primary-100'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#003087]/5 text-[#003087]">
                <span className="text-xs font-bold tracking-tight">PayPal</span>
              </span>
              <span className="text-sm font-medium text-slate-900">PayPal</span>
            </div>
            <span
              className={cn(
                'h-5 w-5 rounded-full border-2',
                method === 'paypal' ? 'border-primary-600 bg-primary-600' : 'border-slate-300'
              )}
              aria-hidden
            />
          </button>

          <button
            type="button"
            onClick={() => setMethod('transfer')}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border bg-white px-4 py-4 text-left shadow-sm transition-all',
              method === 'transfer'
                ? 'border-primary-500 ring-2 ring-primary-100'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-sm font-medium text-slate-900">Transferencia bancaria</span>
            </div>
            <span
              className={cn(
                'h-5 w-5 rounded-full border-2',
                method === 'transfer' ? 'border-primary-600 bg-primary-600' : 'border-slate-300'
              )}
              aria-hidden
            />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_min(320px,100%)]">
          {/* Detalles del pago */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Detalles del pago</h2>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#1A1F71]">
                  VISA
                </span>
                <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#EB001B]">
                  MC
                </span>
                <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                  AMEX
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Número de tarjeta</span>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type="text"
                    readOnly
                    placeholder="0000 0000 0000 0000"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">Vencimiento</span>
                  <input
                    type="text"
                    readOnly
                    placeholder="MM / AA"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">CVC</span>
                  <input type="text" readOnly placeholder="CVC" className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 px-3 text-sm" />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Titular de la tarjeta</span>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input type="text" readOnly placeholder="Nombre como figura en la tarjeta" className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm" />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">Correo electrónico</span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input type="email" readOnly placeholder="tu@email.com" className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm" />
                </div>
              </label>
            </div>

            <p className="mt-6 flex items-center gap-2 text-xs text-emerald-700">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Pago seguro con encriptación SSL
            </p>
          </div>

          {/* Resumen */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{formatMoney(amount)}</p>
            <p className="mt-2 text-sm text-slate-600">
              {plan.name}
              {periodLabel && ` · ${periodLabel}`}
            </p>
            <div className="my-4 border-t border-slate-100" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Total</span>
              <span className="font-semibold tabular-nums text-slate-900">{formatMoney(amount)}</span>
            </div>
            <Button type="button" className="mt-6 w-full bg-primary-600 hover:bg-primary-700">
              Confirmar pago
            </Button>
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Pago seguro con encriptación SSL
            </p>
          </div>
        </div>

        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Pago seguro con encriptación SSL
        </p>

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
    <main className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-slate-100/90 px-4">
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
