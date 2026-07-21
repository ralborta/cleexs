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
  size?: 'lg' | 'xl';
  className?: string;
};

export function CleexsScoreRing({ score, size = 'lg', className }: CleexsScoreRingProps) {
  const gradId = useId().replace(/:/g, '');
  const pct = normalizeScorePct(score);
  const colors = getScoreTrafficColors(pct);
  const r = size === 'xl' ? 62 : 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const box = size === 'xl' ? 'h-44 w-44' : 'h-36 w-36';
  const scoreText = size === 'xl' ? 'text-5xl' : 'text-4xl';

  return (
    <div className={cn('relative mx-auto shrink-0', box, className)}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e8ecf4" strokeWidth="11" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={`url(#scoreGrad-${gradId})`}
          strokeWidth="11"
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
        <span className={cn(SCORE_NUMBER_CLASS, colors.textClass, scoreText)}>{pct}</span>
        <span className="text-sm font-semibold text-slate-400">/100</span>
      </div>
    </div>
  );
}
