'use client';

import Link from 'next/link';
import { CLEEXS_MARKETING_URL } from '@/lib/site';
import { OnboardingMobileProgressHeader } from './onboarding-mobile-progress-header';

/** Shell webapp móvil: progreso compacto arriba + contenido full-width (sin grilla lateral). */
export function OnboardingMobileShell({
  brandLabel,
  analysisRunning,
  progressPct,
  elapsedSeconds,
  children,
}: {
  brandLabel: string;
  analysisRunning: boolean;
  progressPct: number;
  elapsedSeconds?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col min-h-0">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <Link
          href={CLEEXS_MARKETING_URL}
          className="inline-flex shrink-0 rounded-lg transition hover:opacity-90"
          aria-label="Cleexs"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/CleexsMark.svg" alt="" className="h-8 w-8" />
        </Link>
        <p className="min-w-0 truncate text-right text-[11px] font-medium text-slate-500">
          {brandLabel ? `Análisis · ${brandLabel}` : 'Análisis en curso'}
        </p>
      </div>

      <OnboardingMobileProgressHeader
        analysisRunning={analysisRunning}
        progressPct={progressPct}
        elapsedSeconds={elapsedSeconds}
        brandLabel={brandLabel}
      />

      <div className="mt-4 min-h-0 flex-1 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>

      <p className="mt-3 shrink-0 text-center text-[10px] leading-relaxed text-slate-400">
        El análisis suele tardar 30–90 s. Podés dejar esta pantalla abierta.
      </p>
    </div>
  );
}
