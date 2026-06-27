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
  /** true en stage cafecito mientras corren los 12 pasos */
  analysisRunning: boolean;
  leftProgressPct: number;
  /** true al 100%: solo cafecito a pantalla completa, sin columna izquierda */
  analysisComplete?: boolean;
  children: React.ReactNode;
}) {
  // Pantalla final: únicamente el bloque cafecito (video + diagnóstico + WhatsApp)
  if (analysisComplete) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-2">
        {children}
      </div>
    );
  }

  const showLeftPanel = analysisRunning;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col min-h-0">
      <div className="mb-4 shrink-0 sm:mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">
              Análisis en curso
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              {brandLabel ? `Construyendo tu análisis de ${brandLabel}` : 'Construyendo tu análisis'}
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
          'grid min-h-0 flex-1 gap-6',
          showLeftPanel ? 'grid-cols-1 lg:grid-cols-[1fr,1.15fr] lg:gap-8' : 'grid-cols-1'
        )}
      >
        {showLeftPanel ? (
          <OnboardingPreviewLeftPanel
            brandLabel={brandLabel}
            analysisRunning
            progressPct={leftProgressPct}
          />
        ) : (
          <OnboardingPreviewLeftPanel
            brandLabel={brandLabel}
            analysisRunning={false}
            progressPct={0}
          />
        )}
        <div className="relative flex min-h-0 min-w-0 flex-col">
          <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center">{children}</div>
        </div>
      </div>

      <p className="mt-4 shrink-0 text-center text-xs text-slate-500">
        El análisis suele tardar entre 30 y 90 segundos. Podés dejarlo abierto: el progreso sigue y te
        llevamos al informe.
      </p>
    </div>
  );
}
