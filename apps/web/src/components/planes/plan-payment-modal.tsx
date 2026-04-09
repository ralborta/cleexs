'use client';

import { Lock, X } from 'lucide-react';
import { PlanPaymentPanel } from './plan-payment-panel';
import type { BillingMode } from '@/lib/plans';

export interface PlanPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  billingMode: BillingMode;
  /** Tras confirmar (sin cobro real): lleva al flujo de diagnóstico */
  onConfirm: () => void;
}

export function PlanPaymentModal({
  open,
  onOpenChange,
  planId,
  billingMode,
  onConfirm,
}: PlanPaymentModalProps) {
  if (!open) return null;

  function handleConfirm() {
    onConfirm();
    onOpenChange(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-payment-title"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative max-h-[min(92vh,900px)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-6 pb-2 pt-8 pr-14 text-center sm:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pago seguro</p>
          <h2 id="plan-payment-title" className="mt-3 text-2xl font-bold text-primary-900 sm:text-[1.65rem]">
            Selecciona tu método de pago
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Realiza el pago seguro para acceder a nuestro servicio
          </p>
        </div>

        <div className="mx-6 mb-4 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 sm:mx-8">
          <p className="text-sm font-semibold text-slate-900">Selecciona tu método de pago</p>
          <p className="text-xs text-slate-500">Realiza el pago seguro para acceder a nuestro servicio</p>
        </div>

        <div className="px-6 pb-8 sm:px-8">
          <PlanPaymentPanel
            planId={planId}
            billingMode={billingMode}
            onConfirm={handleConfirm}
            hideFooterSsl
          />
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            Pago seguro con encriptación SSL
          </p>
        </div>
      </div>
    </div>
  );
}
