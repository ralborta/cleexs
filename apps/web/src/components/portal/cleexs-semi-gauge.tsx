'use client';

import { useId } from 'react';

export type SemiGaugeProps = {
  value: number;
  /** Con aguja (p. ej. informe técnico); portal cliente / Premium sin aguja */
  showNeedle?: boolean;
};

/** Semicírculo con gradiente rojo → verde, valor central y escala “de 100”. */
export function SemiGauge({ value, showNeedle = true }: SemiGaugeProps) {
  const gradId = useId().replace(/:/g, '');
  const v = Math.min(100, Math.max(0, value));
  const angleDeg = -90 + (v / 100) * 180;
  return (
    <div className="relative mx-auto flex h-[118px] w-full max-w-[200px] justify-center sm:h-[128px] sm:max-w-[218px]">
      <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={`g-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path
          d="M 14 64 A 46 46 0 0 1 106 64"
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 14 64 A 46 46 0 0 1 106 64"
          fill="none"
          stroke={`url(#g-${gradId})`}
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v} ${100 - v}`}
        />
        {showNeedle ? (
          <>
            <g transform={`rotate(${angleDeg} 60 64)`}>
              <line x1="60" y1="64" x2="60" y2="26" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle cx="60" cy="64" r="4.5" fill="#1e293b" />
          </>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
        <p className="text-xl font-black tabular-nums leading-none text-slate-900 sm:text-[1.35rem]">{Math.round(v)}</p>
        <p className="mt-0.5 text-[9px] font-medium text-slate-500">de 100</p>
      </div>
    </div>
  );
}
