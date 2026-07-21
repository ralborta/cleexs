'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import {
  getScoreTrafficColors,
  normalizeScorePct,
  SCORE_NUMBER_CLASS,
} from '@/lib/score-traffic-colors';

type CleexsScoreRingProps = {
  score: number;
  size?: 'md' | 'hero' | 'lg' | 'xl';
  className?: string;
};

const RING_SIZE = {
  md: { r: 46, box: 'h-28 w-28', scoreText: 'text-3xl', stroke: 9 },
  hero: { r: 62, box: 'h-[9.5rem] w-[9.5rem]', scoreText: 'text-4xl', stroke: 10 },
  lg: { r: 54, box: 'h-36 w-36', scoreText: 'text-4xl', stroke: 11 },
  xl: { r: 62, box: 'h-44 w-44', scoreText: 'text-5xl', stroke: 11 },
} as const;

export function CleexsScoreRing({ score, size = 'lg', className }: CleexsScoreRingProps) {
  const gradId = useId().replace(/:/g, '');
  const pct = normalizeScorePct(score);
  const colors = getScoreTrafficColors(pct);
  const spec = RING_SIZE[size];
  const c = 2 * Math.PI * spec.r;
  const offset = c - (pct / 100) * c;

  return (
    <div className={cn('relative mx-auto shrink-0', spec.box, className)}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden>
        <circle cx="70" cy="70" r={spec.r} fill="none" stroke="#e8ecf4" strokeWidth={spec.stroke} />
        <circle
          cx="70"
          cy="70"
          r={spec.r}
          fill="none"
          stroke={`url(#scoreGrad-${gradId})`}
          strokeWidth={spec.stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id={`scoreGrad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.strokeLight} />
            <stop offset="100%" stopColor={colors.stroke} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn(SCORE_NUMBER_CLASS, colors.textClass, spec.scoreText)}>{pct}</span>
        <span className="text-[11px] font-semibold text-slate-400 sm:text-xs">/100</span>
      </div>
    </div>
  );
}
