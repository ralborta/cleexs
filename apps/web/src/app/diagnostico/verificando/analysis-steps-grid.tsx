'use client';

import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProgressStepState = 'completed' | 'active' | 'pending';

export type AnalysisStepItem = {
  id: number;
  label: string;
  state: ProgressStepState;
  visible: boolean;
};

function ActiveOrbitIcon() {
  return (
    <span className="relative inline-flex h-8 w-8 items-center justify-center">
      <span className="absolute inset-0 rounded-full border-2 border-blue-300/80 border-t-blue-500 border-r-blue-500 animate-spin [animation-duration:1.6s]" />
      <span className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.16)]" />
    </span>
  );
}

export function ProgressStepCard({
  stepNumber,
  label,
  state,
  visible,
  delayMs = 0,
}: {
  stepNumber: number;
  label: string;
  state: ProgressStepState;
  visible: boolean;
  delayMs?: number;
}) {
  return (
    <article
      className={cn(
        'rounded-xl border px-4 py-3 transition-all duration-400 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
        state === 'completed' && 'border-slate-200 bg-white shadow-sm',
        state === 'active' && 'border-blue-300 bg-blue-50/40 shadow-sm ring-1 ring-blue-200/80',
        state === 'pending' && 'border-slate-200 bg-slate-50/65'
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center gap-3">
        {state === 'completed' && (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
            <Check className="h-4 w-4" />
          </span>
        )}
        {state === 'active' && <ActiveOrbitIcon />}
        {state === 'pending' && (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400">
            <Circle className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0">
          <p
            className={cn(
              'text-sm font-medium leading-snug',
              state === 'pending' ? 'text-slate-500' : 'text-slate-900'
            )}
          >
            {stepNumber}. {label}
          </p>
          {state === 'active' && (
            <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              En proceso
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function AnalysisStepsGrid({ steps }: { steps: AnalysisStepItem[] }) {
  return (
    <div className="mt-4 space-y-2.5">
      {steps.map((step, i) => (
        <ProgressStepCard
          key={step.id}
          stepNumber={step.id}
          label={step.label}
          state={step.state}
          visible={step.visible}
          delayMs={i * 40}
        />
      ))}
    </div>
  );
}
