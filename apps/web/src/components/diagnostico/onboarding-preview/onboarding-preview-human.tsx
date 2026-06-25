'use client';

import { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Paso 2 del funnel (después de intro Gonzalo). Mismo diseño que el wizard de producción. */
export function OnboardingPreviewHuman({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const [humanOk, setHumanOk] = useState(true);

  return (
    <div className="m-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-lg backdrop-blur-sm">
      <div className="h-1.5 w-full bg-slate-100">
        <div className="h-full w-1/6 rounded-r-full bg-violet-600 transition-all" />
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
          Antes del setup
        </p>
        <div className="mt-2 flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h2 className="text-lg font-bold text-slate-900">Confirmá que sos humano</h2>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Un paso rápido para proteger el servicio. Podés dejarlo confirmado y tocar Continuar.
        </p>

        <button
          type="button"
          onClick={() => setHumanOk(!humanOk)}
          aria-pressed={humanOk}
          className={cn(
            'group mt-5 flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all',
            humanOk
              ? 'border-violet-500 bg-gradient-to-r from-violet-50 to-indigo-50 ring-2 ring-violet-100'
              : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30'
          )}
        >
          <span
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all',
              humanOk
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'bg-slate-100 text-slate-400 group-hover:bg-violet-100 group-hover:text-violet-500'
            )}
          >
            {humanOk ? (
              <Check className="h-6 w-6" strokeWidth={2.5} />
            ) : (
              <ShieldCheck className="h-6 w-6" strokeWidth={1.75} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-900">Soy humano</span>
            <span className="block text-xs text-slate-500">
              {humanOk ? 'Verificado. Tocá “Continuar”.' : 'Tocá para confirmar'}
            </span>
          </span>
          <span
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors',
              humanOk ? 'bg-violet-600' : 'bg-slate-200'
            )}
            aria-hidden
          >
            <span
              className={cn(
                'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
                humanOk ? 'left-[1.375rem]' : 'left-0.5'
              )}
            />
          </span>
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          Al continuar también aceptás los{' '}
          <span className="font-medium text-slate-500">términos de uso</span> y la{' '}
          <span className="font-medium text-slate-500">política de privacidad</span>.
        </p>

        <div className="mt-6 flex gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Atrás
          </Button>
          <Button type="button" className="flex-1" disabled={!humanOk} onClick={onContinue}>
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
