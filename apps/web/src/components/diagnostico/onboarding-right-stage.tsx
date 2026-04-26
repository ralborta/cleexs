'use client';

import { MessageSquare, Radar, Sparkles, Trophy, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OnboardingVisualStage = 'site' | 'scan' | 'chatgpt' | 'score' | 'compete';

const STAGE_CONFIG: Record<
  OnboardingVisualStage,
  { label: string; sub: string; icon: typeof Building2; accent: string }
> = {
  site: {
    label: 'Sitio bajo lupa',
    sub: 'Vinculamos tu dominio y marca con lo que las IAs suelen razonar',
    icon: Building2,
    accent: 'from-slate-600/90 to-slate-800/95',
  },
  scan: {
    label: 'Escanéo estructural',
    sub: 'Buscando bloques, FAQ y señales que un bot pueda citar o entender',
    icon: Radar,
    accent: 'from-indigo-600/90 to-slate-900/95',
  },
  chatgpt: {
    label: 'Simulación tipo ChatGPT',
    sub: 'Cómo podría el modelo ordenar a competidores y a tu propuesta (mock)',
    icon: MessageSquare,
    accent: 'from-indigo-700/90 to-indigo-900/95',
  },
  score: {
    label: 'Score en construcción',
    sub: 'Agrupando señales en un único indicador 0-100 (Cleexs)',
    icon: Sparkles,
    accent: 'from-violet-700/85 to-slate-900/95',
  },
  compete: {
    label: 'Tensión competitiva',
    sub: 'Comparando frecuencia e intención frente a otras marcas (parcial)',
    icon: Trophy,
    accent: 'from-amber-800/80 to-slate-950/95',
  },
};

const STEP_REFERENCE_IMAGE: Partial<Record<number, string>> = {
  2: '/onboarding-step-2.png',
  3: '/onboarding-step-3.png',
  5: '/onboarding-step-5.png',
  6: '/onboarding-step-6.png',
  7: '/onboarding-step-7.png',
  8: '/onboarding-step-8.png',
  9: '/onboarding-step-9.png',
  10: '/onboarding-step-10.png',
  11: '/onboarding-step-11.png',
};

function stageFromStepIndex(i: number): OnboardingVisualStage {
  if (i <= 1) return 'site';
  if (i <= 3) return 'scan';
  if (i <= 5) return 'chatgpt';
  if (i <= 7) return 'score';
  return 'compete';
}

export { stageFromStepIndex };

export function OnboardingRightStage({
  stepIndex,
  brandName,
  domainShort,
  pulseKey,
  className,
}: {
  stepIndex: number;
  brandName: string | null;
  domainShort: string;
  /** Cambia tras interacción (ej. quiz) para animar de nuevo */
  pulseKey?: number;
  className?: string;
}) {
  const stage = stageFromStepIndex(stepIndex);
  const { label, sub, icon: Icon, accent } = STAGE_CONFIG[stage];
  const brand = brandName ?? 'Tu marca';
  const stepNumber = stepIndex + 1;
  const referenceImage = STEP_REFERENCE_IMAGE[stepNumber] ?? (stepNumber === 4 ? STEP_REFERENCE_IMAGE[3] : undefined);

  return (
    <div
      className={cn('relative flex min-h-[220px] flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 p-4 text-left shadow-md', className)}
      data-stage={stage}
    >
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100', accent)} />
      <div
        className="pointer-events-none absolute inset-0 bg-[url('/verificando-hero-2.png')] bg-center bg-no-repeat opacity-15"
        style={{ backgroundSize: '80% auto' }}
      />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="mb-3 flex items-center gap-2 text-white/95">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{label}</p>
            <p className="line-clamp-2 text-[11px] text-white/70">{sub}</p>
          </div>
        </div>

        {referenceImage && (
          <div className="mt-1 overflow-hidden rounded-xl border border-white/20 bg-black/25 shadow-2xl shadow-slate-950/30">
            <img
              src={referenceImage}
              alt={`Vista de referencia del paso ${stepNumber}`}
              className="h-auto w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {stage === 'site' && !referenceImage && (
          <div key={`site-${pulseKey}`} className="mt-1 flex-1 space-y-2">
            <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-white/90">
              <p className="font-mono text-[10px] text-white/50">{domainShort}</p>
              <p className="mt-1 font-medium">{brand}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full w-[40%] animate-pulse rounded-full bg-emerald-400/80"
                  style={{ animationDuration: '1.4s' }}
                />
              </div>
            </div>
          </div>
        )}

        {stage === 'scan' && !referenceImage && (
          <div key={`scan-${pulseKey}`} className="mt-1 grid flex-1 grid-cols-2 gap-2 text-[10px]">
            {['H1 / propuesta', 'Schema / metas', 'FAQ / cómo', 'Navegación', 'Contenido', 'Velocidad'].map(
              (cell, idx) => (
                <div
                  key={cell}
                  className={cn(
                    'rounded border border-white/20 bg-white/5 px-2 py-1.5 text-center text-white/80 transition-colors duration-500',
                    idx < (stepIndex % 4) + 2 && 'bg-emerald-500/20 border-emerald-400/40'
                  )}
                >
                  {cell}
                </div>
              )
            )}
          </div>
        )}

        {stage === 'chatgpt' && !referenceImage && (
          <div key={`chat-${pulseKey}`} className="mt-1 flex-1 space-y-2 text-[11px]">
            <div className="rounded-lg border border-white/15 bg-black/20 p-2.5 text-white/90">
              <p className="text-[9px] font-medium text-white/50">ChatGPT (simulado)</p>
              <p className="mt-1 leading-snug">
                “Para {brand}… comparo con otras marcas. Los usuarios a menudo preguntan por {domainShort}…”
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {[`#1 competidor`, `#2 ${(brandName ?? 'Tu marca').split(' ')[0]!}`, '#3 tercer lugar'].map((l) => (
                <span key={l} className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/80">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {stage === 'score' && !referenceImage && (
          <div key={`score-${pulseKey}`} className="mt-1 flex flex-1 flex-col items-center justify-center gap-2">
            <div className="relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-white/20"
                  strokeWidth="2.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-emerald-400/80 transition-all duration-1000"
                  strokeWidth="2.5"
                  strokeDasharray={`${30 + (stepIndex % 5) * 12} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">···</span>
            </div>
            <p className="text-center text-[10px] text-white/60">Ajustando el Cleexs Score con las señales ya capturadas</p>
          </div>
        )}

        {stage === 'compete' && !referenceImage && (
          <div key={`compete-${pulseKey}`} className="mt-1 flex flex-1 flex-col justify-center gap-1.5 text-[11px] text-white/90">
            {[
              { n: 'Comp. A', w: 78 },
              { n: brand.slice(0, 12), w: 45 + (stepIndex % 4) * 5, you: true },
              { n: 'Comp. B', w: 36 },
            ].map((r) => (
              <div key={r.n} className="flex items-center gap-2">
                <span className="w-16 truncate text-white/80">{r.n}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-white/10">
                  <div
                    className={cn('h-full rounded', r.you ? 'bg-amber-400' : 'bg-white/40')}
                    style={{ width: `${r.w}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="mt-1 text-[9px] text-amber-200/90">FOMO: tu categoría ya se mueve en respuestas de IA.</p>
          </div>
        )}
      </div>
    </div>
  );
}
