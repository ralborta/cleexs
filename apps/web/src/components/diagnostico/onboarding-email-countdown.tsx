'use client';

import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 3 minutos y medio para completar el correo antes de volver a cleexs.net. */
export const ONBOARDING_EMAIL_COUNTDOWN_SEC = 210;

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function OnboardingEmailCountdown({
  active,
  onExpire,
  className,
}: {
  active: boolean;
  onExpire: () => void;
  className?: string;
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

  const urgent = secondsLeft <= 60;
  const pct =
    ((ONBOARDING_EMAIL_COUNTDOWN_SEC - secondsLeft) / ONBOARDING_EMAIL_COUNTDOWN_SEC) * 100;

  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed bottom-4 left-4 z-[120] w-[min(100%,18.5rem)]',
        className
      )}
    >
      <div
        className={cn(
          'overflow-hidden rounded-2xl border shadow-xl shadow-red-900/25',
          urgent ? 'border-red-400 ring-2 ring-red-400/40' : 'border-red-300/80'
        )}
      >
        <div className="bg-gradient-to-br from-red-600 via-red-600 to-rose-700 px-4 py-3.5 text-white">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25',
                urgent && 'animate-pulse'
              )}
            >
              <Mail className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-bold leading-snug">
                Ingresá tu correo para continuar con el análisis
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-red-50/95">
                Si no lo completás, volvés a cleexs.net cuando termine el tiempo.
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-100/90">
                Tiempo restante
              </p>
              <p
                className={cn(
                  'mt-0.5 font-mono text-3xl font-extrabold tabular-nums tracking-tight',
                  urgent && 'animate-pulse'
                )}
              >
                {formatCountdown(secondsLeft)}
              </p>
            </div>
            <div
              className="relative flex h-14 w-14 shrink-0 items-center justify-center"
              aria-hidden
            >
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="4"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={2 * Math.PI * 24 * (1 - pct / 100)}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
              <Mail className="relative h-5 w-5 text-white/90" />
            </div>
          </div>
        </div>

        <div className="h-1.5 bg-red-950/30">
          <div
            className="h-full bg-white/90 transition-[width] duration-1000 ease-linear"
            style={{ width: `${100 - pct}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
