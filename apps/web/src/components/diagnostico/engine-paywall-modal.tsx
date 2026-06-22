'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Lock, Sparkles, X } from 'lucide-react';
import { PlanConquistarPromoPrice } from '@/components/planes/plan-conquistar-checkout-button';

const PLAN_CONQUISTAR_PATH = '/plan-conquistar';

export function EnginePaywallModal({
  open,
  engineName,
  onClose,
}: {
  open: boolean;
  /** Motor que el usuario intentó abrir (ej. "Claude", "Perplexity"). */
  engineName: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const engineLabel = engineName?.trim() || 'este motor';

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] bg-slate-900/55 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[61] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ranking en ${engineLabel} disponible en Premium`}
          className="relative my-4 w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white shadow-2xl sm:my-0"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pb-6 pt-7 sm:px-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Lock className="h-5 w-5" />
            </div>

            <h2 className="mt-4 text-lg font-bold text-slate-900">
              Cómo rankeás en {engineLabel} es parte de <span className="text-violet-600">Premium</span>
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Esto es solo para planes Premium. Si estás considerando seriamente ser la marca favorita de
              los motores de IA, sumate al{' '}
              <strong className="font-semibold text-slate-800">
                Plan Conquistar ChatGPT en 90 días
              </strong>{' '}
              por un pago único de{' '}
              <PlanConquistarPromoPrice size="sm" className="inline-flex align-baseline" />.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {[
                'Cleexs Score detallado por motor: ChatGPT, Claude, Gemini y Perplexity',
                'Las 20 oportunidades de mayor impacto + plan de acción de 90 días',
                'Acceso total a Cleexs Premium durante 90 días (USD 297 incluido)',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
              <Link
                href={PLAN_CONQUISTAR_PATH}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
              >
                Sí, me interesa en serio
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] sm:flex-none"
              >
                No, por ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
