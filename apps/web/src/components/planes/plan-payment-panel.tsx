'use client';

import { useMemo, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_PLANS, getAnnualPrice, type BillingMode } from '@/lib/plans';

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
  hideFooterSsl?: boolean;
}

export function PlanPaymentPanel({ planId, billingMode, onConfirm, hideFooterSsl }: PlanPaymentPanelProps) {
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

      const json = (await res.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
        message?: string;
      };

      if (!res.ok || !json.checkoutUrl) {
        throw new Error(json.error || json.message || 'No se pudo iniciar el checkout de Mercado Pago.');
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
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total mensual</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{formatMoney(amount)}</p>
        <p className="mt-1 text-sm text-slate-600">
          {plan.name}
          {periodLabel && ` · ${periodLabel}`}
        </p>

        <ul className="mt-6 space-y-2 border-t border-slate-100 pt-6">
          {plan.features.slice(0, 4).map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {error ? (
          <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          className="mt-6 w-full bg-primary-600 hover:bg-primary-700"
          onClick={() => void startCheckout()}
          disabled={submitting || plan.id !== 'crecimiento'}
        >
          {submitting ? 'Redirigiendo a Mercado Pago…' : 'Pagar con Mercado Pago'}
        </Button>

        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Procesado por Mercado Pago · Visa · Mastercard · AMEX · Cabal
        </p>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          El cobro se realiza en pesos (ARS) según el tipo de cambio del día. Solo tarjeta para débito automático.
        </p>
      </div>

      {!hideFooterSsl && (
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Pago seguro con encriptación SSL
        </p>
      )}
    </div>
  );
}
