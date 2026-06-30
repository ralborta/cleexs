'use client';

import Link from 'next/link';
import { CLEEXS_MARKETING_URL } from '@/lib/site';
import { OnboardingPreviewLeftPanel } from './onboarding-preview-left-panel';

export function OnboardingPreviewProductionShell({
  brandLabel,
  analysisRunning,
  leftProgressPct,
  showSandboxHint,
  children,
}: {
  brandLabel: string;
  analysisRunning: boolean;
  leftProgressPct: number;
  showSandboxHint?: boolean;
  children: React.ReactNode;
}) {
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr,1.15fr] lg:gap-8">
        <OnboardingPreviewLeftPanel
          brandLabel={brandLabel}
          analysisRunning={analysisRunning}
          progressPct={leftProgressPct}
          showSandboxHint={showSandboxHint}
        />
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
