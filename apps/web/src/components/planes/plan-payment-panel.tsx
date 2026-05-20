'use client';

import { useMemo, useState } from 'react';
import { Building2, CreditCard, Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_PLANS, getAnnualPrice, type BillingMode } from '@/lib/plans';
import { cn } from '@/lib/utils';

export type PaymentMethod = 'card' | 'paypal' | 'transfer';
const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function formatMoney(amount: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export interface PlanPaymentPanelProps {
  planId: string;
  billingMode: BillingMode;
  /** Callback opcional tras iniciar el checkout. */
  onConfirm?: () => void;
  /** Ocultar texto inferior duplicado en modal */
  hideFooterSsl?: boolean;
}

export function PlanPaymentPanel({ planId, billingMode, onConfirm, hideFooterSsl }: PlanPaymentPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(() => APP_PLANS.find((p) => p.id === planId) ?? APP_PLANS[1], [planId]);

  const amount = useMemo(() => {
    if (plan.monthlyPrice == null) return 0;
    if (billingMode === 'annual') return getAnnualPrice(plan.monthlyPrice);
    return plan.monthlyPrice;
  }, [plan, billingMode]);

  const periodLabel =
    plan.monthlyPrice == null ? '' : billingMode === 'annual' ? 'Plan anual' : 'Plan mensual';

  const startCheckout = async () => {
    if (method !== 'card') {
      setError('Las suscripciones automáticas de Mercado Pago requieren tarjeta.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
      if (!token) {
        setError('Para pagar necesitás iniciar sesión en el portal. Así podemos activar el plan en tu cuenta.');
        return;
      }

      const res = await fetch(`${API_URL}/api/subscriptions/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId, billingMode }),
      });

      const json = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !json.checkoutUrl) {
        throw new Error(json.error || 'No se pudo iniciar el checkout de Mercado Pago.');
      }

      onConfirm?.();
      window.location.href = json.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
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
                <input
                  type="text"
                  readOnly
                  placeholder="CVC"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 px-3 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">Titular de la tarjeta</span>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="text"
                  readOnly
                  placeholder="Nombre como figura en la tarjeta"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">Correo electrónico</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="email"
                  readOnly
                  placeholder="tu@email.com"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm"
                />
              </div>
            </label>
          </div>

          <p className="mt-6 flex items-center gap-2 text-xs text-emerald-700">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Pago seguro con encriptación SSL
          </p>
        </div>

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
          {error ? (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            className="mt-6 w-full bg-primary-600 hover:bg-primary-700"
            onClick={() => void startCheckout()}
            disabled={submitting || plan.id !== 'crecimiento'}
          >
            {submitting ? 'Redirigiendo a Mercado Pago…' : 'Ir a Mercado Pago'}
          </Button>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Pago seguro con encriptación SSL
          </p>
        </div>
      </div>

      {!hideFooterSsl && (
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Pago seguro con encriptación SSL
        </p>
      )}
    </div>
  );
}
