'use client';

import { ArrowLeft, ArrowRight, Lock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OnboardingPreviewBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-lg bg-violet-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">
      {children}
    </span>
  );
}

export function OnboardingPreviewCard({
  badge,
  children,
  className,
}: {
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-lg', className)}>
      {badge ? <div className="mb-3">{badge}</div> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/40">
        {children}
      </div>
    </div>
  );
}

export function OnboardingPreviewNav({
  onBack,
  onNext,
  nextLabel = 'Continuar',
  nextDisabled,
  showBack = true,
  fullWidthNext,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
  fullWidthNext?: boolean;
}) {
  if (fullWidthNext) {
    return (
      <Button type="button" className="mt-6 w-full gap-2" disabled={nextDisabled} onClick={onNext}>
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="mt-6 flex gap-3">
      {showBack && onBack ? (
        <Button type="button" variant="outline" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </Button>
      ) : null}
      <Button
        type="button"
        className={cn('gap-2', showBack && onBack ? 'flex-1' : 'w-full')}
        disabled={nextDisabled}
        onClick={onNext}
      >
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function OnboardingPreviewTrustFooter({ variant = 'shield' }: { variant?: 'shield' | 'lock' | 'row' }) {
  if (variant === 'row') {
    return (
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-violet-500" />
          Tus datos están protegidos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-violet-500" />
          100% seguro y confidencial
        </span>
        <span>Sin instalación ni descargas</span>
      </div>
    );
  }

  const Icon = variant === 'lock' ? Lock : Shield;
  const text =
    variant === 'lock'
      ? 'Proceso 100% seguro y confidencial'
      : 'Tus datos están protegidos y solo se usan para este análisis';

  return (
    <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
      <Icon className="h-3.5 w-3.5 shrink-0 text-violet-500" />
      {text}
    </p>
  );
}
