export type ScoreTrafficBand = 'green' | 'yellow' | 'red';

export function normalizeScorePct(score: number | null | undefined): number {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  const pct = n <= 1 ? n * 100 : n;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

/** Misma lógica que verdictFromScore en diagnostico-v2-data (65 / 35). */
export function getScoreTrafficBand(score: number): ScoreTrafficBand {
  const pct = normalizeScorePct(score);
  if (pct >= 65) return 'green';
  if (pct >= 35) return 'yellow';
  return 'red';
}

export type ScoreTrafficColors = {
  band: ScoreTrafficBand;
  stroke: string;
  strokeLight: string;
  textClass: string;
  barClass: string;
  label: string;
};

const BAND_COLORS: Record<
  ScoreTrafficBand,
  Omit<ScoreTrafficColors, 'band'>
> = {
  green: {
    stroke: '#059669',
    strokeLight: '#047857',
    textClass: 'text-emerald-600',
    barClass: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
    label: 'Bueno',
  },
  yellow: {
    stroke: '#d97706',
    strokeLight: '#b45309',
    textClass: 'text-amber-700',
    barClass: 'bg-gradient-to-r from-amber-600 to-amber-500',
    label: 'Regular',
  },
  red: {
    stroke: '#dc2626',
    strokeLight: '#b91c1c',
    textClass: 'text-red-700',
    barClass: 'bg-gradient-to-r from-red-700 to-red-600',
    label: 'Crítico',
  },
};

export function getScoreTrafficColors(score: number): ScoreTrafficColors {
  const band = getScoreTrafficBand(score);
  return { band, ...BAND_COLORS[band] };
}

/** Tipografía del número central del score (donut). */
export const SCORE_NUMBER_CLASS =
  'font-black tabular-nums tracking-tight leading-none';
