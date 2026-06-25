'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="m-auto flex w-full max-w-lg flex-col items-center rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-lg sm:p-10">
      <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-violet-100 bg-gradient-to-br from-violet-100 to-slate-100 shadow-md">
        {founderPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={founderPhotoUrl} alt="Gonzalo" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-violet-700">
            GA
          </div>
        )}
      </div>

      <p className="mt-6 text-lg font-bold leading-snug text-slate-900">
        Hola, soy Gonzalo — fundador de Cleexs
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Te voy a acompañar en este análisis de{' '}
        <span className="font-semibold text-slate-800">{brandLabel || domain}</span>. Mientras tanto
        detectamos tu país, rubro y competidores para que solo tengas que confirmar.
      </p>

      <div className="mt-6 w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dominio</p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{domain}</p>
      </div>

      {processing ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
          <p className="text-sm text-slate-600">Preparando tu contexto…</p>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ) : ready ? (
        <p className="mt-6 text-sm font-medium text-emerald-700">Listo — podés continuar al setup</p>
      ) : null}

      <Button
        type="button"
        className={cn('mt-8 w-full sm:w-auto', !ready && 'pointer-events-none opacity-50')}
        disabled={!ready}
        onClick={onContinue}
      >
        Continuar
      </Button>
    </div>
  );
}
