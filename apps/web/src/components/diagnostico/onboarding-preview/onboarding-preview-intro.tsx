'use client';

import { Check, Globe, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OnboardingPreviewBadge,
  OnboardingPreviewCard,
  OnboardingPreviewNav,
} from './onboarding-preview-frame';

export function OnboardingPreviewIntro({
  brandLabel,
  domain,
  founderPhotoUrl,
  processing,
  ready,
  onContinue,
}: {
  brandLabel: string;
  domain: string;
  founderPhotoUrl?: string;
  processing: boolean;
  ready: boolean;
  onContinue: () => void;
}) {
  return (
    <OnboardingPreviewCard badge={<OnboardingPreviewBadge>Introducción</OnboardingPreviewBadge>}>
      <div className="px-6 py-8 text-center sm:px-8 sm:py-10">
        <div className="relative mx-auto h-40 w-40 sm:h-44 sm:w-44">
          <Sparkles className="absolute -left-2 top-3 h-5 w-5 text-violet-400" aria-hidden />
          <Sparkles className="absolute -right-2 top-5 h-4 w-4 text-violet-300" aria-hidden />
          <Sparkles className="absolute bottom-4 -left-1 h-4 w-4 text-violet-300" aria-hidden />
          <div className="relative h-full w-full overflow-hidden rounded-full border-[5px] border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 shadow-lg ring-4 ring-violet-50">
            {founderPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={founderPhotoUrl}
                alt="Gonzalo"
                className="h-full w-full scale-110 object-cover object-[center_18%]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-violet-700 sm:text-5xl">
                GA
              </div>
            )}
          </div>
        </div>

        <h2 className="mt-6 text-2xl font-bold text-slate-900">Hola, soy Gonzalo</h2>
        <p className="mt-1 text-base font-semibold text-violet-600">fundador de Cleexs 👋</p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
          Te voy a acompañar en este análisis. Mientras tanto detectamos tu país, rubro y
          competidores para que solo tengas que confirmar.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Globe className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Dominio detectado
            </p>
            <p className="truncate text-sm font-bold text-slate-900">{domain}</p>
            {brandLabel ? (
              <p className="truncate text-xs text-slate-500">{brandLabel}</p>
            ) : null}
          </div>
          {ready ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
          ) : null}
        </div>

        {processing ? (
          <div className="mt-5 flex flex-col items-center gap-2">
            <Loader2 className="h-7 w-7 animate-spin text-violet-600" aria-hidden />
            <p className="text-sm text-slate-600">Preparando tu contexto…</p>
          </div>
        ) : ready ? (
          <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <Check className="h-4 w-4" />
            Listo — podés continuar al setup
          </p>
        ) : null}

        <OnboardingPreviewNav
          fullWidthNext
          nextLabel="Continuar"
          nextDisabled={!ready}
          onNext={onContinue}
          showBack={false}
        />
      </div>
    </OnboardingPreviewCard>
  );
}
