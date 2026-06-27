'use client';

import Link from 'next/link';
import { CLEEXS_MARKETING_URL } from '@/lib/site';
import { cn } from '@/lib/utils';
import { OnboardingPreviewLeftPanel } from './onboarding-preview-left-panel';

export function OnboardingPreviewProductionShell({
  brandLabel,
  analysisRunning,
  leftProgressPct,
  analysisComplete,
  children,
}: {
  brandLabel: string;
  analysisRunning: boolean;
  leftProgressPct: number;
  /** Al 100%: ocultar columna izquierda y mostrar solo la pantalla final */
  analysisComplete?: boolean;
  children: React.ReactNode;
}) {
  const showLeftPanel = analysisRunning && !analysisComplete;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col min-h-0">
      <div className="mb-4 shrink-0 sm:mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className={cn(
                'text-xs font-semibold uppercase tracking-widest',
                analysisComplete ? 'text-emerald-600' : 'text-primary-600'
              )}
            >
              {analysisComplete ? 'Análisis completado' : 'Análisis en curso'}
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              {analysisComplete
                ? brandLabel
                  ? `Tu informe de ${brandLabel} está listo`
                  : 'Tu informe está listo'
                : brandLabel
                  ? `Construyendo tu análisis de ${brandLabel}`
                  : 'Construyendo tu análisis'}
            </h1>
          </div>
          <Link
            href={CLEEXS_MARKETING_URL}
            className="shrink-0 rounded-lg transition hover:opacity-90"
            aria-label="Cleexs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CleexsLogo.png" alt="Cleexs" className="h-14 w-auto object-contain sm:h-16" />
          </Link>
        </div>
      </div>

      <div
        className={cn(
          'grid min-h-0 flex-1 gap-6 transition-all duration-500',
          showLeftPanel ? 'grid-cols-1 lg:grid-cols-[1fr,1.15fr] lg:gap-8' : 'grid-cols-1'
        )}
      >
        {showLeftPanel ? (
          <OnboardingPreviewLeftPanel
            brandLabel={brandLabel}
            analysisRunning={analysisRunning}
            progressPct={leftProgressPct}
          />
        ) : null}
        <div
          className={cn(
            'relative flex min-h-0 min-w-0 flex-col',
            analysisComplete && 'mx-auto w-full'
          )}
        >
          <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center">{children}</div>
        </div>
      </div>

      {!analysisComplete ? (
        <p className="mt-4 shrink-0 text-center text-xs text-slate-500">
          El análisis suele tardar entre 30 y 90 segundos. Podés dejarlo abierto: el progreso sigue y te
          llevamos al informe.
        </p>
      ) : null}
    </div>
  );
}
