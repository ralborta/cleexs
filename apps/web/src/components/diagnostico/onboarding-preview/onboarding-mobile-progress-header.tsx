'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ONBOARDING_ANALYSIS_STEP_COUNT,
  ONBOARDING_ANALYSIS_STEP_LABELS,
  activeAnalysisStepIndex,
  buildAnalysisStepItems,
} from '@/lib/onboarding-analysis-steps';
import { cn } from '@/lib/utils';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function OnboardingMobileProgressHeader({
  analysisRunning,
  progressPct,
  elapsedSeconds = 0,
  brandLabel,
}: {
  analysisRunning: boolean;
  progressPct: number;
  elapsedSeconds?: number;
  brandLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeIndex = activeAnalysisStepIndex(progressPct, analysisRunning);
  const steps = useMemo(
    () => buildAnalysisStepItems(progressPct, analysisRunning),
    [progressPct, analysisRunning],
  );
  const barPct = analysisRunning ? progressPct : 0;
  const currentLabel = ONBOARDING_ANALYSIS_STEP_LABELS[activeIndex] ?? ONBOARDING_ANALYSIS_STEP_LABELS[0];
  const completedCount = progressPct >= 100 ? ONBOARDING_ANALYSIS_STEP_COUNT : activeIndex;

  return (
    <div className="shrink-0 rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex gap-0.5 px-3 pt-3">
        {ONBOARDING_ANALYSIS_STEP_LABELS.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              !analysisRunning && i === 0 && 'bg-blue-200',
              analysisRunning &&
                (i < activeIndex || progressPct >= 100
                  ? 'bg-blue-500'
                  : i === activeIndex
                    ? 'bg-blue-400'
                    : 'bg-slate-200'),
            )}
            aria-hidden
          />
        ))}
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Construyendo tu Cleexs Score
        </p>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
            style={{ width: `${barPct}%` }}
          />
        </div>

        {analysisRunning ? (
          <>
            <p className="mt-3 text-sm font-bold text-slate-900">
              Paso {activeIndex + 1} de {ONBOARDING_ANALYSIS_STEP_COUNT}
            </p>
            <p className="mt-1 text-sm leading-snug text-slate-600">{currentLabel}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>{progressPct >= 100 ? 'Informe listo' : 'En proceso'}</span>
              <span className="font-semibold tabular-nums text-slate-700">
                {Math.round(barPct)}% · {formatElapsed(elapsedSeconds)}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Tocá <span className="font-semibold text-slate-800">Continuar</span> para arrancar
            {brandLabel ? ` el análisis de ${brandLabel}` : ' el análisis'}.
          </p>
        )}

        {analysisRunning ? (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver todos los pasos
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {expanded ? (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto border-t border-slate-100 pt-3">
                {steps.map((step) => (
                  <li
                    key={step.id}
                    className={cn(
                      'flex items-start gap-2 text-xs leading-snug',
                      step.state === 'pending' ? 'text-slate-400' : 'text-slate-700',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                        step.state === 'completed' && 'bg-blue-600 text-white',
                        step.state === 'active' && 'bg-blue-100 ring-2 ring-blue-400',
                        step.state === 'pending' && 'border border-dashed border-slate-300',
                      )}
                    >
                      {step.state === 'completed' ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span>
                      <span className="font-medium">{step.id}.</span> {step.label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-2 text-[10px] text-slate-400">
              {completedCount}/{ONBOARDING_ANALYSIS_STEP_COUNT} completados
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
