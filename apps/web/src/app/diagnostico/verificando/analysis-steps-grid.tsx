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

function CompletedSphereCheck() {
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_24%,#93c5fd_0%,#2563eb_48%,#1d4ed8_100%)] shadow-[inset_0_2px_4px_rgba(255,255,255,0.38),inset_0_-3px_6px_rgba(29,78,216,0.5),0_2px_0_0_#1e40af,0_4px_10px_rgba(37,99,235,0.32)]">
      <span
        aria-hidden
        className="pointer-events-none absolute left-[7px] top-[6px] h-[9px] w-[9px] rounded-full bg-white/50 blur-[0.4px]"
      />
      <Check
        className="relative z-10 h-4 w-4 text-white drop-shadow-[0_1px_1.5px_rgba(15,23,42,0.28)]"
        strokeWidth={3}
      />
    </span>
  );
}

function stepCardSurfaceClass(state: ProgressStepState): string {
  switch (state) {
    case 'completed':
      return cn(
        'border-slate-200 border-b-slate-300 bg-white',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_2px_0_0_rgb(226,232,240),0_5px_14px_rgba(15,23,42,0.08)]'
      );
    case 'active':
      return cn(
        'border-blue-300 border-b-blue-400 bg-blue-50/40 ring-1 ring-blue-200/80',
        '-translate-y-px',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_2px_0_0_rgb(147,197,253),0_6px_16px_rgba(59,130,246,0.14)]'
      );
    case 'pending':
      return cn(
        'border-slate-200 bg-slate-50/65',
        'shadow-[inset_0_2px_5px_rgba(15,23,42,0.05),0_1px_0_0_rgba(255,255,255,0.65)]'
      );
  }
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
        stepCardSurfaceClass(state)
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center gap-3">
        {state === 'completed' && <CompletedSphereCheck />}
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
    <div className="mt-4 space-y-3">
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
