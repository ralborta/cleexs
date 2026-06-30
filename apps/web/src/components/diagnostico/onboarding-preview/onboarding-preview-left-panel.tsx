'use client';

import { useEffect, useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AnalysisStepsGrid,
  type AnalysisStepItem,
} from '@/app/diagnostico/verificando/analysis-steps-grid';
import { ONBOARDING_STEP_LABELS } from '@/app/diagnostico/verificando/diagnostic-onboarding';

const ANALYSIS_STEP_CARD_LABELS = [
  'Verificando acceso de IA al sitio',
  'Analizando orden para IA',
  'Midiendo claridad de respuesta',
  'Evaluando autoridad real',
  'Chequeando idioma para IA',
  'Revisando actualización de info',
  'Detectando confianza real',
  'Testeando carga y funcionamiento',
  'Rastreando menciones externas',
  'Midiendo intención cubierta',
  'Evaluando comprensión por IA',
] as const;

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function buildSteps(progressPct: number, running: boolean): AnalysisStepItem[] {
  if (!running) {
    return ANALYSIS_STEP_CARD_LABELS.map((label, i) => ({
      id: i + 1,
      label,
      state: 'pending' as const,
      visible: i === 0,
    }));
  }

  const activeIndex = Math.min(
    ANALYSIS_STEP_CARD_LABELS.length - 1,
    Math.floor((progressPct / 100) * ANALYSIS_STEP_CARD_LABELS.length)
  );
  const allDone = progressPct >= 100;

  return ANALYSIS_STEP_CARD_LABELS.map((label, i) => {
    const isCompleted = allDone || i < activeIndex;
    const isActive = !allDone && i === activeIndex;
    const state: AnalysisStepItem['state'] = isCompleted
      ? 'completed'
      : isActive
        ? 'active'
        : 'pending';
    return {
      id: i + 1,
      label,
      state,
      visible: i <= activeIndex || allDone,
    };
  });
}

export function OnboardingPreviewLeftPanel({
  brandLabel,
  analysisRunning,
  progressPct,
  className,
  showSandboxHint = false,
}: {
  brandLabel: string;
  /** false = setup (esperando confirmación a la derecha) */
  analysisRunning: boolean;
  progressPct: number;
  className?: string;
  showSandboxHint?: boolean;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!analysisRunning) {
      setElapsedSeconds(0);
      return;
    }
    const t = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [analysisRunning]);

  const steps = useMemo(
    () => buildSteps(progressPct, analysisRunning),
    [progressPct, analysisRunning]
  );

  const activeIndex = analysisRunning
    ? Math.min(
        ANALYSIS_STEP_CARD_LABELS.length - 1,
        Math.floor((progressPct / 100) * ANALYSIS_STEP_CARD_LABELS.length)
      )
    : 0;
  const completedCount = progressPct >= 100 ? ONBOARDING_STEP_LABELS.length : activeIndex;
  const barPct = analysisRunning ? progressPct : 0;
  const cardLabel = ANALYSIS_STEP_CARD_LABELS[activeIndex] ?? ANALYSIS_STEP_CARD_LABELS[0];

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-col',
        !analysisRunning && 'pointer-events-none select-none opacity-[0.72]',
        className
      )}
      aria-hidden={!analysisRunning ? undefined : undefined}
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 w-full overflow-hidden bg-slate-100">
          <div
            className="h-full bg-primary-600 transition-all duration-700 ease-out"
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Construyendo tu Cleexs Score: {completedCount}/{ONBOARDING_STEP_LABELS.length} completado
          </p>
          {analysisRunning ? (
            <>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold leading-snug text-slate-900">
                    Paso {activeIndex + 1} de {ONBOARDING_STEP_LABELS.length}
                  </p>
                  <p className="mt-1.5 min-h-[2.75rem] text-sm text-slate-600">{cardLabel}</p>
                </div>
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-blue-600 shadow-inner">
                  <Boxes className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span>{progressPct >= 100 ? 'Informe listo' : 'En proceso'}</span>
                  <span className="font-semibold text-slate-700">
                    {Math.round(barPct)}% · {formatElapsed(elapsedSeconds)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Tocá <span className="font-semibold">Continuar</span> en la intro para arrancar el análisis
              {brandLabel ? ` de ${brandLabel}` : ''}.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <AnalysisStepsGrid steps={steps} />
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  analysisRunning ? 'bg-blue-500' : 'bg-slate-300'
                )}
              />
              {analysisRunning ? 'En proceso' : 'Esperando setup'}
            </span>
            <span className="font-semibold text-slate-700">{Math.round(barPct)}%</span>
            <span className="text-slate-500">{formatElapsed(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      {showSandboxHint && !analysisRunning ? (
        <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
          Preview: columna izquierda = producción intacta. Solo cambia la derecha.
        </p>
      ) : null}
    </div>
  );
}
