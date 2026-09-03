import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CleexsStatusTone = 'success' | 'warning' | 'critical';

const SIZE = {
  sm: { box: 'h-5 w-5', glyph: 'h-3 w-3', warn: 'h-5 w-5' },
  md: { box: 'h-6 w-6', glyph: 'h-3.5 w-3.5', warn: 'h-6 w-6' },
  lg: { box: 'h-7 w-7', glyph: 'h-4 w-4', warn: 'h-7 w-7' },
  xl: { box: 'h-9 w-9', glyph: 'h-[18px] w-[18px]', warn: 'h-9 w-9' },
} as const;

/** Íconos de estado alineados al diseño de tarjetas de hallazgos (círculo ✓, triángulo ⚠, círculo ✕). */
export function CleexsStatusIcon({
  tone,
  size = 'md',
  className,
}: {
  tone: CleexsStatusTone;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const s = SIZE[size];

  if (tone === 'success') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-600 shadow-sm',
          s.box,
          className,
        )}
        aria-hidden
      >
        <Check className={cn('text-white', s.glyph)} strokeWidth={3} />
      </span>
    );
  }

  if (tone === 'warning') {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center', className)} aria-hidden>
        <svg viewBox="0 0 24 24" className={s.warn} fill="none">
          <path
            d="M12 3.5 20.8 19.5H3.2L12 3.5Z"
            className="fill-amber-500"
            stroke="#b45309"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path d="M12 9v4.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="16.8" r="1.1" fill="white" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-red-600 shadow-sm',
        s.box,
        className,
      )}
      aria-hidden
    >
      <X className={cn('text-white', s.glyph)} strokeWidth={3} />
    </span>
  );
}

export const FINDING_TONE_CARD_CLASS: Record<CleexsStatusTone, string> = {
  success: 'border-emerald-200 bg-emerald-50/90',
  warning: 'border-amber-200 bg-amber-50/90',
  critical: 'border-red-200 bg-red-50/90',
};

export const FINDING_TONE_TITLE_CLASS: Record<CleexsStatusTone, string> = {
  success: 'text-emerald-800',
  warning: 'text-amber-950',
  critical: 'text-red-900',
};

export const FINDING_TONE_WATERMARK_CLASS: Record<CleexsStatusTone, string> = {
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-red-500',
};
