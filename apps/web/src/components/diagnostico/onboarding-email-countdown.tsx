'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackUnlockClick } from '@/lib/track';

/** 3 minutos y medio; email + Plan Conquistar visibles desde el inicio (minuto 0). */
export const ONBOARDING_EMAIL_COUNTDOWN_SEC = 210;

export const ONBOARDING_EMAIL_COUNTDOWN_HALF_SEC = Math.floor(ONBOARDING_EMAIL_COUNTDOWN_SEC / 2);

const PLAN_CONQUISTAR_UNLOCK_KEY = 'onboarding_countdown_plan_conquistar';

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function OnboardingEmailCountdown({
  active,
  diagnosticId,
  onExpire,
  className,
  variant = 'inline',
}: {
  active: boolean;
  diagnosticId?: string;
  onExpire: () => void;
  className?: string;
  /** inline = compacto vertical dentro de la tarjeta email; banner = barra ancha (legacy). */
  variant?: 'inline' | 'banner';
}) {
  const [secondsLeft, setSecondsLeft] = useState(ONBOARDING_EMAIL_COUNTDOWN_SEC);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active) {
      setSecondsLeft(ONBOARDING_EMAIL_COUNTDOWN_SEC);
      expiredRef.current = false;
      return;
    }

    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(tick);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpireRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [active]);

  if (!active) return null;

  const phaseTwo = secondsLeft <= ONBOARDING_EMAIL_COUNTDOWN_HALF_SEC;
  const urgent = secondsLeft <= 60;
  const planHref = diagnosticId
    ? `/plan-conquistar?diagnosticId=${encodeURIComponent(diagnosticId)}`
    : '/plan-conquistar';

  const handlePlanClick = () => {
    trackUnlockClick({
      unlockKey: PLAN_CONQUISTAR_UNLOCK_KEY,
      label: 'Onboarding · Barra email · Plan Conquistar',
      ...(diagnosticId ? { diagnosticId } : {}),
    });
  };

  const emailHeadline = phaseTwo
    ? 'Completá tu email — no pierdas tu análisis'
    : 'Completá tu email — último paso';

  const emailSubline = phaseTwo
    ? 'Dejanos tu correo y arrancamos la corrida.'
    : 'Te enviamos el informe cuando esté listo.';

  const planConquistarBlock = (
    <div className="rounded-lg border border-violet-200/80 bg-violet-50 px-3 py-2.5">
      <p className="text-xs font-semibold leading-snug text-violet-950">4 motores + plan de acción</p>
      <Link
        href={planHref}
        onClick={handlePlanClick}
        className="mt-1 inline-flex text-xs font-semibold text-violet-700 underline-offset-2 hover:text-violet-900 hover:underline"
      >
        Conocé Plan Conquistar →
      </Link>
    </div>
  );

  if (variant === 'inline') {
    return (
      <aside
        role="status"
        aria-live="polite"
        className={cn(
          'overflow-hidden rounded-xl border bg-amber-50/80',
          urgent ? 'border-amber-400 ring-1 ring-amber-300/60' : 'border-amber-200',
          className
        )}
      >
        <div className="space-y-2.5 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white',
                urgent && 'animate-pulse'
              )}
            >
              <Clock className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="font-mono text-xl font-extrabold tabular-nums text-amber-950">
                  {formatCountdown(secondsLeft)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80">
                  restantes
                </p>
              </div>
              <p className="mt-1 text-sm font-bold leading-snug text-slate-900">{emailHeadline}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{emailSubline}</p>
            </div>
          </div>

          {planConquistarBlock}
        </div>

        <div className="h-1 bg-amber-100">
          <div
            className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear"
            style={{
              width: `${((ONBOARDING_EMAIL_COUNTDOWN_SEC - secondsLeft) / ONBOARDING_EMAIL_COUNTDOWN_SEC) * 100}%`,
            }}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside role="status" aria-live="polite" className={cn('shrink-0', className)}>
      <div
        className={cn(
          'overflow-hidden rounded-2xl border shadow-md',
          urgent ? 'border-amber-400 ring-2 ring-amber-300/50' : 'border-amber-200/90'
        )}
      >
        <div className="space-y-px bg-slate-200/80">
          <div className="flex items-center gap-3 bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-3 text-white">
            <Clock className="h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-50/95">
                Tiempo restante
              </p>
              <p className={cn('font-mono text-2xl font-extrabold tabular-nums', urgent && 'animate-pulse')}>
                {formatCountdown(secondsLeft)}
              </p>
            </div>
          </div>
          <div className="bg-white px-4 py-3">
            <p className="text-sm font-bold text-slate-900">{emailHeadline}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{emailSubline}</p>
          </div>
          {planConquistarBlock}
        </div>
        <div className="h-1 bg-amber-100">
          <div
            className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear"
            style={{
              width: `${((ONBOARDING_EMAIL_COUNTDOWN_SEC - secondsLeft) / ONBOARDING_EMAIL_COUNTDOWN_SEC) * 100}%`,
            }}
          />
        </div>
      </div>
    </aside>
  );
}
